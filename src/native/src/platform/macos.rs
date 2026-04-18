//! macOS-specific window customization.
//!
//! This module provides utilities for customizing window appearance on macOS,
//! including transparent titlebars and traffic light positioning.
//!
//! Implementation adapted from:
//! https://github.com/hoppscotch/hoppscotch/blob/main/packages/hoppscotch-selfhost-desktop/src-tauri/src/mac/window.rs

use tauri::{Runtime, WebviewWindow, Window};

/// Padding for window control buttons (traffic lights).
pub const WINDOW_CONTROL_PAD_X: f64 = 17.0;
pub const WINDOW_CONTROL_PAD_Y: f64 = 28.0;

/// Controls the thickness of the transparent titlebar.
#[allow(dead_code)]
pub enum ToolbarThickness {
    /// Thick toolbar with visible title area.
    Thick,
    /// Medium toolbar with hidden title.
    Medium,
    /// Thin toolbar with hidden title and no toolbar.
    Thin,
}

/// Extension trait for customizing window appearance on macOS.
pub trait WindowExt {
    /// Sets a transparent titlebar with the specified thickness.
    fn set_transparent_titlebar(&self, thickness: ToolbarThickness);

    /// Sets the position of the window control buttons (traffic lights).
    fn set_window_controls_pos(&self, x: f64, y: f64);
}

/// Creates a toolbar for the given NSWindow.
///
/// # Safety
/// This function interacts with Objective-C APIs and must be called on the main thread.
unsafe fn make_toolbar(window: &objc2_app_kit::NSWindow) {
    use objc2::{MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::NSToolbar;
    use objc2_foundation::NSString;

    let mtm = MainThreadMarker::new().expect("must be on main thread");
    let toolbar =
        NSToolbar::initWithIdentifier(NSToolbar::alloc(mtm), &NSString::from_str("window_toolbar"));
    window.setToolbar(Some(&toolbar));
}

/// Macro to implement WindowExt for window types that provide `ns_window()` and `set_title()`.
macro_rules! impl_window_ext {
    ($type:ty) => {
        impl<R: Runtime> WindowExt for $type {
            fn set_transparent_titlebar(&self, thickness: ToolbarThickness) {
                use objc2::rc::Retained;
                use objc2::runtime::AnyObject;
                use objc2_app_kit::{NSWindow, NSWindowTitleVisibility};

                unsafe {
                    let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
                    let ns_window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

                    ns_window.setTitlebarAppearsTransparent(true);

                    match thickness {
                        ToolbarThickness::Thick => {
                            self.set_title("").expect("Title wasn't set to ''");
                            make_toolbar(ns_window.as_ref());
                        }
                        ToolbarThickness::Medium => {
                            ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                            make_toolbar(ns_window.as_ref());
                        }
                        ToolbarThickness::Thin => {
                            ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
                        }
                    }
                }
            }

            fn set_window_controls_pos(&self, x: f64, y: f64) {
                use objc2::rc::Retained;
                use objc2::runtime::AnyObject;
                use objc2_app_kit::{NSWindow, NSWindowButton};

                unsafe {
                    let ns_window_ptr = self.ns_window().unwrap() as *mut AnyObject;
                    let window = Retained::retain(ns_window_ptr as *mut NSWindow).unwrap();

                    let close = window
                        .standardWindowButton(NSWindowButton::CloseButton)
                        .unwrap();
                    let minimize = window
                        .standardWindowButton(NSWindowButton::MiniaturizeButton)
                        .unwrap();
                    let maximize = window
                        .standardWindowButton(NSWindowButton::ZoomButton)
                        .unwrap();

                    let title_bar_container_view = close.superview().unwrap().superview().unwrap();

                    let close_rect = close.frame();
                    let button_height = close_rect.size.height;

                    let title_bar_frame_height = button_height + y;
                    let mut title_bar_rect = title_bar_container_view.frame();
                    title_bar_rect.size.height = title_bar_frame_height;
                    title_bar_rect.origin.y = window.frame().size.height - title_bar_frame_height;
                    title_bar_container_view.setFrame(title_bar_rect);

                    let space_between = minimize.frame().origin.x - close.frame().origin.x;
                    let window_buttons = vec![close, minimize, maximize];

                    for (i, button) in window_buttons.into_iter().enumerate() {
                        let mut rect = button.frame();
                        rect.origin.x = x + (i as f64 * space_between);
                        button.setFrameOrigin(rect.origin);
                    }
                }
            }
        }
    };
}

impl_window_ext!(Window<R>);
impl_window_ext!(WebviewWindow<R>);
