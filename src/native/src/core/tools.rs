use chinese_dictionary as dictionary;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct WordData {
    pub traditional: String,
    pub simplified: String,
    pub pinyin_marks: String,
    pub pinyin_numbers: String,
    pub tone_marks: Vec<u8>,
    pub english: Vec<String>,
    pub hash: u64,
    pub hsk: u8,
    pub word_id: u32,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct PinyinSegment {
    pub source: String,
    pub word_data: Option<WordData>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CharacterScript {
    #[serde(rename = "simplified")]
    Simplified,
    #[serde(rename = "traditional")]
    Traditional,
    #[serde(rename = "unknown")]
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertDirection {
    #[serde(rename = "automatic")]
    Automatic,
    #[serde(rename = "to_simplified")]
    ToSimplified,
    #[serde(rename = "to_traditional")]
    ToTraditional,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct ConvertCharactersResult {
    pub text: String,
    pub direction: ConvertDirection,
    pub detected_script: CharacterScript,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrettifyDirection {
    #[serde(rename = "automatic")]
    Automatic,
    #[serde(rename = "to_marks")]
    ToMarks,
    #[serde(rename = "to_numbers")]
    ToNumbers,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PinyinStyle {
    #[serde(rename = "marks")]
    Marks,
    #[serde(rename = "numbers")]
    Numbers,
    #[serde(rename = "unknown")]
    Unknown,
}

#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct PrettifyPinyinResult {
    pub text: String,
    pub direction: PrettifyDirection,
    pub detected_style: PinyinStyle,
}

#[tauri::command]
pub fn pinyinify(text: String) -> Vec<PinyinSegment> {
    if text.is_empty() {
        return vec![];
    }

    let tokens = dictionary::tokenize(&text);
    let mut segments = Vec::new();
    let mut cursor = 0;

    for token in tokens {
        if !contains_cjk(&token) {
            continue;
        }

        let Some(relative_position) = text[cursor..].find(&token) else {
            continue;
        };
        let token_start = cursor + relative_position;

        if token_start > cursor {
            push_plain_segment(&mut segments, &text[cursor..token_start]);
        }

        let token_end = token_start + token.len();
        let word_data = dictionary::query_by_chinese(&token)
            .first()
            .map(|entry| WordData::from(*entry));
        if word_data.is_some() {
            segments.push(PinyinSegment {
                source: text[token_start..token_end].to_string(),
                word_data,
            });
        } else {
            push_plain_segment(&mut segments, &text[token_start..token_end]);
        }
        cursor = token_end;
    }

    if cursor < text.len() {
        push_plain_segment(&mut segments, &text[cursor..]);
    }

    segments
}

#[tauri::command]
pub fn convert_characters(text: String, direction: ConvertDirection) -> ConvertCharactersResult {
    let detected_script = detect_character_script(&text);
    let resolved_direction = match direction {
        ConvertDirection::Automatic => match detected_script {
            CharacterScript::Traditional => ConvertDirection::ToSimplified,
            CharacterScript::Simplified | CharacterScript::Unknown => ConvertDirection::ToTraditional,
        },
        explicit_direction => explicit_direction,
    };
    let text = match resolved_direction {
        ConvertDirection::Automatic => text,
        ConvertDirection::ToSimplified => dictionary::traditional_to_simplified(&text).to_string(),
        ConvertDirection::ToTraditional => dictionary::simplified_to_traditional(&text).to_string(),
    };

    ConvertCharactersResult {
        text,
        direction: resolved_direction,
        detected_script,
    }
}

#[tauri::command]
pub fn prettify_pinyin(text: String, direction: PrettifyDirection) -> PrettifyPinyinResult {
    let detected_style = detect_pinyin_style(&text);
    let resolved_direction = match direction {
        PrettifyDirection::Automatic => match detected_style {
            PinyinStyle::Marks => PrettifyDirection::ToNumbers,
            PinyinStyle::Numbers | PinyinStyle::Unknown => PrettifyDirection::ToMarks,
        },
        explicit_direction => explicit_direction,
    };
    let text = match resolved_direction {
        PrettifyDirection::Automatic => text,
        PrettifyDirection::ToMarks => pinyin_numbers_to_marks(&text),
        PrettifyDirection::ToNumbers => pinyin_marks_to_numbers(&text),
    };

    PrettifyPinyinResult {
        text,
        direction: resolved_direction,
        detected_style,
    }
}

impl From<&dictionary::WordEntry> for WordData {
    fn from(entry: &dictionary::WordEntry) -> Self {
        Self {
            traditional: entry.traditional.clone(),
            simplified: entry.simplified.clone(),
            pinyin_marks: entry.pinyin_marks.clone(),
            pinyin_numbers: entry.pinyin_numbers.clone(),
            tone_marks: entry.tone_marks.clone(),
            english: entry.english.clone(),
            hash: entry.hash,
            hsk: entry.hsk,
            word_id: entry.word_id,
        }
    }
}

fn push_plain_segment(segments: &mut Vec<PinyinSegment>, source: &str) {
    if source.is_empty() {
        return;
    }

    if let Some(last) = segments.last_mut() {
        if last.word_data.is_none() {
            last.source.push_str(source);
            return;
        }
    }

    segments.push(PinyinSegment {
        source: source.to_string(),
        word_data: None,
    });
}

fn contains_cjk(text: &str) -> bool {
    text.chars().any(|character| {
        matches!(
            character,
            '\u{3400}'..='\u{4DBF}'
                | '\u{4E00}'..='\u{9FFF}'
                | '\u{F900}'..='\u{FAFF}'
                | '\u{20000}'..='\u{2A6DF}'
                | '\u{2A700}'..='\u{2B73F}'
                | '\u{2B740}'..='\u{2B81F}'
                | '\u{2B820}'..='\u{2CEAF}'
        )
    })
}

fn detect_character_script(text: &str) -> CharacterScript {
    if dictionary::is_traditional(text) {
        CharacterScript::Traditional
    } else if dictionary::is_simplified(text) {
        CharacterScript::Simplified
    } else {
        CharacterScript::Unknown
    }
}

fn detect_pinyin_style(text: &str) -> PinyinStyle {
    if text.chars().any(|character| accented_vowel_data(character).is_some()) {
        PinyinStyle::Marks
    } else if text
        .chars()
        .any(|character| matches!(character, '1' | '2' | '3' | '4' | '5'))
    {
        PinyinStyle::Numbers
    } else {
        PinyinStyle::Unknown
    }
}

fn pinyin_numbers_to_marks(text: &str) -> String {
    let mut result = String::new();
    let mut syllable = String::new();

    for character in text.chars() {
        if is_pinyin_letter(character) {
            syllable.push(character);
        } else if character.is_ascii_digit() && !syllable.is_empty() {
            result.push_str(&numbered_syllable_to_marked(&syllable, character));
            syllable.clear();
        } else {
            result.push_str(&replace_v_with_umlaut(&syllable));
            syllable.clear();
            result.push(character);
        }
    }

    result.push_str(&replace_v_with_umlaut(&syllable));
    result
}

fn pinyin_marks_to_numbers(text: &str) -> String {
    let mut result = String::new();
    let mut syllable = String::new();

    for character in text.chars() {
        if is_pinyin_letter(character) || accented_vowel_data(character).is_some() {
            syllable.push(character);
        } else {
            result.push_str(&marked_syllable_to_numbered(&syllable));
            syllable.clear();
            result.push(character);
        }
    }

    result.push_str(&marked_syllable_to_numbered(&syllable));
    result
}

fn numbered_syllable_to_marked(syllable: &str, tone_number: char) -> String {
    let tone = tone_number.to_digit(10).unwrap_or(5) as u8;
    let normalized = replace_v_with_umlaut(syllable);

    if !(1..=4).contains(&tone) {
        return normalized;
    }

    let Some(mark_index) = vowel_to_mark(&normalized) else {
        return normalized;
    };

    normalized
        .chars()
        .enumerate()
        .map(|(index, character)| {
            if index == mark_index {
                marked_vowel(character, tone).unwrap_or(character)
            } else {
                character
            }
        })
        .collect()
}

fn marked_syllable_to_numbered(syllable: &str) -> String {
    let mut tone = None;
    let mut normalized = String::new();

    for character in syllable.chars() {
        if let Some((base, character_tone)) = accented_vowel_data(character) {
            normalized.push(base);
            tone = Some(character_tone);
        } else {
            normalized.push(character);
        }
    }

    if let Some(tone) = tone {
        normalized.push(char::from_digit(tone as u32, 10).unwrap());
    }

    normalized
}

fn vowel_to_mark(syllable: &str) -> Option<usize> {
    let chars = syllable.chars().collect::<Vec<_>>();

    for preferred in ['a', 'A', 'e', 'E'] {
        if let Some(index) = chars.iter().position(|character| *character == preferred) {
            return Some(index);
        }
    }

    for (index, pair) in chars.windows(2).enumerate() {
        if matches!(pair, ['o', 'u'] | ['O', 'u'] | ['o', 'U'] | ['O', 'U']) {
            return Some(index);
        }
    }

    chars.iter().rposition(|character| is_vowel(*character))
}

fn is_pinyin_letter(character: char) -> bool {
    character.is_ascii_alphabetic() || matches!(character, 'ü' | 'Ü')
}

fn is_vowel(character: char) -> bool {
    matches!(
        character,
        'a' | 'A' | 'e' | 'E' | 'i' | 'I' | 'o' | 'O' | 'u' | 'U' | 'ü' | 'Ü'
    )
}

fn replace_v_with_umlaut(text: &str) -> String {
    text.chars()
        .map(|character| match character {
            'v' => 'ü',
            'V' => 'Ü',
            _ => character,
        })
        .collect()
}

fn marked_vowel(vowel: char, tone: u8) -> Option<char> {
    let vowels = match vowel {
        'a' => ['ā', 'á', 'ǎ', 'à'],
        'A' => ['Ā', 'Á', 'Ǎ', 'À'],
        'e' => ['ē', 'é', 'ě', 'è'],
        'E' => ['Ē', 'É', 'Ě', 'È'],
        'i' => ['ī', 'í', 'ǐ', 'ì'],
        'I' => ['Ī', 'Í', 'Ǐ', 'Ì'],
        'o' => ['ō', 'ó', 'ǒ', 'ò'],
        'O' => ['Ō', 'Ó', 'Ǒ', 'Ò'],
        'u' => ['ū', 'ú', 'ǔ', 'ù'],
        'U' => ['Ū', 'Ú', 'Ǔ', 'Ù'],
        'ü' => ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
        'Ü' => ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ'],
        _ => return None,
    };

    vowels.get((tone - 1) as usize).copied()
}

fn accented_vowel_data(vowel: char) -> Option<(char, u8)> {
    match vowel {
        'ā' => Some(('a', 1)),
        'á' => Some(('a', 2)),
        'ǎ' => Some(('a', 3)),
        'à' => Some(('a', 4)),
        'Ā' => Some(('A', 1)),
        'Á' => Some(('A', 2)),
        'Ǎ' => Some(('A', 3)),
        'À' => Some(('A', 4)),
        'ē' => Some(('e', 1)),
        'é' => Some(('e', 2)),
        'ě' => Some(('e', 3)),
        'è' => Some(('e', 4)),
        'Ē' => Some(('E', 1)),
        'É' => Some(('E', 2)),
        'Ě' => Some(('E', 3)),
        'È' => Some(('E', 4)),
        'ī' => Some(('i', 1)),
        'í' => Some(('i', 2)),
        'ǐ' => Some(('i', 3)),
        'ì' => Some(('i', 4)),
        'Ī' => Some(('I', 1)),
        'Í' => Some(('I', 2)),
        'Ǐ' => Some(('I', 3)),
        'Ì' => Some(('I', 4)),
        'ō' => Some(('o', 1)),
        'ó' => Some(('o', 2)),
        'ǒ' => Some(('o', 3)),
        'ò' => Some(('o', 4)),
        'Ō' => Some(('O', 1)),
        'Ó' => Some(('O', 2)),
        'Ǒ' => Some(('O', 3)),
        'Ò' => Some(('O', 4)),
        'ū' => Some(('u', 1)),
        'ú' => Some(('u', 2)),
        'ǔ' => Some(('u', 3)),
        'ù' => Some(('u', 4)),
        'Ū' => Some(('U', 1)),
        'Ú' => Some(('U', 2)),
        'Ǔ' => Some(('U', 3)),
        'Ù' => Some(('U', 4)),
        'ǖ' => Some(('ü', 1)),
        'ǘ' => Some(('ü', 2)),
        'ǚ' => Some(('ü', 3)),
        'ǜ' => Some(('ü', 4)),
        'Ǖ' => Some(('Ü', 1)),
        'Ǘ' => Some(('Ü', 2)),
        'Ǚ' => Some(('Ü', 3)),
        'Ǜ' => Some(('Ü', 4)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word_data(segment: &PinyinSegment) -> &WordData {
        segment.word_data.as_ref().unwrap()
    }

    #[test]
    fn test_pinyinify_single_character() {
        let result = pinyinify("你".to_string());

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].source, "你");
        assert_eq!(word_data(&result[0]).pinyin_marks, "nǐ");
        assert_eq!(word_data(&result[0]).tone_marks, vec![3]);
    }

    #[test]
    fn test_pinyinify_sentence() {
        let result = pinyinify("今天天气不错".to_string());
        let sources = result
            .iter()
            .map(|segment| segment.source.as_str())
            .collect::<Vec<_>>();

        assert_eq!(sources, vec!["今天", "天气", "不错"]);
        assert!(result.iter().all(|segment| segment.word_data.is_some()));
    }

    #[test]
    fn test_pinyinify_mixed_content() {
        let result = pinyinify("Hello你好world".to_string());

        assert_eq!(result.len(), 3);
        assert_eq!(result[0].source, "Hello");
        assert!(result[0].word_data.is_none());
        assert_eq!(result[1].source, "你好");
        assert!(result[1].word_data.is_some());
        assert_eq!(result[2].source, "world");
        assert!(result[2].word_data.is_none());
    }

    #[test]
    fn test_pinyinify_punctuation() {
        let result = pinyinify("你好！再见。".to_string());
        let sources = result
            .iter()
            .map(|segment| segment.source.as_str())
            .collect::<Vec<_>>();

        assert_eq!(sources, vec!["你好", "！", "再见", "。"]);
        assert!(result[1].word_data.is_none());
        assert!(result[3].word_data.is_none());
    }

    #[test]
    fn test_pinyinify_english_name_in_chinese() {
        let result = pinyinify("我叫Preston".to_string());

        assert_eq!(result.last().unwrap().source, "Preston");
        assert!(result.last().unwrap().word_data.is_none());
    }

    #[test]
    fn test_pinyinify_empty() {
        assert_eq!(pinyinify("".to_string()), Vec::<PinyinSegment>::new());
    }

    #[test]
    fn test_convert_to_simplified() {
        assert_eq!(
            convert_characters("繁體字".to_string(), ConvertDirection::ToSimplified).text,
            "繁体字"
        );
    }

    #[test]
    fn test_convert_to_traditional() {
        assert_eq!(
            convert_characters("繁体字".to_string(), ConvertDirection::ToTraditional).text,
            "繁體字"
        );
    }

    #[test]
    fn test_convert_automatic_uses_opposite_script() {
        let simplified = convert_characters("繁体字".to_string(), ConvertDirection::Automatic);
        let traditional = convert_characters("繁體字".to_string(), ConvertDirection::Automatic);

        assert_eq!(simplified.text, "繁體字");
        assert_eq!(simplified.detected_script, CharacterScript::Simplified);
        assert_eq!(simplified.direction, ConvertDirection::ToTraditional);
        assert_eq!(traditional.text, "繁体字");
        assert_eq!(traditional.detected_script, CharacterScript::Traditional);
        assert_eq!(traditional.direction, ConvertDirection::ToSimplified);
    }

    #[test]
    fn test_prettify_to_marks() {
        assert_eq!(
            prettify_pinyin("ni3 hao3".to_string(), PrettifyDirection::ToMarks).text,
            "nǐ hǎo"
        );
    }

    #[test]
    fn test_prettify_to_numbers() {
        assert_eq!(
            prettify_pinyin("nǐ hǎo".to_string(), PrettifyDirection::ToNumbers).text,
            "ni3 hao3"
        );
    }

    #[test]
    fn test_prettify_all_tones() {
        assert_eq!(
            prettify_pinyin(
                "ma1 ma2 ma3 ma4 ma5 ma".to_string(),
                PrettifyDirection::ToMarks
            )
            .text,
            "mā má mǎ mà ma ma"
        );
        assert_eq!(
            prettify_pinyin("mā má mǎ mà ma".to_string(), PrettifyDirection::ToNumbers).text,
            "ma1 ma2 ma3 ma4 ma"
        );
    }

    #[test]
    fn test_prettify_lv() {
        assert_eq!(
            prettify_pinyin("lv4".to_string(), PrettifyDirection::ToMarks).text,
            "lǜ"
        );
    }

    #[test]
    fn test_prettify_automatic_uses_opposite_style() {
        let marks = prettify_pinyin("nǐ hǎo".to_string(), PrettifyDirection::Automatic);
        let numbers = prettify_pinyin("ni3 hao3".to_string(), PrettifyDirection::Automatic);

        assert_eq!(marks.text, "ni3 hao3");
        assert_eq!(marks.detected_style, PinyinStyle::Marks);
        assert_eq!(marks.direction, PrettifyDirection::ToNumbers);
        assert_eq!(numbers.text, "nǐ hǎo");
        assert_eq!(numbers.detected_style, PinyinStyle::Numbers);
        assert_eq!(numbers.direction, PrettifyDirection::ToMarks);
    }

    #[test]
    fn test_prettify_round_trip() {
        let original = "nǐ hǎo, lǜ chá";
        let numbered = prettify_pinyin(original.to_string(), PrettifyDirection::ToNumbers).text;

        assert_eq!(
            prettify_pinyin(numbered, PrettifyDirection::ToMarks).text,
            original
        );
    }
}
