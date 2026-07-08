//! URL helpers for the Syrver backend service.
//!
//! Keep base URLs and endpoint paths separate so build configuration chooses the
//! deployment, while feature modules choose the endpoint they need.

/// Syrver base URL used by debug builds and local development.
pub const SYRVER_LOCAL_BASE_URL: &str = "http://localhost:8787";
/// Syrver base URL used by release builds.
pub const SYRVER_PRODUCTION_BASE_URL: &str =
    "https://v3k460rfi6.execute-api.us-west-2.amazonaws.com/production";

/// Syrver endpoint path that accepts a batch of telemetry event envelopes.
pub const TELEMETRY_EVENTS_PATH: &str = "/v1/telemetry";
/// Syrver endpoint path that mints a per-installation telemetry token.
pub const TELEMETRY_INSTALLATIONS_PATH: &str = "/v1/telemetry/installations";

/// Selects the Syrver base URL by build type.
pub fn syrver_base_url() -> &'static str {
    if cfg!(debug_assertions) {
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
    fn test_syrver_base_url_selects_local_in_debug() {
        assert_eq!(syrver_base_url(), SYRVER_LOCAL_BASE_URL);
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
    }

    #[test]
    fn test_syrver_url_assembles_debug_telemetry_url() {
        assert_eq!(
            syrver_url(TELEMETRY_EVENTS_PATH),
            "http://localhost:8787/v1/telemetry"
        );
    }
}
