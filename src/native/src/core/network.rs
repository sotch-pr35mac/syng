use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Notify;

/// Process-wide browser-reported connectivity. It begins offline so native remote work cannot
/// start before the webview has synchronized `navigator.onLine`.
struct NetworkStatusInner {
    online: AtomicBool,
    reconnected: Notify,
}

#[derive(Clone)]
pub struct NetworkStatus {
    inner: Arc<NetworkStatusInner>,
}

impl Default for NetworkStatus {
    fn default() -> Self {
        Self {
            inner: Arc::new(NetworkStatusInner {
                online: AtomicBool::new(false),
                reconnected: Notify::new(),
            }),
        }
    }
}

impl NetworkStatus {
    pub fn is_online(&self) -> bool {
        self.inner.online.load(Ordering::Acquire)
    }

    pub fn set_online(&self, online: bool) {
        let was_online = self.inner.online.swap(online, Ordering::AcqRel);
        if online && !was_online {
            self.inner.reconnected.notify_one();
        }
    }

    pub async fn wait_for_change(&self) {
        self.inner.reconnected.notified().await;
    }
}

#[tauri::command]
pub fn set_network_online(online: bool, state: State<'_, NetworkStatus>) {
    state.set_online(online);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_offline_until_the_webview_reports_status() {
        let status = NetworkStatus::default();
        assert!(!status.is_online());
        status.set_online(true);
        assert!(status.is_online());
    }
}
