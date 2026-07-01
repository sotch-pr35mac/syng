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
}

const SYNG_GPL: &str = include_str!("../../resources/licenses/Syng-GPLv3.txt");
const SYNG_EXCEPTION: &str = include_str!("../../resources/licenses/Syng-App-Store-Exception.txt");
const CC_CEDICT: &str = include_str!("../../resources/licenses/CC-CEDICT-CC-BY-SA.txt");
const MONTSERRAT_OFL: &str = include_str!("../../resources/licenses/Montserrat-OFL.txt");
const MONTSERRAT_AUTHORS: &str = include_str!("../../resources/licenses/Montserrat-AUTHORS.txt");
const HANZI_WRITER_DATA: &str =
    include_str!("../../resources/licenses/hanzi-writer-data-ArphicPublicLicense.txt");
const POUCHDB: &str = include_str!("../../resources/licenses/PouchDB-Apache-2.0.txt");

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
        },
        Acknowledgement {
            name: "CC-CEDICT".into(),
            license: "Creative Commons Attribution-ShareAlike".into(),
            text: CC_CEDICT.into(),
        },
        Acknowledgement {
            name: "Montserrat".into(),
            license: "SIL Open Font License 1.1".into(),
            text: format!("{MONTSERRAT_OFL}\n\n{MONTSERRAT_AUTHORS}"),
        },
        Acknowledgement {
            name: "Make Me a Hanzi (hanzi-writer-data)".into(),
            license: "Arphic Public License".into(),
            text: HANZI_WRITER_DATA.into(),
        },
        Acknowledgement {
            name: "PouchDB".into(),
            license: "Apache License 2.0".into(),
            text: POUCHDB.into(),
        },
    ]
}
