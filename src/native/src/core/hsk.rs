use chinese_dictionary::{HskLevel as DictionaryHskLevel, HskLevels};
use hsk::{HskError, HskLevel, HskQuery, HskSystem};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct HskLookup {
    pub simplified: String,
    pub pinyin_numbers: String,
}

fn dictionary_level(level: HskLevel) -> DictionaryHskLevel {
    match level {
        HskLevel::One => DictionaryHskLevel::One,
        HskLevel::Two => DictionaryHskLevel::Two,
        HskLevel::Three => DictionaryHskLevel::Three,
        HskLevel::Four => DictionaryHskLevel::Four,
        HskLevel::Five => DictionaryHskLevel::Five,
        HskLevel::Six => DictionaryHskLevel::Six,
        HskLevel::SevenToNine => DictionaryHskLevel::SevenToNine,
    }
}

fn lookup(simplified: &str, pinyin: Option<&str>) -> HskLevels {
    if simplified.trim().is_empty() {
        return HskLevels::default();
    }
    let levels = match pinyin {
        Some(pinyin) if !pinyin.trim().is_empty() => {
            match hsk::levels_all(HskQuery::new(simplified).pinyin(pinyin)) {
                Ok(levels) => levels,
                Err(HskError::InvalidPinyin(_)) => {
                    hsk::levels_all(HskQuery::new(simplified)).unwrap_or_default()
                }
                Err(_) => return HskLevels::default(),
            }
        }
        _ => hsk::levels_all(HskQuery::new(simplified)).unwrap_or_default(),
    };
    let mut output = HskLevels::default();
    for (system, values) in levels {
        let target = match system {
            HskSystem::Hsk2015 => &mut output.hsk_2015,
            HskSystem::ProficiencyStandard2021 => &mut output.proficiency_standard_2021,
            HskSystem::HskExamSyllabus2025 => &mut output.hsk_exam_syllabus_2025,
            _ => continue,
        };
        *target = values.into_iter().map(dictionary_level).collect();
    }
    output
}

pub fn levels_value(simplified: &str, pinyin_numbers: &str) -> HskLevels {
    lookup(simplified, Some(pinyin_numbers))
}

#[tauri::command]
pub fn get_hsk_levels(entries: Vec<HskLookup>) -> Vec<HskLevels> {
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
        assert_eq!(levels_value("出租车", "11 Qu1"), levels_value("出租车", ""));
    }

    #[test]
    fn valid_unmatched_reading_does_not_inherit_another_readings_levels() {
        let zhong = chinese_dictionary::query_by_chinese("中")
            .into_iter()
            .find(|entry| entry.pinyin_numbers == "zhong4")
            .expect("Expected the zhòng dictionary reading");

        assert_eq!(zhong.hsk, HskLevels::default());
        assert_eq!(
            levels_value(&zhong.simplified, &zhong.pinyin_numbers),
            HskLevels::default()
        );
    }

    #[test]
    fn unmatched_word_is_empty() {
        assert_eq!(
            levels_value("不存在的词", "bu4 cun2 zai4 de5 ci2"),
            HskLevels::default()
        );
    }

    #[test]
    fn dictionary_pinyin_disambiguates_polyphonic_entries() {
        let entries = chinese_dictionary::query_by_chinese("长");
        let chang = entries
            .iter()
            .find(|entry| entry.pinyin_numbers == "chang2")
            .expect("Expected the cháng dictionary reading");
        let zhang = entries
            .iter()
            .find(|entry| entry.pinyin_numbers == "zhang3")
            .expect("Expected the zhǎng dictionary reading");

        assert_eq!(
            levels_value(&chang.simplified, &chang.pinyin_numbers).proficiency_standard_2021,
            vec![DictionaryHskLevel::Two]
        );
        assert_eq!(
            levels_value(&zhang.simplified, &zhang.pinyin_numbers).proficiency_standard_2021,
            vec![DictionaryHskLevel::Two, DictionaryHskLevel::Six]
        );
    }

    #[test]
    fn batch_results_preserve_input_order() {
        let results = get_hsk_levels(vec![
            HskLookup {
                simplified: "爱".to_string(),
                pinyin_numbers: "ai4".to_string(),
            },
            HskLookup {
                simplified: "不存在的词".to_string(),
                pinyin_numbers: "bu4 cun2 zai4 de5 ci2".to_string(),
            },
        ]);

        assert_eq!(results.len(), 2);
        assert!(!results[0].hsk_2015.is_empty());
        assert_eq!(results[1], HskLevels::default());
    }

    #[test]
    fn typed_levels_serialize_for_every_hsk_system() {
        let levels = levels_value("爱", "ai4");
        assert!(!levels.hsk_2015.is_empty());
        assert!(!levels.proficiency_standard_2021.is_empty());
        assert!(!levels.hsk_exam_syllabus_2025.is_empty());

        assert_eq!(
            serde_json::to_value(levels).unwrap(),
            serde_json::json!({
                "hsk_2015": ["One"],
                "proficiency_standard_2021": ["One"],
                "hsk_exam_syllabus_2025": ["One"]
            })
        );
    }
}
