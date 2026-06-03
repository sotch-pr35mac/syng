//! DOCX (Office Open XML) import.
//!
//! Parses Word documents by reading the ZIP archive's `word/document.xml` and extracting
//! paragraphs, headings, lists, tables, and inline styles into canonical reader content blocks.
//! Numbering definitions from `word/numbering.xml` and paragraph styles from `word/styles.xml`
//! are resolved to produce accurate list ordering and heading levels.

use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader as XmlReader;
use std::collections::HashMap;
use std::io::{Cursor, Read};
use uuid::Uuid;
use zip;

use crate::core::reader::{
    append_linear_block, default_canonical_schema_version, normalize_line_endings,
    title_from_file_stem, utf16_len, FormatExtractor, LinearBlock, ReaderBlockExtensions,
    ReaderContentBlock, ReaderImportPayload, ReaderInlineSpan, ReaderListItemExtension,
    ReaderTableCell, ReaderTableExtension, ReaderTableRow, DOCX_EXTRACTOR_VERSION,
};

/// DOCX (Office Open XML) format extractor implementing [`FormatExtractor`].
pub(crate) struct DocxFormat;

impl FormatExtractor for DocxFormat {
    fn extract(
        bytes: &[u8],
        file_name: String,
        hash: String,
        byte_len: u64,
    ) -> Result<ReaderImportPayload, String> {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
            .map_err(|error| format!("Could not open Word document archive: {}", error))?;

        let mut document_xml = String::new();
        archive
            .by_name("word/document.xml")
            .map_err(|_| "Word document is missing word/document.xml.".to_string())?
            .read_to_string(&mut document_xml)
            .map_err(|error| format!("Could not read Word document XML: {}", error))?;

        let core_title = archive
            .by_name("docProps/core.xml")
            .ok()
            .and_then(|mut file| {
                let mut xml = String::new();
                file.read_to_string(&mut xml).ok()?;
                parse_docx_core_title(&xml)
            });
        let numbering = archive
            .by_name("word/numbering.xml")
            .ok()
            .and_then(|mut file| {
                let mut xml = String::new();
                file.read_to_string(&mut xml).ok()?;
                Some(parse_docx_numbering(&xml))
            })
            .unwrap_or_default();
        let styles = archive
            .by_name("word/styles.xml")
            .ok()
            .and_then(|mut file| {
                let mut xml = String::new();
                file.read_to_string(&mut xml).ok()?;
                Some(parse_docx_styles(&xml, &numbering))
            })
            .unwrap_or_default();

        let (text, blocks) = parse_docx_document(&document_xml, &numbering, &styles)?;
        if text.trim().is_empty() && blocks.is_empty() {
            return Err("Word document did not contain readable text.".to_string());
        }

        Ok(ReaderImportPayload {
            canonical_schema_version: default_canonical_schema_version(),
            title: core_title.unwrap_or_else(|| title_from_file_stem(&file_name)),
            file_name,
            source_type: "docx".to_string(),
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                .to_string(),
            extractor_version: DOCX_EXTRACTOR_VERSION,
            text,
            blocks,
            source_sha256: Some(hash),
            source_byte_length: Some(byte_len),
            source_url: None,
            source_html: None,
            source_data: None,
            import_app_version: None,
        })
    }
}

/// Accumulated inline formatting state for the current XML run (`<w:r>`).
#[derive(Debug, Clone, Default)]
struct DocxRunStyle {
    strong: bool,
    emphasis: bool,
    underline: bool,
    strikethrough: bool,
    subscript: bool,
    superscript: bool,
}

/// Block-level style metadata resolved from `<w:pPr>` and style definitions.
#[derive(Debug, Clone, Default)]
struct DocxParagraphStyle {
    heading_level: Option<u8>,
    text_align: Option<String>,
    list_id: Option<String>,
    list_depth: usize,
    list_style: Option<String>,
    ordinal: Option<i64>,
}

/// Accumulates text and inline spans for a single paragraph during XML traversal.
#[derive(Debug, Clone, Default)]
struct DocxParagraphBuilder {
    text: String,
    spans: Vec<ReaderInlineSpan>,
    style: DocxParagraphStyle,
}

impl DocxParagraphBuilder {
    fn push_text(&mut self, value: &str, run_style: &DocxRunStyle) {
        if value.is_empty() {
            return;
        }
        let start = utf16_len(&self.text);
        self.text.push_str(value);
        let end = utf16_len(&self.text);
        for style in docx_run_style_names(run_style) {
            self.spans.push(ReaderInlineSpan {
                start,
                end,
                style: style.to_string(),
                annotation: None,
            });
        }
    }

    fn finish(self) -> Option<DocxParagraph> {
        let text = normalize_docx_text(&self.text);
        if text.is_empty() {
            return None;
        }
        let text_utf16_len = utf16_len(&text);
        let spans = self
            .spans
            .into_iter()
            .filter(|span| span.start < span.end && span.end <= text_utf16_len)
            .collect::<Vec<_>>();
        Some(DocxParagraph {
            text,
            spans,
            style: self.style,
        })
    }
}

#[derive(Debug, Clone)]
struct DocxParagraph {
    text: String,
    spans: Vec<ReaderInlineSpan>,
    style: DocxParagraphStyle,
}

#[derive(Debug, Clone, Default)]
struct DocxTableCellBuilder {
    text: String,
    spans: Vec<ReaderInlineSpan>,
}

impl DocxTableCellBuilder {
    fn push_paragraph(&mut self, paragraph: DocxParagraph) {
        if !self.text.is_empty() {
            self.text.push('\n');
        }
        let offset = utf16_len(&self.text);
        self.text.push_str(&paragraph.text);
        self.spans
            .extend(paragraph.spans.into_iter().map(|span| ReaderInlineSpan {
                start: span.start + offset,
                end: span.end + offset,
                style: span.style,
                annotation: span.annotation,
            }));
    }

    fn finish(self) -> Option<ReaderTableCell> {
        let text = self.text.trim().to_string();
        if text.is_empty() {
            return None;
        }
        Some(ReaderTableCell {
            text,
            is_header: false,
            spans: if self.spans.is_empty() {
                None
            } else {
                Some(self.spans)
            },
        })
    }
}

fn docx_run_style_names(style: &DocxRunStyle) -> Vec<&'static str> {
    let mut names = Vec::new();
    if style.strong {
        names.push("strong");
    }
    if style.emphasis {
        names.push("emphasis");
    }
    if style.underline {
        names.push("underline");
    }
    if style.strikethrough {
        names.push("strikethrough");
    }
    if style.subscript {
        names.push("subscript");
    }
    if style.superscript {
        names.push("superscript");
    }
    names
}

fn normalize_docx_text(text: &str) -> String {
    normalize_line_endings(text)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn xml_local_name(name: &[u8]) -> &[u8] {
    name.rsplit(|byte| *byte == b':').next().unwrap_or(name)
}

fn xml_attr_value(start: &BytesStart<'_>, local_name: &[u8]) -> Option<String> {
    start
        .attributes()
        .with_checks(false)
        .filter_map(Result::ok)
        .find(|attr| xml_local_name(attr.key.as_ref()) == local_name)
        .and_then(|attr| {
            String::from_utf8(attr.value.as_ref().to_vec())
                .ok()
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
}

fn docx_heading_level(value: &str) -> Option<u8> {
    let lower = value.to_lowercase();
    if lower == "title" {
        return Some(1);
    }
    lower
        .strip_prefix("heading")
        .or_else(|| lower.strip_prefix("h"))
        .and_then(|suffix| suffix.parse::<u8>().ok())
        .filter(|level| (1..=6).contains(level))
}

fn docx_text_align(value: &str) -> Option<String> {
    match value {
        "center" => Some("center".to_string()),
        "right" | "end" => Some("end".to_string()),
        "both" | "distribute" => Some("justify".to_string()),
        _ => None,
    }
}

fn docx_paragraph_extensions(style: &DocxParagraphStyle) -> Option<ReaderBlockExtensions> {
    style.list_id.as_ref().map(|list_id| ReaderBlockExtensions {
        list_item: Some(ReaderListItemExtension {
            list_id: format!("docx-list-{list_id}"),
            nesting_depth: style.list_depth,
            list_style: style
                .list_style
                .clone()
                .unwrap_or_else(|| "bullet".to_string()),
            ordinal: style.ordinal,
        }),
        ..ReaderBlockExtensions::default()
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DocxNumberingLevel {
    list_style: String,
    start: i64,
}

type DocxNumberingMap = HashMap<(String, usize), DocxNumberingLevel>;

#[derive(Debug, Clone, Default)]
struct DocxStyleDefinition {
    style: DocxParagraphStyle,
    based_on: Option<String>,
}

type DocxStyleMap = HashMap<String, DocxParagraphStyle>;

/// Parses `word/numbering.xml` to build a map from `(numId, ilvl)` to list style and start value.
fn parse_docx_numbering(xml: &str) -> DocxNumberingMap {
    let mut reader = XmlReader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut abstract_levels: HashMap<(String, usize), DocxNumberingLevel> = HashMap::new();
    let mut num_to_abstract: HashMap<String, String> = HashMap::new();
    let mut current_abstract: Option<String> = None;
    let mut current_num: Option<String> = None;
    let mut current_level: Option<usize> = None;
    let mut current_level_data: Option<DocxNumberingLevel> = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) | Ok(Event::Empty(start)) => {
                let name = xml_local_name(start.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"abstractNum" => current_abstract = xml_attr_value(&start, b"abstractNumId"),
                    b"num" => current_num = xml_attr_value(&start, b"numId"),
                    b"lvl" if current_abstract.is_some() => {
                        current_level = xml_attr_value(&start, b"ilvl")
                            .and_then(|value| value.parse::<usize>().ok());
                        current_level_data = Some(DocxNumberingLevel {
                            list_style: "ordered".to_string(),
                            start: 1,
                        });
                    }
                    b"numFmt" if current_level_data.is_some() => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(level) = current_level_data.as_mut() {
                                level.list_style = if value == "bullet" {
                                    "bullet".to_string()
                                } else {
                                    "ordered".to_string()
                                };
                            }
                        }
                    }
                    b"start" if current_level_data.is_some() => {
                        if let Some(value) =
                            xml_attr_value(&start, b"val").and_then(|value| value.parse().ok())
                        {
                            if let Some(level) = current_level_data.as_mut() {
                                level.start = value;
                            }
                        }
                    }
                    b"abstractNumId" if current_num.is_some() => {
                        if let (Some(num_id), Some(abstract_id)) =
                            (current_num.clone(), xml_attr_value(&start, b"val"))
                        {
                            num_to_abstract.insert(num_id, abstract_id);
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(end)) => {
                let name = xml_local_name(end.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"lvl" => {
                        if let (Some(abstract_id), Some(level), Some(level_data)) = (
                            current_abstract.clone(),
                            current_level.take(),
                            current_level_data.take(),
                        ) {
                            abstract_levels.insert((abstract_id, level), level_data);
                        }
                    }
                    b"abstractNum" => current_abstract = None,
                    b"num" => current_num = None,
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    num_to_abstract
        .into_iter()
        .flat_map(|(num_id, abstract_id)| {
            abstract_levels
                .iter()
                .filter(move |&((level_abstract_id, _), _)| level_abstract_id == &abstract_id)
                .map(move |((_, level), data)| ((num_id.clone(), *level), data.clone()))
        })
        .collect()
}

fn apply_docx_paragraph_style(
    paragraph_style: &mut DocxParagraphStyle,
    style: &DocxParagraphStyle,
) {
    if paragraph_style.heading_level.is_none() {
        paragraph_style.heading_level = style.heading_level;
    }
    if paragraph_style.text_align.is_none() {
        paragraph_style.text_align = style.text_align.clone();
    }
    if paragraph_style.list_id.is_none() {
        paragraph_style.list_id = style.list_id.clone();
        paragraph_style.list_depth = style.list_depth;
        paragraph_style.list_style = style.list_style.clone();
    }
}

fn merge_docx_style(base: &DocxParagraphStyle, child: &DocxParagraphStyle) -> DocxParagraphStyle {
    let mut merged = base.clone();
    if child.heading_level.is_some() {
        merged.heading_level = child.heading_level;
    }
    if child.text_align.is_some() {
        merged.text_align = child.text_align.clone();
    }
    if child.list_id.is_some() {
        merged.list_id = child.list_id.clone();
        merged.list_depth = child.list_depth;
        merged.list_style = child.list_style.clone();
    }
    merged
}

fn resolve_docx_style(
    style_id: &str,
    definitions: &HashMap<String, DocxStyleDefinition>,
    resolving: &mut Vec<String>,
) -> Option<DocxParagraphStyle> {
    if resolving.iter().any(|value| value == style_id) {
        return definitions
            .get(style_id)
            .map(|definition| definition.style.clone());
    }
    let definition = definitions.get(style_id)?;
    resolving.push(style_id.to_string());
    let resolved = definition
        .based_on
        .as_ref()
        .and_then(|base_id| resolve_docx_style(base_id, definitions, resolving))
        .map(|base| merge_docx_style(&base, &definition.style))
        .unwrap_or_else(|| definition.style.clone());
    resolving.pop();
    Some(resolved)
}

/// Parses `word/styles.xml` and resolves style inheritance chains (`basedOn`) into flat styles.
fn parse_docx_styles(xml: &str, numbering: &DocxNumberingMap) -> DocxStyleMap {
    let mut reader = XmlReader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut definitions: HashMap<String, DocxStyleDefinition> = HashMap::new();
    let mut current_style_id: Option<String> = None;
    let mut current_style_type: Option<String> = None;
    let mut current_definition = DocxStyleDefinition::default();
    let mut inside_style_paragraph_properties = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) | Ok(Event::Empty(start)) => {
                let name = xml_local_name(start.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"style" => {
                        current_style_id = xml_attr_value(&start, b"styleId");
                        current_style_type = xml_attr_value(&start, b"type");
                        current_definition = DocxStyleDefinition::default();
                    }
                    b"basedOn" if current_style_id.is_some() => {
                        current_definition.based_on = xml_attr_value(&start, b"val");
                    }
                    b"pPr" if current_style_id.is_some() => {
                        inside_style_paragraph_properties = true;
                    }
                    b"pStyle" if inside_style_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            current_definition.style.heading_level = docx_heading_level(&value);
                        }
                    }
                    b"jc" if inside_style_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            current_definition.style.text_align = docx_text_align(&value);
                        }
                    }
                    b"numId" if inside_style_paragraph_properties => {
                        current_definition.style.list_id = xml_attr_value(&start, b"val");
                    }
                    b"ilvl" if inside_style_paragraph_properties => {
                        if let Some(depth) =
                            xml_attr_value(&start, b"val").and_then(|value| value.parse().ok())
                        {
                            current_definition.style.list_depth = depth;
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(end)) => {
                let name = xml_local_name(end.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"pPr" => inside_style_paragraph_properties = false,
                    b"style" => {
                        if current_style_type.as_deref().unwrap_or("paragraph") == "paragraph" {
                            if let Some(style_id) = current_style_id.take() {
                                definitions.insert(style_id, current_definition.clone());
                            }
                        }
                        current_style_type = None;
                        current_definition = DocxStyleDefinition::default();
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    definitions
        .keys()
        .filter_map(|style_id| {
            let mut resolving = Vec::new();
            let mut style = resolve_docx_style(style_id, &definitions, &mut resolving)?;
            if let Some(list_id) = style.list_id.clone() {
                if let Some(level) = numbering.get(&(list_id, style.list_depth)) {
                    style.list_style = Some(level.list_style.clone());
                }
            }
            Some((style_id.clone(), style))
        })
        .collect()
}

fn append_docx_paragraph(
    blocks: &mut Vec<ReaderContentBlock>,
    linear_text: &mut String,
    paragraph: DocxParagraph,
) {
    let kind = if paragraph.style.list_id.is_some() {
        "list_item"
    } else if paragraph.style.heading_level.is_some() {
        "heading"
    } else {
        "paragraph"
    };
    append_linear_block(
        blocks,
        linear_text,
        LinearBlock {
            kind,
            text: paragraph.text,
            heading_level: paragraph.style.heading_level,
            text_align: paragraph.style.text_align.clone(),
            spans: if paragraph.spans.is_empty() {
                None
            } else {
                Some(paragraph.spans)
            },
            extensions: docx_paragraph_extensions(&paragraph.style),
        },
    );
}

/// Produces a tab/newline-delimited plain text representation of a table for linear text.
pub(super) fn docx_table_text(rows: &[ReaderTableRow]) -> String {
    rows.iter()
        .map(|row| {
            row.cells
                .iter()
                .map(|cell| cell.text.as_str())
                .collect::<Vec<_>>()
                .join("\t")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_docx_core_title(xml: &str) -> Option<String> {
    let mut reader = XmlReader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut inside_title = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) if xml_local_name(start.name().as_ref()) == b"title" => {
                inside_title = true;
            }
            Ok(Event::Text(text)) if inside_title => {
                return text
                    .xml_content()
                    .ok()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }
            Ok(Event::End(end)) if xml_local_name(end.name().as_ref()) == b"title" => {
                inside_title = false;
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    None
}

/// Walks `word/document.xml` producing linear text and content blocks.
fn parse_docx_document(
    xml: &str,
    numbering: &DocxNumberingMap,
    styles: &DocxStyleMap,
) -> Result<(String, Vec<ReaderContentBlock>), String> {
    let mut reader = XmlReader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut linear_text = String::new();
    let mut blocks = Vec::new();
    let mut paragraph: Option<DocxParagraphBuilder> = None;
    let mut run_style = DocxRunStyle::default();
    let mut inside_paragraph_properties = false;
    let mut inside_run_properties = false;
    let mut inside_text = false;
    let mut table_depth = 0usize;
    let mut current_rows: Vec<ReaderTableRow> = Vec::new();
    let mut current_cells: Vec<ReaderTableCell> = Vec::new();
    let mut current_cell: Option<DocxTableCellBuilder> = None;
    let mut list_ordinals: HashMap<(String, usize), i64> = HashMap::new();

    loop {
        match reader
            .read_event()
            .map_err(|error| format!("Could not parse Word document XML: {}", error))?
        {
            Event::Start(start) => {
                let name = xml_local_name(start.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"tbl" => {
                        table_depth += 1;
                        if table_depth == 1 {
                            current_rows.clear();
                        }
                    }
                    b"tr" if table_depth == 1 => current_cells.clear(),
                    b"tc" if table_depth == 1 => {
                        current_cell = Some(DocxTableCellBuilder::default())
                    }
                    b"p" => paragraph = Some(DocxParagraphBuilder::default()),
                    b"pPr" => inside_paragraph_properties = true,
                    b"r" => run_style = DocxRunStyle::default(),
                    b"rPr" => inside_run_properties = true,
                    b"t" => inside_text = true,
                    b"pStyle" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(paragraph) = paragraph.as_mut() {
                                if let Some(style) = styles.get(&value) {
                                    apply_docx_paragraph_style(&mut paragraph.style, style);
                                }
                                if let Some(level) = docx_heading_level(&value) {
                                    paragraph.style.heading_level = Some(level);
                                }
                            }
                        }
                    }
                    b"jc" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(align) = docx_text_align(&value) {
                                if let Some(paragraph) = paragraph.as_mut() {
                                    paragraph.style.text_align = Some(align);
                                }
                            }
                        }
                    }
                    b"numId" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(paragraph) = paragraph.as_mut() {
                                paragraph.style.list_id = Some(value);
                            }
                        }
                    }
                    b"ilvl" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Ok(depth) = value.parse::<usize>() {
                                if let Some(paragraph) = paragraph.as_mut() {
                                    paragraph.style.list_depth = depth;
                                }
                            }
                        }
                    }
                    b"b" if inside_run_properties => run_style.strong = true,
                    b"i" if inside_run_properties => run_style.emphasis = true,
                    b"u" if inside_run_properties => run_style.underline = true,
                    b"strike" | b"dstrike" if inside_run_properties => {
                        run_style.strikethrough = true;
                    }
                    b"vertAlign" if inside_run_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            run_style.subscript = value == "subscript";
                            run_style.superscript = value == "superscript";
                        }
                    }
                    _ => {}
                }
            }
            Event::Empty(start) => {
                let name = xml_local_name(start.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"pStyle" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(paragraph) = paragraph.as_mut() {
                                if let Some(style) = styles.get(&value) {
                                    apply_docx_paragraph_style(&mut paragraph.style, style);
                                }
                                if let Some(level) = docx_heading_level(&value) {
                                    paragraph.style.heading_level = Some(level);
                                }
                            }
                        }
                    }
                    b"jc" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(align) = docx_text_align(&value) {
                                if let Some(paragraph) = paragraph.as_mut() {
                                    paragraph.style.text_align = Some(align);
                                }
                            }
                        }
                    }
                    b"numId" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Some(paragraph) = paragraph.as_mut() {
                                paragraph.style.list_id = Some(value);
                            }
                        }
                    }
                    b"ilvl" if inside_paragraph_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            if let Ok(depth) = value.parse::<usize>() {
                                if let Some(paragraph) = paragraph.as_mut() {
                                    paragraph.style.list_depth = depth;
                                }
                            }
                        }
                    }
                    b"b" if inside_run_properties => run_style.strong = true,
                    b"i" if inside_run_properties => run_style.emphasis = true,
                    b"u" if inside_run_properties => run_style.underline = true,
                    b"strike" | b"dstrike" if inside_run_properties => {
                        run_style.strikethrough = true;
                    }
                    b"vertAlign" if inside_run_properties => {
                        if let Some(value) = xml_attr_value(&start, b"val") {
                            run_style.subscript = value == "subscript";
                            run_style.superscript = value == "superscript";
                        }
                    }
                    b"tab" => {
                        if let Some(paragraph) = paragraph.as_mut() {
                            paragraph.push_text("\t", &run_style);
                        }
                    }
                    b"br" | b"cr" => {
                        if let Some(paragraph) = paragraph.as_mut() {
                            paragraph.push_text("\n", &run_style);
                        }
                    }
                    _ => {}
                }
            }
            Event::Text(text) if inside_text => {
                if let Some(paragraph) = paragraph.as_mut() {
                    let value = text.xml_content().map_err(|error| {
                        format!("Could not decode Word document text: {}", error)
                    })?;
                    paragraph.push_text(&value, &run_style);
                }
            }
            Event::End(end) => {
                let name = xml_local_name(end.name().as_ref()).to_vec();
                match name.as_slice() {
                    b"t" => inside_text = false,
                    b"rPr" => inside_run_properties = false,
                    b"pPr" => inside_paragraph_properties = false,
                    b"r" => run_style = DocxRunStyle::default(),
                    b"p" => {
                        if let Some(paragraph) =
                            paragraph.take().and_then(DocxParagraphBuilder::finish)
                        {
                            let paragraph =
                                apply_docx_numbering(paragraph, numbering, &mut list_ordinals);
                            if let Some(cell) = current_cell.as_mut() {
                                cell.push_paragraph(paragraph);
                            } else {
                                append_docx_paragraph(&mut blocks, &mut linear_text, paragraph);
                            }
                        }
                    }
                    b"tc" if table_depth == 1 => {
                        if let Some(cell) =
                            current_cell.take().and_then(DocxTableCellBuilder::finish)
                        {
                            current_cells.push(cell);
                        }
                    }
                    b"tr" if table_depth == 1 && !current_cells.is_empty() => {
                        current_rows.push(ReaderTableRow {
                            cells: std::mem::take(&mut current_cells),
                        });
                    }
                    b"tbl" => {
                        if table_depth == 1 && !current_rows.is_empty() {
                            let rows = std::mem::take(&mut current_rows);
                            blocks.push(ReaderContentBlock {
                                id: Uuid::new_v4().to_string(),
                                kind: "table".to_string(),
                                text: docx_table_text(&rows),
                                start_offset: None,
                                end_offset: None,
                                participates_in_linear_text: false,
                                heading_level: None,
                                text_align: None,
                                spans: None,
                                extensions: Some(ReaderBlockExtensions {
                                    table: Some(ReaderTableExtension { rows }),
                                    ..ReaderBlockExtensions::default()
                                }),
                            });
                        }
                        table_depth = table_depth.saturating_sub(1);
                    }
                    _ => {}
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }

    Ok((linear_text, blocks))
}

fn apply_docx_numbering(
    mut paragraph: DocxParagraph,
    numbering: &DocxNumberingMap,
    ordinals: &mut HashMap<(String, usize), i64>,
) -> DocxParagraph {
    let Some(list_id) = paragraph.style.list_id.clone() else {
        return paragraph;
    };
    let depth = paragraph.style.list_depth;
    if let Some(level) = numbering.get(&(list_id.clone(), depth)) {
        paragraph.style.list_style = Some(level.list_style.clone());
        if level.list_style == "ordered" {
            let key = (list_id, depth);
            let next = ordinals.get(&key).copied().unwrap_or(level.start);
            paragraph.style.ordinal = Some(next);
            ordinals.insert(key, next + 1);
        }
    }
    paragraph
}
