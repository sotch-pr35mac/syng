//! Character window management.
//!
//! This module handles the character detail window, which displays
//! stroke order and character information.

#[cfg(desktop)]
use serde::{Deserialize, Serialize};
#[cfg(desktop)]
use tauri::{Emitter, Manager, WebviewWindow, WindowEvent};

/// The writing system initially selected in the character window.
#[cfg(desktop)]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CharacterScript {
    Simplified,
    Traditional,
}

/// Display-only settings sent by the main window, which owns preference persistence.
#[cfg(desktop)]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterDisplaySettings {
    pub show_pinyin: bool,
    pub color_by_tone: bool,
    #[serde(default)]
    pub tone_colors: Vec<String>,
}

/// Data structure for displaying character information.
#[cfg(desktop)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CharacterWindowWord {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinyin: Option<chinese_dictionary::Pinyin>,
    #[serde(
        default,
        rename = "displaySettings",
        skip_serializing_if = "Option::is_none"
    )]
    pub display_settings: Option<CharacterDisplaySettings>,
    pub traditional: String,
    pub simplified: String,
    #[serde(
        default,
        rename = "initialScript",
        skip_serializing_if = "Option::is_none"
    )]
    pub initial_script: Option<CharacterScript>,
}

/// Opens the character window and displays the given word.
#[cfg(desktop)]
#[tauri::command]
pub fn open_character_window(app_handle: tauri::AppHandle, word: CharacterWindowWord) {
    let character_window = app_handle.get_webview_window("characters").unwrap();
    character_window.emit("display-characters", word).unwrap();
    character_window.show().unwrap();
}

/// Sets up the character window with appropriate event handlers.
#[cfg(desktop)]
pub fn setup(character_window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        use crate::platform::{ToolbarThickness, WindowExt};
        character_window.set_transparent_titlebar(ToolbarThickness::Medium);
    }

    #[cfg(debug_assertions)]
    character_window.open_devtools();

    let window = character_window.clone();
    character_window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
            let _ = window.emit("character-window-hidden", ());
        }
    });
}

#[cfg(all(test, desktop))]
mod tests {
    use super::{CharacterScript, CharacterWindowWord};

    #[test]
    fn character_window_transports_selected_pronunciation_and_display_settings() {
        let value = serde_json::json!({
            "traditional": "學習", "simplified": "学习",
            "pinyin": { "marks": "xué xí", "numbers": "xue2xi2", "tones": [2, 2] },
            "displaySettings": { "showPinyin": true, "colorByTone": true, "toneColors": ["#123456"] }
        });
        let word: CharacterWindowWord = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(word).unwrap(), value);
    }

    #[test]
    fn character_window_word_uses_the_frontend_initial_script_shape() {
        let word: CharacterWindowWord = serde_json::from_value(serde_json::json!({
            "traditional": "漢字",
            "simplified": "汉字",
            "initialScript": "traditional"
        }))
        .unwrap();

        assert_eq!(word.initial_script, Some(CharacterScript::Traditional));
        assert_eq!(
            serde_json::to_value(word).unwrap()["initialScript"],
            "traditional"
        );
    }

    #[test]
    fn character_window_word_allows_no_initial_script_for_both() {
        let word: CharacterWindowWord = serde_json::from_value(serde_json::json!({
            "traditional": "漢字",
            "simplified": "汉字"
        }))
        .unwrap();

        assert_eq!(word.initial_script, None);
        assert!(serde_json::to_value(word)
            .unwrap()
            .get("initialScript")
            .is_none());
    }
}
