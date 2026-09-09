use serde::Serialize;

/// A compact region record for the frontend selector. The ISO data stays in the native binary so
/// it does not inflate the launch-critical JavaScript bundle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionOption {
    pub code: &'static str,
    pub fallback_name: &'static str,
}

#[tauri::command]
pub fn get_region_options() -> Vec<RegionOption> {
    rust_iso3166::ALL
        .iter()
        .map(|country| RegionOption {
            code: country.alpha2,
            fallback_name: country.name,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::get_region_options;

    #[test]
    fn returns_iso_alpha_2_regions_without_grouping_codes() {
        let regions = get_region_options();

        assert_eq!(regions.len(), 249);
        assert!(regions.iter().any(
            |region| region.code == "US" && region.fallback_name == "United States of America"
        ));
        assert!(regions.iter().any(|region| region.code == "JP"));
        assert!(!regions.iter().any(|region| region.code == "EU"));
        assert!(!regions.iter().any(|region| region.code == "UN"));
        assert!(!regions.iter().any(|region| region.code == "ZZ"));
    }
}
