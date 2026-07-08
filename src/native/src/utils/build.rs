//! Helpers for build-configuration checks.

/// Whether this binary was compiled as a development/debug build.
pub fn is_development() -> bool {
    cfg!(debug_assertions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_development_matches_debug_assertions() {
        assert_eq!(is_development(), cfg!(debug_assertions));
    }
}
