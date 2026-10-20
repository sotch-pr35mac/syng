//! The application UI follows system text preferences without changing page zoom.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
#[cfg(target_os = "ios")]
use tauri::{Emitter, Manager};

pub const DEFAULT_ROOT_FONT_SIZE_PX: f64 = 16.0;
#[cfg(target_os = "ios")]
const SYSTEM_TYPOGRAPHY_CHANGED: &str = "system-typography-changed";

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemTypographySnapshot {
    pub root_font_size_px: f64,
    pub revision: u64,
}

impl Default for SystemTypographySnapshot {
    fn default() -> Self {
        Self {
            root_font_size_px: DEFAULT_ROOT_FONT_SIZE_PX,
            revision: 0,
        }
    }
}

#[derive(Default)]
pub struct SystemTypography {
    snapshot: Mutex<SystemTypographySnapshot>,
}

impl SystemTypography {
    fn snapshot(&self) -> SystemTypographySnapshot {
        *self
            .snapshot
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }

    #[cfg(any(target_os = "ios", test))]
    fn update(&self, root_font_size_px: f64) -> Option<SystemTypographySnapshot> {
        if !root_font_size_px.is_finite() || root_font_size_px <= 0.0 {
            return None;
        }
        let mut snapshot = self
            .snapshot
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if snapshot.root_font_size_px == root_font_size_px {
            return None;
        }
        snapshot.root_font_size_px = root_font_size_px;
        snapshot.revision += 1;
        Some(*snapshot)
    }
}

#[tauri::command]
pub fn get_system_typography(state: State<'_, SystemTypography>) -> SystemTypographySnapshot {
    state.snapshot()
}

/// Publishes only real changes. A later snapshot can never overwrite a newer frontend event.
#[cfg(target_os = "ios")]
pub fn update_system_typography(app: &AppHandle, root_font_size_px: f64) {
    let Some(snapshot) = app.state::<SystemTypography>().update(root_font_size_px) else {
        return;
    };
    if let Err(error) = app.emit(SYSTEM_TYPOGRAPHY_CHANGED, snapshot) {
        eprintln!("[system typography] could not publish text size: {error}");
    }
}

/// Called once from app setup, after managing `SystemTypography`.
pub fn install(app: &AppHandle) {
    #[cfg(target_os = "ios")]
    crate::platform::ios::install_system_typography(app);

    // Android's WebView already applies system font scaling. Windows WebView2 also
    // includes the system text scale in its native rasterization scale (in addition to
    // monitor DPI). A CSS multiplier on either platform would enlarge text twice.
    // Keep their root at 16px and let the engine resize/reflow naturally. macOS and
    // Linux likewise retain their native display scaling, without a text-only bridge.
    // https://github.com/MicrosoftEdge/WebView2Feedback/issues/3699
    #[cfg(not(target_os = "ios"))]
    let _ = app;
}

/// Called from the UI-thread `RunEvent::Exit` callback to release native subscriptions.
pub fn shutdown() {
    #[cfg(target_os = "ios")]
    crate::platform::ios::remove_system_typography_observers();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retains_the_default_until_a_valid_system_size_arrives() {
        let typography = SystemTypography::default();
        for invalid_size in [f64::NAN, f64::INFINITY, 0.0, -1.0] {
            assert!(typography.update(invalid_size).is_none());
        }
        assert_eq!(typography.snapshot(), SystemTypographySnapshot::default());
    }

    #[test]
    fn revisions_track_changes_including_return_to_default() {
        let typography = SystemTypography::default();
        let enlarged = typography.update(32.0).unwrap();
        assert_eq!(enlarged.revision, 1);
        assert!(typography.update(32.0).is_none());
        let restored = typography.update(DEFAULT_ROOT_FONT_SIZE_PX).unwrap();
        assert_eq!(restored.revision, 2);
        assert_eq!(restored.root_font_size_px, DEFAULT_ROOT_FONT_SIZE_PX);
    }

    #[test]
    fn preserves_large_accessibility_sizes_without_an_app_imposed_cap() {
        let typography = SystemTypography::default();
        assert_eq!(typography.update(56.0).unwrap().root_font_size_px, 56.0);
    }
}
