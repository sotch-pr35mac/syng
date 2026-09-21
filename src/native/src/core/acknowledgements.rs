//! Third-party attribution surfaced in the app's Acknowledgements screen.
//!
//! The license texts are embedded at compile time from `resources/licenses/` — the same files
//! that ship on disk via `bundle.resources` in `tauri.conf.json`. Embedding keeps the UI's text
//! identical to the bundled artifact while avoiding any dependency on runtime resource-path
//! resolution (which varies across desktop, iOS, and Android).

use serde::Serialize;

#[derive(Serialize)]
pub struct Acknowledgement {
    /// The component or work being attributed.
    pub name: String,
    /// Short human-readable license name.
    pub license: String,
    /// Full verbatim license text.
    pub text: String,
    /// Optional external source for attribution details that are too large to display inline.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

const SYNG_GPL: &str = include_str!("../../resources/licenses/Syng-GPLv3.txt");
const SYNG_EXCEPTION: &str = include_str!("../../resources/licenses/Syng-App-Store-Exception.txt");
const CC_CEDICT: &str = include_str!("../../resources/licenses/CC-CEDICT-CC-BY-SA.txt");
const MONTSERRAT_OFL: &str = include_str!("../../resources/licenses/Montserrat-OFL.txt");
const MONTSERRAT_AUTHORS: &str = include_str!("../../resources/licenses/Montserrat-AUTHORS.txt");
const HANZI_WRITER_DATA: &str =
    include_str!("../../resources/licenses/hanzi-writer-data-ArphicPublicLicense.txt");
const POUCHDB: &str = include_str!("../../resources/licenses/PouchDB-Apache-2.0.txt");
const CHINESE_DICTIONARY_MIT: &str =
    include_str!("../../resources/licenses/LICENSE-CHINESE-DICTIONARY-MIT.txt");
const CHINESE_DICTIONARY_DATA_LICENSE: &str =
    include_str!("../../resources/licenses/LICENSE-DATA.txt");
const CHINESE_DICTIONARY_WORDNET_LICENSE: &str =
    include_str!("../../resources/licenses/LICENSE-WORDNET.txt");
const CHINESE_DICTIONARY_NOTICE: &str = include_str!("../../resources/licenses/NOTICE.md");
const CHINESE_DICTIONARY_MANIFEST: &str = include_str!("../../resources/licenses/manifest.json");
const WIKTIONARY_ATTRIBUTION_URL: &str =
    "https://github.com/sotch-pr35mac/chinese_dictionary/releases/download/v4.1.0/wiktionary-attribution-4.1.0.json";

/// Returns the third-party attributions displayed in Settings → Acknowledgements, most relevant
/// first. Syng's own license (with the App Store exception) is included so recipients always have
/// the GPL text alongside the running binary.
#[tauri::command]
pub fn get_acknowledgements() -> Vec<Acknowledgement> {
    vec![
        Acknowledgement {
            name: "Syng".into(),
            license: "GNU General Public License v3.0 (with App Store exception)".into(),
            text: format!("{SYNG_GPL}\n\n{SYNG_EXCEPTION}"),
            url: None,
        },
        Acknowledgement {
            name: "chinese_dictionary".into(),
            license: "MIT License".into(),
            text: CHINESE_DICTIONARY_MIT.into(),
            url: None,
        },
        Acknowledgement {
            name: "Chinese dictionary data".into(),
            license: "Creative Commons Attribution-ShareAlike 4.0".into(),
            text: CHINESE_DICTIONARY_DATA_LICENSE.into(),
            url: None,
        },
        Acknowledgement {
            name: "Chinese dictionary sources and attribution".into(),
            license: "Source notices and manifest".into(),
            text: format!("{CHINESE_DICTIONARY_NOTICE}\n\n{CHINESE_DICTIONARY_MANIFEST}"),
            url: None,
        },
        Acknowledgement {
            name: "Wiktionary attribution".into(),
            license: "chinese_dictionary v4.1.0 — contributor attribution".into(),
            text: String::new(),
            url: Some(WIKTIONARY_ATTRIBUTION_URL.into()),
        },
        Acknowledgement {
            name: "Princeton WordNet 3.1".into(),
            license: "WordNet License".into(),
            text: CHINESE_DICTIONARY_WORDNET_LICENSE.into(),
            url: None,
        },
        Acknowledgement {
            name: "CC-CEDICT".into(),
            license: "Creative Commons Attribution-ShareAlike".into(),
            text: CC_CEDICT.into(),
            url: None,
        },
        Acknowledgement {
            name: "Montserrat".into(),
            license: "SIL Open Font License 1.1".into(),
            text: format!("{MONTSERRAT_OFL}\n\n{MONTSERRAT_AUTHORS}"),
            url: None,
        },
        Acknowledgement {
            name: "Make Me a Hanzi (hanzi-writer-data)".into(),
            license: "Arphic Public License".into(),
            text: HANZI_WRITER_DATA.into(),
            url: None,
        },
        Acknowledgement {
            name: "PouchDB".into(),
            license: "Apache License 2.0".into(),
            text: POUCHDB.into(),
            url: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::fmt::Write;
    use std::fs;
    use std::path::Path;

    const RESOURCE_DIRECTORIES: [&str; 3] = [
        "resources/licenses",
        "gen/android/app/src/main/assets/resources/licenses",
        "gen/apple/assets/resources/licenses",
    ];
    const RELEASE_RESOURCE_CHECKSUMS: [(&str, &str); 6] = [
        (
            "LICENSE-CHINESE-DICTIONARY-MIT.txt",
            "e07df377e184a3449b452a0a4ae7cb5f9cd94ac81e791a084611e2711964aac8",
        ),
        (
            "LICENSE-DATA.txt",
            "3f0c22b4438c6918efb202fe82c1b51c4c8b19eb4004749659e02315d2ff98db",
        ),
        (
            "LICENSE-WORDNET.txt",
            "47bb35b06b51ec412353eb32f946f58002a2ff75b4ca56f733c33019155ebb8b",
        ),
        (
            "NOTICE.md",
            "e3aa490a6af8ca2441b9339f053c02ad639fcc5a867a15e7991841703825730d",
        ),
        (
            "manifest.json",
            "6a2866b5c47a272dec23b6b88f57d48ecfc341b827043c3114969975fac88ea8",
        ),
        (
            "wiktionary-attribution.json",
            "ae3fd3831737b4f742aa65341e632174ab14f6cc0416cb40147a6fe7508a744e",
        ),
    ];

    fn sha256(contents: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(contents);
        let digest = hasher.finalize();
        let mut checksum = String::with_capacity(digest.len() * 2);
        for byte in digest {
            write!(&mut checksum, "{byte:02x}").expect("writing to a String cannot fail");
        }
        checksum
    }

    #[test]
    fn dictionary_acknowledgements_include_required_cards_and_attribution_url() {
        let acknowledgements = get_acknowledgements();

        let library = acknowledgements
            .iter()
            .find(|acknowledgement| acknowledgement.name == "chinese_dictionary")
            .expect("chinese_dictionary acknowledgement");
        assert_eq!(library.license, "MIT License");
        assert_eq!(library.text, CHINESE_DICTIONARY_MIT);
        assert_eq!(library.url, None);

        let dictionary_data = acknowledgements
            .iter()
            .find(|acknowledgement| acknowledgement.name == "Chinese dictionary data")
            .expect("dictionary data acknowledgement");
        assert_eq!(
            dictionary_data.license,
            "Creative Commons Attribution-ShareAlike 4.0"
        );
        assert_eq!(dictionary_data.text, CHINESE_DICTIONARY_DATA_LICENSE);
        assert_eq!(dictionary_data.url, None);

        let sources = acknowledgements
            .iter()
            .find(|acknowledgement| {
                acknowledgement.name == "Chinese dictionary sources and attribution"
            })
            .expect("dictionary sources acknowledgement");
        assert_eq!(sources.license, "Source notices and manifest");
        assert_eq!(
            sources.text,
            format!("{CHINESE_DICTIONARY_NOTICE}\n\n{CHINESE_DICTIONARY_MANIFEST}")
        );
        assert_eq!(sources.url, None);

        let wiktionary = acknowledgements
            .iter()
            .find(|acknowledgement| acknowledgement.name == "Wiktionary attribution")
            .expect("Wiktionary attribution acknowledgement");
        assert_eq!(wiktionary.url.as_deref(), Some(WIKTIONARY_ATTRIBUTION_URL));
        assert!(wiktionary.text.is_empty());

        let wordnet = acknowledgements
            .iter()
            .find(|acknowledgement| acknowledgement.name == "Princeton WordNet 3.1")
            .expect("WordNet acknowledgement");
        assert_eq!(wordnet.license, "WordNet License");
        assert_eq!(wordnet.text, CHINESE_DICTIONARY_WORDNET_LICENSE);
        assert_eq!(wordnet.url, None);
    }

    #[test]
    fn release_resources_match_v4_1_0_checksums_in_every_bundle_location() {
        let manifest_directory = Path::new(env!("CARGO_MANIFEST_DIR"));

        for resource_directory in RESOURCE_DIRECTORIES {
            for (file_name, expected_checksum) in RELEASE_RESOURCE_CHECKSUMS {
                let resource_path = manifest_directory.join(resource_directory).join(file_name);
                let contents = fs::read(&resource_path).unwrap_or_else(|error| {
                    panic!("failed to read {}: {error}", resource_path.display())
                });
                assert_eq!(
                    sha256(&contents),
                    expected_checksum,
                    "{} does not match the v4.1.0 release",
                    resource_path.display()
                );
            }
        }
    }
}
