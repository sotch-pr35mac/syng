use hsk::{HskLevel, HskQuery, HskSystem};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct HskLookup {
    pub simplified: String,
    pub pinyin_numbers: String,
}

fn empty() -> serde_json::Value {
    serde_json::json!({
        "hsk_2015": [],
        "proficiency_standard_2021": [],
        "hsk_exam_syllabus_2025": []
    })
}

fn level_name(level: HskLevel) -> &'static str {
    match level {
        HskLevel::One => "One",
        HskLevel::Two => "Two",
        HskLevel::Three => "Three",
        HskLevel::Four => "Four",
        HskLevel::Five => "Five",
        HskLevel::Six => "Six",
        HskLevel::SevenToNine => "SevenToNine",
    }
}

fn lookup(simplified: &str, pinyin: Option<&str>) -> serde_json::Value {
    if simplified.trim().is_empty() {
        return empty();
    }
    let query = match pinyin {
        Some(pinyin) if !pinyin.trim().is_empty() => HskQuery::new(simplified).pinyin(pinyin),
        _ => HskQuery::new(simplified),
    };
    let result = hsk::levels_all(query)
        .ok()
        .filter(|levels| !levels.is_empty());
    let result = result.or_else(|| hsk::levels_all(HskQuery::new(simplified)).ok());
    let Some(levels) = result else { return empty() };
    let mut output = empty();
    for (system, values) in levels {
        let key = match system {
            HskSystem::Hsk2015 => "hsk_2015",
            HskSystem::ProficiencyStandard2021 => "proficiency_standard_2021",
            HskSystem::HskExamSyllabus2025 => "hsk_exam_syllabus_2025",
            _ => continue,
        };
        output[key] = serde_json::Value::Array(
            values
                .into_iter()
                .map(|level| serde_json::json!(level_name(level)))
                .collect(),
        );
    }
    output
}

pub fn levels_value(simplified: &str, pinyin_numbers: &str) -> serde_json::Value {
    lookup(simplified, Some(pinyin_numbers))
}

#[tauri::command]
pub fn get_hsk_levels(entries: Vec<HskLookup>) -> Vec<serde_json::Value> {
    entries
        .into_iter()
        .map(|entry| levels_value(&entry.simplified, &entry.pinyin_numbers))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_pinyin_falls_back_to_word() {
        assert_eq!(levels_value("你好", "not pinyin"), levels_value("你好", ""));
    }

    #[test]
    fn unmatched_word_is_empty() {
        assert_eq!(levels_value("不存在的词", "bu4 cun2 zai4 de5 ci2"), empty());
    }
}
