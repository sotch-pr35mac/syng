//! URL helpers for the Syrver backend service.
//!
//! Keep base URLs and endpoint paths separate so build configuration chooses the
//! deployment, while feature modules choose the endpoint they need.

use crate::utils::build::is_development;

/// Syrver base URL used by debug builds and local development.
pub const SYRVER_LOCAL_BASE_URL: &str = "http://localhost:8787";
/// Syrver base URL used by release builds.
pub const SYRVER_PRODUCTION_BASE_URL: &str =
    "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com/production";

/// Syrver endpoint path that accepts a batch of telemetry event envelopes.
pub const TELEMETRY_EVENTS_PATH: &str = "/v1/telemetry";
/// Syrver endpoint path that mints a per-installation telemetry token.
pub const TELEMETRY_INSTALLATIONS_PATH: &str = "/v1/telemetry/installations";
/// Authenticated, explicitly consented interview contact collection.
pub const INTERVIEWS_PATH: &str = "/v1/interviews";
/// Stable update checks; placeholders are expanded by the Tauri updater.
pub const UPDATES_PATH: &str = "/v1/updates/stable/{{target}}/{{arch}}/{{current_version}}";

/// Selects the Syrver base URL by build type.
pub fn syrver_base_url() -> &'static str {
    if is_development() {
        SYRVER_LOCAL_BASE_URL
    } else {
        SYRVER_PRODUCTION_BASE_URL
    }
}

/// Assembles a full Syrver URL from the selected base URL and an endpoint path.
pub fn syrver_url(path: &str) -> String {
    format!("{}{}", syrver_base_url(), path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_syrver_base_url_selects_by_build_type() {
        let expected = if is_development() {
            SYRVER_LOCAL_BASE_URL
        } else {
            SYRVER_PRODUCTION_BASE_URL
        };

        assert_eq!(syrver_base_url(), expected);
    }

    #[test]
    fn test_syrver_production_base_url_is_api_gateway_production() {
        assert_eq!(
            SYRVER_PRODUCTION_BASE_URL,
            "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com/production"
        );
    }

    #[test]
    fn test_telemetry_endpoint_paths_are_versioned() {
        assert_eq!(TELEMETRY_EVENTS_PATH, "/v1/telemetry");
        assert_eq!(TELEMETRY_INSTALLATIONS_PATH, "/v1/telemetry/installations");
        assert_eq!(INTERVIEWS_PATH, "/v1/interviews");
    }

    #[test]
    fn test_syrver_url_assembles_selected_telemetry_url() {
        assert_eq!(
            syrver_url(TELEMETRY_EVENTS_PATH),
            format!("{}{}", syrver_base_url(), TELEMETRY_EVENTS_PATH)
        );
    }

    #[test]
    fn updater_route_matches_production_config_and_selects_local_in_development() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        let production_endpoint = format!("{SYRVER_PRODUCTION_BASE_URL}{UPDATES_PATH}");
        assert_eq!(
            config["plugins"]["updater"]["endpoints"],
            serde_json::json!([production_endpoint])
        );
        let expected = if is_development() {
            "http://localhost:8787/v1/updates/stable/{{target}}/{{arch}}/{{current_version}}"
        } else {
            &production_endpoint
        };
        assert_eq!(syrver_url(UPDATES_PATH), expected);
    }
}
