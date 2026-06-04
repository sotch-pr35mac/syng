use chinese_dictionary as dictionary;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::OnceLock;

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

/// A single rendered chunk of free-form pinyin. `tone` is `Some(1..=5)` for a
/// recognized syllable (5 = neutral) and `None` for separators, punctuation, or
/// text that is not a pinyin syllable.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct PinyinToken {
    pub text: String,
    pub tone: Option<u8>,
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
        if !contains_cjk(token) {
            continue;
        }

        let Some(relative_position) = text[cursor..].find(token) else {
            continue;
        };
        let token_start = cursor + relative_position;

        if token_start > cursor {
            push_plain_segment(&mut segments, &text[cursor..token_start]);
        }

        let token_end = token_start + token.len();
        let word_data = dictionary::query_by_chinese(token)
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
            CharacterScript::Simplified | CharacterScript::Unknown => {
                ConvertDirection::ToTraditional
            }
        },
        explicit_direction => explicit_direction,
    };
    // `resolved_direction` is always explicit here (the match above maps Automatic away).
    let text = match resolved_direction {
        ConvertDirection::ToSimplified => dictionary::traditional_to_simplified(&text).to_string(),
        _ => dictionary::simplified_to_traditional(&text).to_string(),
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
    // `resolved_direction` is always explicit here (the match above maps Automatic away).
    let text = match resolved_direction {
        PrettifyDirection::ToMarks => pinyin_numbers_to_marks(&text),
        _ => pinyin_marks_to_numbers(&text),
    };

    PrettifyPinyinResult {
        text,
        direction: resolved_direction,
        detected_style,
    }
}

/// Tokenizes free-form pinyin (tone marks and/or tone numbers) into syllables so
/// the UI can color each one. Non-pinyin characters pass through as untoned tokens.
#[tauri::command]
pub fn tokenize_pinyin(text: String) -> Vec<PinyinToken> {
    let mut tokens = Vec::new();
    let mut run = String::new();
    let mut passthrough = String::new();

    for character in text.chars() {
        if is_pinyin_run_char(character) || character.is_ascii_digit() {
            flush_passthrough(&mut passthrough, &mut tokens);
            run.push(character);
        } else {
            tokenize_pinyin_run(&run, &mut tokens);
            run.clear();
            passthrough.push(character);
        }
    }

    tokenize_pinyin_run(&run, &mut tokens);
    flush_passthrough(&mut passthrough, &mut tokens);
    tokens
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
    if text
        .chars()
        .any(|character| accented_vowel_data(character).is_some())
    {
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
    let mut run = String::new();

    for character in text.chars() {
        if is_pinyin_run_char(character) {
            run.push(character);
        } else {
            result.push_str(&marked_run_to_numbered(&run));
            run.clear();
            result.push(character);
        }
    }

    result.push_str(&marked_run_to_numbered(&run));
    result
}

/// Converts a run of tone-marked pinyin to tone numbers, splitting it into
/// syllables first so space-less words (`Běijīng` -> `Bei3jing1`) convert correctly.
fn marked_run_to_numbered(run: &str) -> String {
    let (base, syllables) = split_marked_run(run);
    let mut result = String::new();

    for syllable in syllables {
        result.push_str(&char_slice(&base, syllable.start, syllable.end));
        if (1..=4).contains(&syllable.tone) {
            result.push(char::from_digit(syllable.tone as u32, 10).unwrap());
        }
    }

    result
}

/// Tokenizes a contiguous run of pinyin characters (letters, accented vowels,
/// tone digits, apostrophes) into `PinyinToken`s. Used by `tokenize_pinyin`.
fn tokenize_pinyin_run(run: &str, tokens: &mut Vec<PinyinToken>) {
    let cells = run.char_indices().collect::<Vec<_>>();
    let cell_count = cells.len();
    let byte_end_of = |index: usize| {
        if index + 1 < cell_count {
            cells[index + 1].0
        } else {
            run.len()
        }
    };

    let mut index = 0;
    while index < cell_count {
        let (byte_start, character) = cells[index];

        // Apostrophes and stray digits pass through untoned.
        if is_pinyin_apostrophe(character) || character.is_ascii_digit() {
            tokens.push(PinyinToken {
                text: run[byte_start..byte_end_of(index)].to_string(),
                tone: None,
            });
            index += 1;
            continue;
        }

        // Gather a maximal sub-run of letters/accented vowels (no digits/apostrophes).
        let letters_start = byte_start;
        while index < cell_count
            && (is_pinyin_letter(cells[index].1) || accented_vowel_data(cells[index].1).is_some())
        {
            index += 1;
        }
        let letters_end = if index < cell_count {
            cells[index].0
        } else {
            run.len()
        };
        let letters = &run[letters_start..letters_end];

        // A single tone digit right after the letters tones the final syllable.
        let trailing_digit = if index < cell_count && matches!(cells[index].1, '1'..='5') {
            let digit_character = cells[index].1;
            index += 1;
            Some(digit_character)
        } else {
            None
        };

        let (_, syllables) = split_marked_run(letters);
        let syllable_count = syllables.len();
        for (position, syllable) in syllables.into_iter().enumerate() {
            let original = char_slice(letters, syllable.start, syllable.end);
            let is_last = position + 1 == syllable_count;
            let (text, tone) = if let (true, Some(digit_character)) = (is_last, trailing_digit) {
                let digit = digit_character.to_digit(10).unwrap() as u8;
                (format!("{original}{digit_character}"), Some(digit))
            } else if (1..=4).contains(&syllable.tone) {
                (original, Some(syllable.tone))
            } else if syllable.matched {
                // Recognized syllable with no explicit tone renders as neutral (tone 5).
                (original, Some(NEUTRAL_TONE))
            } else {
                (original, None)
            };
            tokens.push(PinyinToken { text, tone });
        }
    }
}

fn flush_passthrough(passthrough: &mut String, tokens: &mut Vec<PinyinToken>) {
    if passthrough.is_empty() {
        return;
    }
    tokens.push(PinyinToken {
        text: std::mem::take(passthrough),
        tone: None,
    });
}

/// One syllable located within a run: `start..end` are char indices, `tone` is the
/// marked tone (0 = none), and `matched` is whether it is a real pinyin syllable.
struct RunSyllable {
    start: usize,
    end: usize,
    tone: u8,
    matched: bool,
}

/// Strips tone marks from a run, then segments the base letters into syllables and
/// re-attaches each syllable's marked tone. Char indices are valid for both the
/// returned base string and the original `run` (mark-stripping is one-to-one).
fn split_marked_run(run: &str) -> (String, Vec<RunSyllable>) {
    let mut base = String::new();
    let mut char_tones = Vec::new();
    for character in run.chars() {
        match accented_vowel_data(character) {
            Some((stripped, tone)) => {
                base.push(stripped);
                char_tones.push(tone);
            }
            None => {
                base.push(character);
                char_tones.push(0);
            }
        }
    }

    let syllables = syllabify_char_ranges(&base)
        .into_iter()
        .map(|(start, end, matched)| {
            let tone = (start..end)
                .find_map(|char_index| {
                    let tone = char_tones[char_index];
                    (1..=4).contains(&tone).then_some(tone)
                })
                .unwrap_or(0);
            RunSyllable {
                start,
                end,
                tone,
                matched,
            }
        })
        .collect();

    (base, syllables)
}

/// Greedy maximal-munch segmentation of a toneless pinyin letter run. Returns
/// `(char_start, char_end, matched)` ranges covering every char: `matched` is true
/// for table syllables, false for the single-char fallback on unrecognized input.
/// Apostrophes are hard separators emitted as their own (unmatched) range.
fn syllabify_char_ranges(run: &str) -> Vec<(usize, usize, bool)> {
    let cells = run
        .chars()
        .map(|character| {
            (
                normalize_lookup_char(character),
                is_pinyin_apostrophe(character),
            )
        })
        .collect::<Vec<_>>();
    let cell_count = cells.len();
    let mut ranges = Vec::new();
    let mut index = 0;

    while index < cell_count {
        if cells[index].1 {
            ranges.push((index, index + 1, false));
            index += 1;
            continue;
        }

        // The munch window stops at the next apostrophe (a hard syllable boundary).
        let mut window_end = index;
        while window_end < cell_count && !cells[window_end].1 {
            window_end += 1;
        }

        let max_len = (window_end - index).min(MAX_SYLLABLE_LEN);
        let mut matched_len = 0;
        for length in (1..=max_len).rev() {
            let candidate = cells[index..index + length]
                .iter()
                .map(|(character, _)| *character)
                .collect::<String>();
            if syllable_set().contains(candidate.as_str()) {
                matched_len = length;
                break;
            }
        }

        if matched_len > 0 {
            ranges.push((index, index + matched_len, true));
            index += matched_len;
        } else {
            ranges.push((index, index + 1, false));
            index += 1;
        }
    }

    ranges
}

fn char_slice(text: &str, start: usize, end: usize) -> String {
    text.chars().skip(start).take(end - start).collect()
}

fn is_pinyin_run_char(character: char) -> bool {
    is_pinyin_letter(character)
        || accented_vowel_data(character).is_some()
        || is_pinyin_apostrophe(character)
}

fn is_pinyin_apostrophe(character: char) -> bool {
    matches!(character, '\'' | '\u{2019}')
}

/// Lowercases for table lookup and folds `v`/`ü` spellings to a single form.
fn normalize_lookup_char(character: char) -> char {
    match character {
        'v' | 'V' => 'ü',
        'Ü' => 'ü',
        other => other.to_ascii_lowercase(),
    }
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

/// Neutral tone (the fifth tone). Stored explicitly so a recognized but unmarked
/// syllable still renders with the neutral color rather than no color.
const NEUTRAL_TONE: u8 = 5;

/// Longest entry in `PINYIN_SYLLABLES` (e.g. `zhuang`, `chuang`, `shuang`).
const MAX_SYLLABLE_LEN: usize = 6;

/// Canonical toneless Mandarin pinyin syllables, lowercase with `ü` written out.
/// Drives the maximal-munch syllabifier (`syllabify_char_ranges`).
static PINYIN_SYLLABLES: &[&str] = &[
    // zero-initial finals
    "a", "ai", "an", "ang", "ao", "e", "ei", "en", "eng", "er", "o", "ou", //
    // y / w
    "ya", "yan", "yang", "yao", "ye", "yi", "yin", "ying", "yo", "yong", "you", "yu", "yuan", "yue",
    "yun", "wa", "wai", "wan", "wang", "wei", "wen", "weng", "wo", "wu", //
    // b
    "ba", "bai", "ban", "bang", "bao", "bei", "ben", "beng", "bi", "bian", "biao", "bie", "bin",
    "bing", "bo", "bu", //
    // p
    "pa", "pai", "pan", "pang", "pao", "pei", "pen", "peng", "pi", "pian", "piao", "pie", "pin",
    "ping", "po", "pou", "pu", //
    // m
    "ma", "mai", "man", "mang", "mao", "me", "mei", "men", "meng", "mi", "mian", "miao", "mie",
    "min", "ming", "miu", "mo", "mou", "mu", //
    // f
    "fa", "fan", "fang", "fei", "fen", "feng", "fo", "fou", "fu", //
    // d
    "da", "dai", "dan", "dang", "dao", "de", "dei", "den", "deng", "di", "dia", "dian", "diao",
    "die", "ding", "diu", "dong", "dou", "du", "duan", "dui", "dun", "duo", //
    // t
    "ta", "tai", "tan", "tang", "tao", "te", "tei", "teng", "ti", "tian", "tiao", "tie", "ting",
    "tong", "tou", "tu", "tuan", "tui", "tun", "tuo", //
    // n
    "na", "nai", "nan", "nang", "nao", "ne", "nei", "nen", "neng", "ni", "nian", "niang", "niao",
    "nie", "nin", "ning", "niu", "nong", "nou", "nu", "nuan", "nuo", "nü", "nüe", //
    // l
    "la", "lai", "lan", "lang", "lao", "le", "lei", "leng", "li", "lia", "lian", "liang", "liao",
    "lie", "lin", "ling", "liu", "lo", "long", "lou", "lu", "luan", "lun", "luo", "lü",
    "lüe", //
    // g
    "ga", "gai", "gan", "gang", "gao", "ge", "gei", "gen", "geng", "gong", "gou", "gu", "gua",
    "guai", "guan", "guang", "gui", "gun", "guo", //
    // k
    "ka", "kai", "kan", "kang", "kao", "ke", "kei", "ken", "keng", "kong", "kou", "ku", "kua",
    "kuai", "kuan", "kuang", "kui", "kun", "kuo", //
    // h
    "ha", "hai", "han", "hang", "hao", "he", "hei", "hen", "heng", "hong", "hou", "hu", "hua",
    "huai", "huan", "huang", "hui", "hun", "huo", //
    // j
    "ji", "jia", "jian", "jiang", "jiao", "jie", "jin", "jing", "jiong", "jiu", "ju", "juan", "jue",
    "jun", //
    // q
    "qi", "qia", "qian", "qiang", "qiao", "qie", "qin", "qing", "qiong", "qiu", "qu", "quan", "que",
    "qun", //
    // x
    "xi", "xia", "xian", "xiang", "xiao", "xie", "xin", "xing", "xiong", "xiu", "xu", "xuan", "xue",
    "xun", //
    // zh
    "zha", "zhai", "zhan", "zhang", "zhao", "zhe", "zhei", "zhen", "zheng", "zhi", "zhong", "zhou",
    "zhu", "zhua", "zhuai", "zhuan", "zhuang", "zhui", "zhun", "zhuo", //
    // ch
    "cha", "chai", "chan", "chang", "chao", "che", "chen", "cheng", "chi", "chong", "chou", "chu",
    "chua", "chuai", "chuan", "chuang", "chui", "chun", "chuo", //
    // sh
    "sha", "shai", "shan", "shang", "shao", "she", "shei", "shen", "sheng", "shi", "shou", "shu",
    "shua", "shuai", "shuan", "shuang", "shui", "shun", "shuo", //
    // r
    "ran", "rang", "rao", "re", "ren", "reng", "ri", "rong", "rou", "ru", "rua", "ruan", "rui",
    "run", "ruo", //
    // z
    "za", "zai", "zan", "zang", "zao", "ze", "zei", "zen", "zeng", "zi", "zong", "zou", "zu",
    "zuan", "zui", "zun", "zuo", //
    // c
    "ca", "cai", "can", "cang", "cao", "ce", "cen", "ceng", "ci", "cong", "cou", "cu", "cuan",
    "cui", "cun", "cuo", //
    // s
    "sa", "sai", "san", "sang", "sao", "se", "sen", "seng", "si", "song", "sou", "su", "suan",
    "sui", "sun", "suo", //
    // interjections / colloquial
    "m", "n", "ng", "hm", "hng",
];

fn syllable_set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| PINYIN_SYLLABLES.iter().copied().collect())
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

    fn split(run: &str) -> Vec<String> {
        syllabify_char_ranges(run)
            .into_iter()
            .map(|(start, end, _)| char_slice(run, start, end))
            .collect()
    }

    fn tok(text: &str, tone: Option<u8>) -> PinyinToken {
        PinyinToken {
            text: text.to_string(),
            tone,
        }
    }

    #[test]
    fn test_syllabify_splits_run_together_words() {
        assert_eq!(split("beijing"), vec!["bei", "jing"]);
        assert_eq!(split("nihao"), vec!["ni", "hao"]);
        assert_eq!(split("zhuang"), vec!["zhuang"]);
    }

    #[test]
    fn test_syllabify_greedy_and_apostrophe() {
        assert_eq!(split("xian"), vec!["xian"]);
        assert_eq!(split("xi'an"), vec!["xi", "'", "an"]);
        assert_eq!(split("fangan"), vec!["fang", "an"]);
    }

    #[test]
    fn test_syllabify_normalizes_v_and_case() {
        assert_eq!(split("lv"), vec!["lv"]);
        assert_eq!(split("nv"), vec!["nv"]);
        assert_eq!(split("BeiJing"), vec!["Bei", "Jing"]);
    }

    #[test]
    fn test_syllabify_keeps_er_and_tolerates_junk() {
        assert_eq!(split("haier"), vec!["hai", "er"]);
        assert_eq!(split("qq"), vec!["q", "q"]);
    }

    #[test]
    fn test_prettify_marks_to_numbers_space_less() {
        assert_eq!(
            prettify_pinyin("Běijīng".to_string(), PrettifyDirection::ToNumbers).text,
            "Bei3jing1"
        );
        assert_eq!(
            prettify_pinyin("nǐhǎo".to_string(), PrettifyDirection::ToNumbers).text,
            "ni3hao3"
        );
        assert_eq!(
            prettify_pinyin("māma".to_string(), PrettifyDirection::ToNumbers).text,
            "ma1ma"
        );
    }

    #[test]
    fn test_prettify_marks_to_numbers_mixed_punctuation() {
        assert_eq!(
            prettify_pinyin("Nǐhǎo, shìjiè!".to_string(), PrettifyDirection::ToNumbers).text,
            "Ni3hao3, shi4jie4!"
        );
        assert_eq!(
            prettify_pinyin("lǜ".to_string(), PrettifyDirection::ToNumbers).text,
            "lü4"
        );
    }

    #[test]
    fn test_prettify_space_less_round_trip() {
        let numbered = prettify_pinyin("Běijīng".to_string(), PrettifyDirection::ToNumbers).text;

        assert_eq!(
            prettify_pinyin(numbered, PrettifyDirection::ToMarks).text,
            "Běijīng"
        );
    }

    #[test]
    fn test_tokenize_pinyin_numbered() {
        assert_eq!(
            tokenize_pinyin("ni3 hao3 ma5".to_string()),
            vec![
                tok("ni3", Some(3)),
                tok(" ", None),
                tok("hao3", Some(3)),
                tok(" ", None),
                tok("ma5", Some(5)),
            ]
        );
    }

    #[test]
    fn test_tokenize_pinyin_marked() {
        assert_eq!(
            tokenize_pinyin("Běijīng".to_string()),
            vec![tok("Běi", Some(3)), tok("jīng", Some(1))]
        );
        assert_eq!(
            tokenize_pinyin("nǐ hǎo".to_string()),
            vec![tok("nǐ", Some(3)), tok(" ", None), tok("hǎo", Some(3))]
        );
    }

    #[test]
    fn test_tokenize_pinyin_neutral_and_apostrophe() {
        assert_eq!(tokenize_pinyin("ma".to_string()), vec![tok("ma", Some(5))]);
        assert_eq!(
            tokenize_pinyin("xi'an".to_string()),
            vec![tok("xi", Some(5)), tok("'", None), tok("an", Some(5))]
        );
    }

    #[test]
    fn test_tokenize_pinyin_passes_through_non_pinyin() {
        assert_eq!(
            tokenize_pinyin("世界 ni3".to_string()),
            vec![tok("世界 ", None), tok("ni3", Some(3))]
        );
    }
}
