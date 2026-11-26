//! Local Pleco text and observed format-2 XML vocabulary import.
//! Preparation preserves category memberships and never mutates learner data.
use quick_xml::{events::Event, Reader, XmlVersion};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    io::Write,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FsExt, OpenOptions};

const MAX_PREVIEW_BYTES: usize = 32 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
pub struct PlecoRow {
    line: usize,
    original: String,
    category: String,
    headword: String,
    pronunciation: String,
    definition: String,
    candidates: Vec<chinese_dictionary::LexicalUnit>,
    selected: Option<String>,
    reason: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct PlecoPreview {
    pub source_format: &'static str,
    file_name: String,
    rows: Vec<PlecoRow>,
}

fn resolve(
    headword: &str,
    pronunciation: &str,
) -> (
    Vec<chinese_dictionary::LexicalUnit>,
    Option<String>,
    Option<String>,
) {
    let (simplified, traditional) = if let Some((simplified, rest)) = headword.split_once('[') {
        let Some(traditional) = rest.strip_suffix(']') else {
            return (vec![], None, Some("Malformed character pair.".into()));
        };
        if simplified.is_empty() || traditional.is_empty() || traditional.contains(['[', ']']) {
            return (vec![], None, Some("Malformed character pair.".into()));
        }
        (simplified, Some(traditional))
    } else {
        (headword, None)
    };
    let mut seen = HashSet::new();
    let mut candidates: Vec<_> = chinese_dictionary::query_by_simplified(simplified)
        .into_iter()
        .chain(chinese_dictionary::query_by_traditional(simplified))
        .filter(|unit| {
            traditional.is_none_or(|traditional| {
                unit.simplified() == simplified && unit.traditional() == traditional
            })
        })
        .filter(|unit| seen.insert(unit.id()))
        .map(chinese_dictionary::LexicalUnitRef::to_owned)
        .collect();
    if candidates.is_empty() {
        return (candidates, None, Some("No exact dictionary entry.".into()));
    }
    if !pronunciation.is_empty() {
        // Pleco separates syllables with spaces; the dictionary index expects a whole word.
        let compact: String = pronunciation
            .chars()
            .filter(|character| !character.is_whitespace())
            .collect();
        let readings: HashSet<_> = chinese_dictionary::query_by_pinyin(&compact)
            .into_iter()
            .map(|unit| unit.id())
            .collect();
        let matching: Vec<_> = candidates
            .iter()
            .filter(|unit| readings.contains(&unit.id))
            .cloned()
            .collect();
        if matching.is_empty() {
            return (
                candidates,
                None,
                Some("Pronunciation differs or is unsupported. Choose an entry or skip.".into()),
            );
        }
        candidates = matching;
    }
    let selected = (candidates.len() == 1).then(|| candidates[0].id.to_string());
    let reason = selected
        .is_none()
        .then(|| "Choose the intended dictionary entry or skip.".into());
    (candidates, selected, reason)
}

pub(super) fn parse(content: &str, file_name: String) -> Result<PlecoPreview, String> {
    let content = content.trim_start_matches('\u{feff}');
    if content.contains('\0') || content.trim_start().starts_with(['<', '{', '[']) {
        return Err("Choose a Pleco UTF-8 text export, not XML or a database backup.".into());
    }
    let fallback = std::path::Path::new(&file_name)
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Imported Pleco List");
    let mut category = fallback.to_string();
    let mut rows = vec![];
    let mut preview_bytes = 0usize;
    for (index, original) in content
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .enumerate()
    {
        if original.trim().is_empty() {
            continue;
        }
        if let Some(name) = original.trim().strip_prefix("//") {
            category = if name.trim().is_empty() {
                fallback.into()
            } else {
                name.trim().into()
            };
            continue;
        }
        let mut fields = original.splitn(3, '\t');
        let headword = fields.next().unwrap_or_default().trim();
        let pronunciation = fields.next().unwrap_or_default().trim();
        let definition = fields.next().unwrap_or_default().trim();
        let (candidates, selected, reason) = resolve(headword, pronunciation);
        let row = PlecoRow {
            line: index + 1,
            original: original.into(),
            category: category.clone(),
            headword: headword.into(),
            pronunciation: pronunciation.into(),
            definition: definition.into(),
            candidates,
            selected,
            reason,
        };
        // Short records can expand into large dictionary candidate payloads; category
        // names also repeat per row. Bound review data before retaining another row.
        let row_bytes = serde_json::to_vec(&row)
            .map_err(|_| "Could not prepare the Pleco text preview.")?
            .len();
        preview_bytes = preview_bytes.saturating_add(row_bytes);
        if preview_bytes > MAX_PREVIEW_BYTES {
            return Err("This text file expands into too much review data. Export fewer categories at a time.".into());
        }
        rows.push(row);
    }
    if rows.is_empty() {
        return Err("This file contains no vocabulary records.".into());
    }
    Ok(PlecoPreview {
        source_format: "text",
        file_name,
        rows,
    })
}

const XML_STRUCTURE_ERROR: &str =
    "This Pleco XML structure is not supported. Export a UTF-8 text file from Pleco instead.";

#[derive(Default)]
struct XmlCard {
    line: usize,
    chinese: bool,
    entry_seen: bool,
    simplified: Option<String>,
    traditional: Option<String>,
    pronunciation: Option<String>,
    supported_reading: bool,
    definition: Option<String>,
    categories: Vec<String>,
}

/// Reads the observed format-2 vocabulary subset. Unknown structures fail rather than
/// silently discarding category membership or interpreting dictionary IDs as Syng IDs.
/// DTDs and custom entities are forbidden; no external resources are ever resolved.
pub(super) fn parse_xml(content: &str, file_name: String) -> Result<PlecoPreview, String> {
    if content.len() > 10 * 1024 * 1024 {
        return Err("The file exceeds 10 MiB. Export fewer categories at a time.".into());
    }
    if content.chars().any(|character| {
        !matches!(character as u32,
        0x9 | 0xA | 0xD | 0x20..=0xD7FF | 0xE000..=0xFFFD | 0x10000..=0x10FFFF)
    }) {
        return Err("The XML contains invalid characters.".into());
    }
    let content = content.trim_start_matches('\u{feff}');
    let fallback = std::path::Path::new(&file_name)
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Imported Pleco List");
    let mut reader = Reader::from_str(content);
    reader.config_mut().expand_empty_elements = true;
    reader.config_mut().check_comments = true;
    let mut path: Vec<String> = vec![];
    let mut root_seen = false;
    let mut declaration_seen = false;
    let mut categories_seen = false;
    let mut cards_seen = false;
    let mut categories = HashSet::new();
    let mut assigned_categories = HashSet::new();
    let mut card_count = 0;
    let mut preview_bytes = 0usize;
    let mut card = XmlCard::default();
    let mut field = String::new();
    let mut field_kind = String::new();
    let mut rows = vec![];
    let mut line = 1;
    loop {
        let before = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|_| "The Pleco XML file is malformed.")?;
        let event_line = line;
        let after = reader.buffer_position() as usize;
        line += content.as_bytes()[before..after]
            .iter()
            .filter(|byte| **byte == b'\n')
            .count();
        match event {
            Event::Start(element) => {
                let name = std::str::from_utf8(element.name().as_ref())
                    .map_err(|_| XML_STRUCTURE_ERROR)?
                    .to_owned();
                let mut attributes = HashMap::new();
                for attribute in element.attributes() {
                    let attribute =
                        attribute.map_err(|_| "The Pleco XML file has invalid attributes.")?;
                    let key = std::str::from_utf8(attribute.key.as_ref())
                        .map_err(|_| XML_STRUCTURE_ERROR)?;
                    let value = attribute
                        .decoded_and_normalized_value(XmlVersion::Explicit1_0, reader.decoder())
                        .map_err(|_| "The Pleco XML file has invalid attribute values.")?;
                    attributes.insert(key.to_owned(), value.into_owned());
                }
                let attribute = |key: &str| attributes.get(key).map(String::as_str);
                match (path.last().map(String::as_str), name.as_str()) {
                    (None, "plecoflash") if !root_seen => {
                        if attribute("formatversion") != Some("2") {
                            return Err("Only Pleco XML format version 2 is supported. Export a UTF-8 text file instead.".into());
                        }
                        root_seen = true;
                    }
                    (Some("plecoflash"), "categories") if !categories_seen => {
                        categories_seen = true
                    }
                    (Some("plecoflash"), "cards") if !cards_seen => cards_seen = true,
                    (Some("categories"), "category") => {
                        let name = attribute("name")
                            .map(str::trim)
                            .filter(|name| !name.is_empty())
                            .ok_or("A Pleco XML category has no name.")?;
                        if !categories.insert(name.to_owned()) {
                            return Err("The Pleco XML repeats a category declaration.".into());
                        }
                    }
                    (Some("cards"), "card") => {
                        card_count += 1;
                        card = XmlCard {
                            line: event_line,
                            chinese: attribute("language") == Some("chinese"),
                            ..Default::default()
                        };
                    }
                    (Some("card"), "entry") if !card.entry_seen => card.entry_seen = true,
                    (Some("entry"), "headword") => {
                        let charset = attribute("charset").ok_or(XML_STRUCTURE_ERROR)?;
                        match charset {
                            "sc" if card.simplified.is_none() => {
                                card.simplified = Some(String::new())
                            }
                            "tc" if card.traditional.is_none() => {
                                card.traditional = Some(String::new())
                            }
                            _ => return Err(XML_STRUCTURE_ERROR.into()),
                        }
                        field_kind = charset.into();
                        field.clear();
                    }
                    (Some("entry"), "pron") if card.pronunciation.is_none() => {
                        card.pronunciation = Some(String::new());
                        card.supported_reading = attribute("type") == Some("hypy")
                            && attribute("tones") == Some("numbers");
                        field_kind = "pron".into();
                        field.clear();
                    }
                    (Some("entry"), "defn") if card.definition.is_none() => {
                        card.definition = Some(String::new());
                        field_kind = "defn".into();
                        field.clear();
                    }
                    (Some("card"), "catassign") => {
                        let name = attribute("category")
                            .map(str::trim)
                            .filter(|name| !name.is_empty())
                            .ok_or("A Pleco XML category assignment has no name.")?;
                        if !card.categories.iter().any(|category| category == name) {
                            card.categories.push(name.to_owned());
                        }
                        assigned_categories.insert(name.to_owned());
                    }
                    (Some("card"), "dictref") => {}
                    _ => return Err(XML_STRUCTURE_ERROR.into()),
                }
                path.push(name);
            }
            Event::End(element) => {
                let name = std::str::from_utf8(element.name().as_ref())
                    .map_err(|_| XML_STRUCTURE_ERROR)?
                    .to_owned();
                if path.pop().as_deref() != Some(name.as_str()) {
                    return Err("The Pleco XML file is malformed.".into());
                }
                match name.as_str() {
                    "headword" | "pron" | "defn" => {
                        let value = field.trim().to_owned();
                        match field_kind.as_str() {
                            "sc" => card.simplified = Some(value),
                            "tc" => card.traditional = Some(value),
                            "pron" => card.pronunciation = Some(value),
                            "defn" => card.definition = Some(value),
                            _ => return Err(XML_STRUCTURE_ERROR.into()),
                        }
                        field_kind.clear();
                        field.clear();
                    }
                    "card" => {
                        let simplified = card.simplified.as_deref().unwrap_or("");
                        let traditional = card.traditional.as_deref().unwrap_or("");
                        let headword = match (simplified.is_empty(), traditional.is_empty()) {
                            (false, false) => format!("{simplified}[{traditional}]"),
                            (false, true) => simplified.to_owned(),
                            (true, false) => traditional.to_owned(),
                            (true, true) => return Err("A Pleco XML card has no readable headword. Export a UTF-8 text file instead.".into()),
                        };
                        let pronunciation = card.pronunciation.as_deref().unwrap_or("").to_owned();
                        let (candidates, mut selected, mut reason) = if card.chinese {
                            resolve(
                                &headword,
                                if card.supported_reading {
                                    &pronunciation
                                } else {
                                    ""
                                },
                            )
                        } else {
                            (
                                vec![],
                                None,
                                Some("Only Chinese vocabulary is supported.".into()),
                            )
                        };
                        if card.chinese
                            && card.pronunciation.is_some()
                            && !card.supported_reading
                            && !candidates.is_empty()
                        {
                            selected = None;
                            reason = Some("This XML pronunciation format is unsupported. Choose an entry or skip.".into());
                        }
                        // Card ordinals distinguish repeated entries so separate cards never
                        // accidentally share a review choice. Reports still contain readable text.
                        let original =
                            format!("XML card {card_count}: {headword}\t{pronunciation}");
                        let row = PlecoRow {
                            line: card.line,
                            original,
                            category: fallback.into(),
                            headword,
                            pronunciation,
                            definition: card.definition.take().unwrap_or_default(),
                            candidates,
                            selected,
                            reason,
                        };
                        // Category expansion repeats review payloads. Bound that expansion,
                        // including dictionary candidates, before allocating duplicate rows.
                        let row_bytes = serde_json::to_vec(&row)
                            .map_err(|_| "Could not prepare the Pleco XML preview.")?
                            .len();
                        preview_bytes = preview_bytes
                            .saturating_add(row_bytes.saturating_mul(card.categories.len().max(1)));
                        if preview_bytes > MAX_PREVIEW_BYTES {
                            return Err("This XML expands into too much review data. Export fewer categories at a time.".into());
                        }
                        // Every membership of a card shares one review choice. Separate
                        // cards retain distinct identities even when their words match.
                        if card.categories.is_empty() {
                            rows.push(row);
                        } else {
                            rows.extend(card.categories.iter().map(|category| PlecoRow {
                                category: category.clone(),
                                ..row.clone()
                            }));
                        }
                    }
                    _ => {}
                }
            }
            Event::Text(text) => {
                let value = text
                    .decode()
                    .map_err(|_| "The XML contains invalid text.")?;
                if !field_kind.is_empty() {
                    field.push_str(&value);
                } else if !value.trim().is_empty() {
                    return Err(XML_STRUCTURE_ERROR.into());
                }
            }
            Event::CData(text) => {
                if field_kind.is_empty() {
                    return Err(XML_STRUCTURE_ERROR.into());
                }
                field.push_str(
                    &text
                        .decode()
                        .map_err(|_| "The XML contains invalid text.")?,
                );
            }
            Event::GeneralRef(reference) => {
                if field_kind.is_empty() {
                    return Err(XML_STRUCTURE_ERROR.into());
                }
                let name = reference
                    .decode()
                    .map_err(|_| "The XML contains an invalid entity.")?;
                // quick-xml's built-in unescape resolves numeric and five predefined XML
                // entities only. It cannot expand custom entities or fetch external data.
                let encoded = format!("&{name};");
                let decoded = quick_xml::escape::unescape(&encoded)
                    .map_err(|_| "Custom XML entities are not supported.")?;
                if decoded.chars().any(|character| {
                    !matches!(character as u32,
                    0x9 | 0xA | 0xD | 0x20..=0xD7FF | 0xE000..=0xFFFD | 0x10000..=0x10FFFF)
                }) {
                    return Err("The XML contains invalid characters.".into());
                }
                field.push_str(&decoded);
            }
            Event::Decl(declaration) if !declaration_seen && !root_seen && before == 0 => {
                if declaration
                    .version()
                    .map_err(|_| "The XML declaration is invalid.")?
                    .as_ref()
                    != b"1.0"
                {
                    return Err("Only XML version 1.0 is supported.".into());
                }
                if let Some(encoding) = declaration.encoding() {
                    let encoding = encoding.map_err(|_| "The XML declaration is invalid.")?;
                    if !encoding.eq_ignore_ascii_case(b"utf-8") {
                        return Err("Export the Pleco XML file using UTF-8 encoding.".into());
                    }
                }
                declaration_seen = true;
            }
            Event::Comment(_) => {}
            Event::DocType(_) => {
                return Err("XML document type declarations are not supported.".into())
            }
            Event::Eof => break,
            _ => return Err(XML_STRUCTURE_ERROR.into()),
        }
    }
    if !path.is_empty() || !root_seen || !cards_seen {
        return Err("The Pleco XML file is incomplete or malformed.".into());
    }
    if rows.is_empty() {
        return Err("This file contains no vocabulary records.".into());
    }
    if !assigned_categories.is_subset(&categories) {
        return Err("A Pleco XML card refers to an undeclared category. Export the file again with Categories enabled.".into());
    }
    Ok(PlecoPreview {
        source_format: "xml",
        file_name,
        rows,
    })
}

#[tauri::command(async)]
pub async fn save_pleco_report(app: tauri::AppHandle, report: String) -> Result<bool, String> {
    let Some(path) = app
        .dialog()
        .file()
        .set_title("Save Pleco Import Report")
        .set_file_name("Pleco import report.txt")
        .add_filter("Text", &["txt"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    app.fs()
        .open(path, options)
        .map_err(|_| "Could not open the report destination.")?
        .write_all(report.as_bytes())
        .map_err(|_| "Could not save the import report.")?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_categories_bom_and_line_endings() {
        let preview = parse(
            "\u{feff}// Textbook/One\r\n你好\tni3 hao3\thello\r// Other\r你好\tni3hao3",
            "Words.txt".into(),
        )
        .unwrap();
        assert_eq!(preview.rows.len(), 2);
        assert_eq!(preview.rows[0].category, "Textbook/One");
        assert_eq!(preview.rows[1].category, "Other");
        assert!(preview.rows[0].selected.is_some());
        assert_eq!(preview.rows[0].selected, preview.rows[1].selected);
    }
    #[test]
    fn never_segments_unknown_phrases_or_ignores_conflicting_readings() {
        assert!(resolve("西瓜你好银行", "").0.is_empty());
        let result = resolve("西瓜", "yin2hang2");
        assert!(!result.0.is_empty());
        assert!(result.1.is_none());
        assert!(resolve("我们[我們]", "wo3men5").0.len() > 0);
        assert!(resolve("我们[", "").0.is_empty());
    }
    #[test]
    fn accepts_script_and_reading_variants_without_guessing() {
        let numbered = resolve("银行[銀行]", "yin2 hang2");
        let marked = resolve("銀行", "yín háng");
        assert!(numbered.1.is_some());
        assert_eq!(numbered.1, marked.1);
        let ambiguous = resolve("行", "");
        assert!(ambiguous.0.len() > 1);
        assert!(ambiguous.1.is_none());
        let preview = parse(
            "西瓜\n\tinvalid\n// Same\n你好\n// Same\n再见",
            "Vocabulary.txt".into(),
        )
        .unwrap();
        assert_eq!(preview.rows[0].category, "Vocabulary");
        assert!(preview.rows[1].candidates.is_empty());
        assert_eq!(preview.rows[2].category, preview.rows[3].category);
    }

    #[test]
    fn empty_and_wrong_formats_fail() {
        for content in ["", "// Empty", "<?xml version=\"1.0\"?>", "a\0b"] {
            assert!(parse(content, "list.txt".into()).is_err());
        }
    }

    #[test]
    fn text_bounds_dictionary_expansion_for_short_records() {
        let preview = parse("行\n", "Words.txt".into()).unwrap();
        let row_bytes = serde_json::to_vec(&preview.rows[0]).unwrap().len();
        let record_count = 32 * 1024 * 1024 / row_bytes + 1;
        let content = "行\n".repeat(record_count);
        assert!(content.len() < 10 * 1024 * 1024);
        assert!(
            matches!(parse(&content, "Words.txt".into()), Err(error) if error.contains("too much review data"))
        );
    }

    #[test]
    fn text_bounds_repeated_category_names_in_review_data() {
        let content = format!("// {}\n{}", "a".repeat(1024 * 1024), "你好\n".repeat(33));
        assert!(content.len() < 10 * 1024 * 1024);
        assert!(
            matches!(parse(&content, "Words.txt".into()), Err(error) if error.contains("too much review data"))
        );
    }
    fn xml_document(cards: &str) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?><plecoflash formatversion="2"><categories/><cards>{cards}</cards></plecoflash>"#
        )
    }

    fn xml_card(simplified: &str, traditional: &str, reading: &str) -> String {
        format!(
            r#"<card language="chinese" created="123" modified="456"><entry><headword charset="sc">{simplified}</headword><headword charset="tc">{traditional}</headword><pron type="hypy" tones="numbers">{reading}</pron></entry><dictref dictid="TEST" entryid="1"/></card>"#
        )
    }

    #[test]
    fn xml_matches_scripts_and_readings_and_keeps_distinct_review_cards() {
        let card = xml_card("银行", "銀行", "yin2hang2");
        let preview =
            parse_xml(&xml_document(&format!("{card}{card}")), "Words.xml".into()).unwrap();
        assert_eq!(preview.source_format, "xml");
        assert_eq!(preview.rows.len(), 2);
        assert_eq!(preview.rows[0].category, "Words");
        assert_eq!(
            preview.rows[0].selected,
            resolve("银行[銀行]", "yin2hang2").1
        );
        assert!(preview.rows[0].selected.is_some());
        assert_ne!(preview.rows[0].original, preview.rows[1].original);
        assert!(preview.rows.iter().all(|row| row.definition.is_empty()));
    }

    #[test]
    fn xml_never_guesses_unsupported_or_conflicting_readings() {
        let conflicting = xml_card("西瓜", "西瓜", "yin2hang2");
        let unsupported = xml_card("西瓜", "西瓜", "sai1gwaa1").replace("hypy", "jyutping");
        let unknown = xml_card("西瓜你好银行", "西瓜你好銀行", "");
        let english = xml_card("你好", "你好", "ni3hao3").replace("chinese", "english");
        let preview = parse_xml(
            &xml_document(&format!("{conflicting}{unsupported}{unknown}{english}")),
            "Words.xml".into(),
        )
        .unwrap();
        assert!(preview.rows.iter().all(|row| row.selected.is_none()));
        assert!(!preview.rows[0].candidates.is_empty());
        assert!(!preview.rows[1].candidates.is_empty());
        assert!(preview.rows[2].candidates.is_empty());
        assert!(preview.rows[3].candidates.is_empty());
    }

    #[test]
    fn xml_decodes_numeric_entities_and_cdata_without_custom_expansion() {
        let card = xml_card("&#x4F60;&#x597D;", "<![CDATA[你好]]>", "ni3hao3");
        let preview = parse_xml(&xml_document(&card), "Words.xml".into()).unwrap();
        assert_eq!(preview.rows[0].headword, "你好[你好]");
        assert!(preview.rows[0].selected.is_some());
        for headword in ["&custom;", "&#0;"] {
            assert!(parse_xml(
                &xml_document(&xml_card(headword, "你好", "ni3hao3")),
                "Words.xml".into()
            )
            .is_err());
        }
    }

    #[test]
    fn xml_preserves_nested_and_shared_categories_with_definitions_for_review() {
        let shared = xml_card("银行", "銀行", "yin2hang2")
            .replace("</entry>", "<defn>bank &amp; lender <![CDATA[<reference>]]></defn></entry>")
            .replace("</card>", r#"<catassign category="Reading"/><catassign category="Reading/Chapter 1"/><catassign category="Reading"/></card>"#);
        let unassigned = xml_card("西瓜", "西瓜", "xi1gua1");
        let repeated = xml_card("银行", "銀行", "yin2hang2")
            .replace("</card>", r#"<catassign category="Reading"/></card>"#);
        let categories = r#"<categories><category name="Reading"/><category name="Reading/Chapter 1"/><category name="Empty"/></categories>"#;
        let document = xml_document(&format!("{shared}{unassigned}{repeated}"))
            .replace("<categories/>", categories);
        let preview = parse_xml(&document, "Words.xml".into()).unwrap();
        assert_eq!(preview.rows.len(), 4);
        assert_eq!(preview.rows[0].category, "Reading");
        assert_eq!(preview.rows[1].category, "Reading/Chapter 1");
        assert_eq!(preview.rows[2].category, "Words");
        assert_eq!(preview.rows[0].definition, "bank & lender <reference>");
        assert_eq!(preview.rows[0].original, preview.rows[1].original);
        assert_ne!(preview.rows[0].original, preview.rows[3].original);
        assert!(preview.rows.iter().all(|row| row.selected.is_some()));
        assert_eq!(preview.rows[0].selected, preview.rows[1].selected);
        // Export order does not determine whether a category reference is valid.
        let reordered = document
            .replace(categories, "")
            .replace("</cards>", &format!("</cards>{categories}"));
        assert_eq!(
            parse_xml(&reordered, "Words.xml".into())
                .unwrap()
                .rows
                .len(),
            4
        );
    }

    #[test]
    fn xml_rejects_missing_or_undeclared_category_names_and_unknown_definition_markup() {
        let document = xml_document(&xml_card("你好", "你好", "ni3hao3"));
        for malformed in [
            document.replace("<categories/>", "<categories><category/></categories>"),
            document.replace("</card>", "<catassign/></card>"),
            document.replace("</card>", r#"<catassign category=" "/></card>"#),
            document.replace("</card>", r#"<catassign category="Study"/></card>"#),
            document.replace(
                "<categories/>",
                r#"<categories><category name="Study"/><category name="Study"/></categories>"#,
            ),
            document.replace("</entry>", "<defn><unknown>text</unknown></defn></entry>"),
            document.replace("</entry>", "<defn>first</defn><defn>second</defn></entry>"),
        ] {
            assert!(parse_xml(&malformed, "Words.xml".into()).is_err());
        }
    }

    #[test]
    fn xml_bounds_category_expansion_before_cloning_review_data() {
        let mut categories = String::from("<categories>");
        let mut assignments = String::new();
        for index in 0..20 {
            categories.push_str(&format!(r#"<category name="Chapter {index}"/>"#));
            assignments.push_str(&format!(r#"<catassign category="Chapter {index}"/>"#));
        }
        categories.push_str("</categories>");
        let card = xml_card("你好", "你好", "ni3hao3")
            .replace(
                "</entry>",
                &format!("<defn>{}</defn></entry>", "a".repeat(2 * 1024 * 1024)),
            )
            .replace("</card>", &format!("{assignments}</card>"));
        let document = xml_document(&card).replace("<categories/>", &categories);
        assert!(parse_xml(&document, "Words.xml".into())
            .unwrap_err()
            .contains("too much review data"));
    }

    #[test]
    fn xml_rejects_malformed_unsafe_unknown_and_empty_documents() {
        let document = xml_document(&xml_card("你好", "你好", "ni3hao3"));
        for malformed in [
            document.replace("formatversion=\"2\"", "formatversion=\"3\""),
            document.replace("</entry>", "</wrong>"),
            document.replace("</plecoflash>", ""),
            document.replace("</card>", ""),
            document.replace(
                "<categories/>",
                "<!DOCTYPE plecoflash [<!ENTITY bad SYSTEM 'file:///private'>]>",
            ),
            document.replace("<dictref", "<unknown"),
            document.replace("charset=\"sc\"", "charset=\"sc\" charset=\"tc\""),
            document.replace(
                "</plecoflash>",
                "</plecoflash><plecoflash formatversion=\"2\"/>",
            ),
            document.replace("UTF-8", "UTF-16"),
            xml_document(""),
            "<unrelated/>".into(),
            document.replace("你好", "\0"),
        ] {
            assert!(
                parse_xml(&malformed, "Words.xml".into()).is_err(),
                "unexpectedly accepted malformed XML"
            );
        }
    }
}
