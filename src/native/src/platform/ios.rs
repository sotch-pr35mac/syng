//! iOS-specific recovery from WKWebView content-process termination.
//!
//! When iOS reclaims memory from a backgrounded app it terminates the WKWebView web
//! content process. wry implements the `webViewWebContentProcessDidTerminate:` delegate
//! but only forwards to an optional handler that Tauri never sets, so nothing reloads the
//! dead webview — on resume the user sees a blank page and the JS context is gone.
//!
//! This module installs a `UIApplicationDidBecomeActive` observer that, on each
//! foreground, reloads the webview to its base page **only when the content process was
//! terminated** (detected via `WKWebView.url == nil`). Quick app-switches where the
//! process survives keep their `url` and are left untouched, preserving in-memory state.
//!
//! `objc2-web-kit` only models the macOS (NSView-based) `WKWebView`, so on iOS we message
//! the webview pointer through objc2's runtime instead of a typed class binding.

use std::cell::RefCell;
use std::ptr::NonNull;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2::{class, msg_send};
use objc2_foundation::{
    NSNotification, NSNotificationCenter, NSObjectProtocol, NSOperationQueue, NSString,
    NSURLRequest, NSURL,
};
use serde_json::json;
use tauri::webview::PlatformWebview;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::core::{track_event_native, TelemetryManager};
use crate::system_typography::{update_system_typography, DEFAULT_ROOT_FONT_SIZE_PX};

/// Cocoa notification posted (on the main thread) whenever the app becomes active.
/// The string value of `UIApplicationDidBecomeActiveNotification` equals its symbol name,
/// so the literal lets us observe it without depending on the heavy `objc2-ui-kit` crate.
const DID_BECOME_ACTIVE: &str = "UIApplicationDidBecomeActiveNotification";

/// Telemetry event emitted each time a resume-time recovery reload fires.
const RECOVERY_EVENT: &str = "app.ios_content_process_recovery_requested";

const CONTENT_SIZE_CATEGORY_CHANGED: &str = "UIContentSizeCategoryDidChangeNotification";

struct SystemTypographyObservers {
    tokens: Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>>,
}

impl Drop for SystemTypographyObservers {
    fn drop(&mut self) {
        let center = NSNotificationCenter::defaultCenter();
        for token in &self.tokens {
            // Observer registration and removal both occur on the main thread.
            unsafe { center.removeObserver((**token).as_ref()) };
        }
    }
}

thread_local! {
    // UIKit objects stay on the UI thread instead of asserting Send/Sync for Cocoa objects.
    static SYSTEM_TYPOGRAPHY_OBSERVERS: RefCell<Option<SystemTypographyObservers>> = const {
        RefCell::new(None)
    };
}

/// Connect Dynamic Type to the application UI while leaving Reader content sizing alone.
pub fn install_system_typography(app: &AppHandle) {
    let app_for_main_thread = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        unsafe { refresh_system_typography(&app_for_main_thread) };
        SYSTEM_TYPOGRAPHY_OBSERVERS.with(|observers| {
            if observers.borrow().is_some() {
                return;
            }
            let center = NSNotificationCenter::defaultCenter();
            let queue = NSOperationQueue::mainQueue();
            let mut tokens = Vec::new();
            for notification_name in [CONTENT_SIZE_CATEGORY_CHANGED, DID_BECOME_ACTIVE] {
                let callback_app = app_for_main_thread.clone();
                let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
                    // The main operation queue guarantees UIKit's required thread.
                    unsafe { refresh_system_typography(&callback_app) };
                });
                let name = NSString::from_str(notification_name);
                let token = unsafe {
                    center.addObserverForName_object_queue_usingBlock(
                        Some(&name),
                        None,
                        Some(&queue),
                        &block,
                    )
                };
                tokens.push(token);
            }
            *observers.borrow_mut() = Some(SystemTypographyObservers { tokens });
        });
    }) {
        eprintln!("[system typography] could not install Dynamic Type observers: {error}");
    }
}

/// Called on the main thread during application shutdown.
pub fn remove_system_typography_observers() {
    SYSTEM_TYPOGRAPHY_OBSERVERS.with(|observers| {
        observers.borrow_mut().take();
    });
}

/// # Safety
/// UIFontMetrics must be queried on the main thread.
unsafe fn refresh_system_typography(app: &AppHandle) {
    // UIFontMetrics preserves Syng's 16px baseline and Montserrat family while following
    // the system's body-text curve, including the larger accessibility categories.
    let metrics: Retained<AnyObject> = msg_send![class!(UIFontMetrics), defaultMetrics];
    let root_font_size_px: f64 =
        msg_send![&*metrics, scaledValueForValue: DEFAULT_ROOT_FONT_SIZE_PX];
    update_system_typography(app, root_font_size_px);
}

/// Registers the resume-time recovery observer for the given webview window.
///
/// Safe to call once during app setup; failures to reach the underlying webview are
/// logged and otherwise ignored.
pub fn install_content_process_recovery(window: &WebviewWindow, app: &AppHandle) {
    let app = app.clone();
    let result = window.with_webview(move |platform_webview| {
        // Tauri dispatches this to the UI (main) thread.
        unsafe { register_recovery_observer(platform_webview, app) };
    });

    if let Err(error) = result {
        eprintln!("[ios recovery] could not access webview to install recovery observer: {error}");
    }
}

/// Captures the webview's base URL and installs the `didBecomeActive` observer.
///
/// # Safety
/// Interacts with Objective-C / WKWebView APIs; must run on the main thread (guaranteed by
/// `with_webview`).
unsafe fn register_recovery_observer(platform_webview: PlatformWebview, app: AppHandle) {
    // On iOS `inner()` is the WKWebView pointer; retain it so it outlives this scope.
    let webview_ptr = platform_webview.inner() as *mut AnyObject;
    let Some(webview) = Retained::retain(webview_ptr) else {
        return;
    };

    // Capture the app's base (index) URL. WKWebView populates `url` when navigation
    // begins — at webview creation, before this setup runs — so it is available here even
    // though the page may still be loading. We reload this exact URL on recovery, landing
    // the user on the home/search screen.
    let base_url: Option<Retained<NSURL>> = msg_send![&*webview, URL];

    let webview_for_block = webview.clone();
    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        // didBecomeActive is posted on the main thread, so these WKWebView calls are safe.
        // A live content process keeps `url` populated; iOS clears it to nil once the
        // process is terminated. Only reload in that case so live sessions are untouched.
        let current_url: Option<Retained<NSURL>> = unsafe { msg_send![&*webview_for_block, URL] };
        if current_url.is_some() {
            return;
        }

        unsafe {
            if let Some(url) = base_url.as_ref() {
                let request = NSURLRequest::requestWithURL(url);
                let _: Option<Retained<AnyObject>> =
                    msg_send![&*webview_for_block, loadRequest: &*request];
            } else {
                // No base URL was captured at setup; fall back to a best-effort reload.
                let _: Option<Retained<AnyObject>> = msg_send![&*webview_for_block, reload];
            }
        }

        let manager = app.state::<TelemetryManager>();
        track_event_native(&manager, RECOVERY_EVENT, json!({}));
    });

    let name = NSString::from_str(DID_BECOME_ACTIVE);
    let center = NSNotificationCenter::defaultCenter();
    // The notification center copies the block and owns the returned observer token until
    // it is removed. Recovery stays active for the app's lifetime, so we never remove it —
    // intentionally leak the token to keep the observation alive.
    let observer =
        center.addObserverForName_object_queue_usingBlock(Some(&*name), None, None, &block);
    std::mem::forget(observer);
}
