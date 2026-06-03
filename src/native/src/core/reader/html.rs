//! HTML parsing and content block extraction.
//!
//! Converts HTML documents into canonical reader content blocks with UTF-16 offset tracking.
//! Handles headings, paragraphs, lists, tables, images, and inline styles (`<strong>`, `<em>`,
//! `<ruby>`, etc.). Used by both direct HTML file import and EPUB chapter extraction.

use scraper::{ElementRef, Html, Selector};
use serde_json::{Map, Value};
use std::ops::Deref;
use tauri_plugin_http::reqwest;
use uuid::Uuid;

use crate::core::reader::{
    collapse_whitespace, decode_reader_text, default_canonical_schema_version, extract_text_blocks,
    normalize_line_endings, safe_remote_image_src, sha256_hex, title_from_file_stem, utf16_len,
    FormatExtractor, ReaderBlockExtensions, ReaderBlockStyleExtension, ReaderContentBlock,
    ReaderImageExtension, ReaderImportPayload, ReaderInlineSpan, ReaderListItemExtension,
    ReaderTableCell, ReaderTableExtension, ReaderTableRow, HTML_EXTRACTOR_VERSION,
};

/// HTML file format extractor implementing [`FormatExtractor`].
pub(crate) struct HtmlFileFormat;

impl FormatExtractor for HtmlFileFormat {
    fn extract(
        bytes: &[u8],
        file_name: String,
        hash: String,
        byte_len: u64,
    ) -> Result<ReaderImportPayload, String> {
        let html = decode_reader_text(bytes, html_declared_charset(bytes).as_deref())?;
        let (text, blocks, html_title) = html_to_blocks(&html, None);
        if text.trim().is_empty() && blocks.is_empty() {
            return Err("HTML file did not contain readable text.".to_string());
        }

        Ok(ReaderImportPayload {
            canonical_schema_version: default_canonical_schema_version(),
            title: html_title.unwrap_or_else(|| title_from_file_stem(&file_name)),
            file_name,
            source_type: "html".to_string(),
            mime_type: "text/html".to_string(),
            extractor_version: HTML_EXTRACTOR_VERSION,
            text,
            blocks,
            source_sha256: Some(hash),
            source_byte_length: Some(byte_len),
            source_url: None,
            source_html: Some(html),
            source_data: None,
            import_app_version: None,
        })
    }
}

/// Sniffs the declared charset from the first 4 KiB of an HTML file's `<meta>` tags.
pub(super) fn html_declared_charset(bytes: &[u8]) -> Option<String> {
    let prefix = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]).to_ascii_lowercase();
    let charset_index = prefix.find("charset")?;
    let after_charset = &prefix[charset_index + "charset".len()..];
    let equals_index = after_charset.find('=')?;
    let value = after_charset[equals_index + 1..].trim_start();
    let value = value.trim_start_matches(['"', '\'']);
    let charset = value
        .split(|ch: char| ch == '"' || ch == '\'' || ch == ';' || ch == '>' || ch.is_whitespace())
        .next()
        .unwrap_or_default()
        .trim();
    (!charset.is_empty()).then(|| charset.to_string())
}

fn first_attr(element: ElementRef<'_>, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| element.value().attr(name))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn parse_selector(selector: &str) -> Selector {
    Selector::parse(selector).expect("reader selector should parse")
}

fn has_block_ancestor(element: ElementRef<'_>, block_tags: &[&str]) -> bool {
    element.ancestors().any(|ancestor| {
        ElementRef::wrap(ancestor)
            .map(|ancestor_element| block_tags.contains(&ancestor_element.value().name()))
            .unwrap_or(false)
    })
}

fn attr_search_text(element: ElementRef<'_>) -> String {
    ["class", "id", "role", "epub:type", "style", "align"]
        .iter()
        .filter_map(|name| element.value().attr(name))
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn parse_style_value(style: &str, property: &str) -> Option<String> {
    style.split(';').find_map(|part| {
        let (name, value) = part.split_once(':')?;
        if name.trim().eq_ignore_ascii_case(property) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
        None
    })
}

fn infer_text_align(element: ElementRef<'_>) -> Option<String> {
    let style = element.value().attr("style").unwrap_or("");
    let attr_text = attr_search_text(element);
    parse_style_value(style, "text-align")
        .or_else(|| element.value().attr("align").map(ToString::to_string))
        .or_else(|| {
            if contains_any(&attr_text, &["center", "text-center"]) {
                Some("center".to_string())
            } else if contains_any(&attr_text, &["right", "text-right"]) {
                Some("end".to_string())
            } else if contains_any(&attr_text, &["justify"]) {
                Some("justify".to_string())
            } else {
                None
            }
        })
        .map(|value| match value.trim().to_lowercase().as_str() {
            "center" => "center".to_string(),
            "right" | "end" => "end".to_string(),
            "justify" => "justify".to_string(),
            _ => "start".to_string(),
        })
}

fn block_style_extension(element: ElementRef<'_>) -> Option<ReaderBlockExtensions> {
    let style = element.value().attr("style").unwrap_or("");
    let attr_text = attr_search_text(element);
    let mut block_style = ReaderBlockStyleExtension::default();

    if let Some(indent) = parse_style_value(style, "text-indent") {
        block_style.text_indent = Some(indent);
    } else if contains_any(&attr_text, &["indent", "dropcap", "drop-cap"]) {
        block_style.text_indent = Some("2em".to_string());
    }

    if let Some(align) = infer_text_align(element) {
        block_style.text_align = Some(align);
    }

    if contains_any(&attr_text, &["small", "footnote", "caption"])
        || element.value().name() == "small"
    {
        block_style.small_text = Some(true);
    }

    if contains_any(
        &attr_text,
        &["note", "annotation", "aside", "sidebar", "tip"],
    ) {
        block_style.note = Some(true);
    }

    if contains_any(&attr_text, &["box", "boxed", "toc"]) {
        block_style.boxed = Some(true);
    }

    if contains_any(&attr_text, &["poem", "poetry", "verse"]) {
        block_style.poem = Some(true);
    }

    if contains_any(&attr_text, &["center", "text-center"]) {
        block_style.centered = Some(true);
    }

    let has_vertical_writing = contains_any(
        &attr_text,
        &["writing-mode: vertical", "vertical-rl", "vertical-lr"],
    ) || element.ancestors().any(|ancestor| {
        ElementRef::wrap(ancestor)
            .map(|ancestor_element| {
                contains_any(
                    &attr_search_text(ancestor_element),
                    &["writing-mode: vertical", "vertical-rl", "vertical-lr"],
                )
            })
            .unwrap_or(false)
    });
    if has_vertical_writing {
        block_style.vertical_writing_mode = Some(true);
    }

    if block_style.is_empty() {
        None
    } else {
        Some(ReaderBlockExtensions {
            block_style: Some(block_style),
            ..ReaderBlockExtensions::default()
        })
    }
}

fn merge_extensions(
    left: Option<ReaderBlockExtensions>,
    right: Option<ReaderBlockExtensions>,
) -> Option<ReaderBlockExtensions> {
    match (left, right) {
        (Some(mut left_value), Some(right_value)) => {
            left_value.table = right_value.table.or(left_value.table);
            left_value.image = right_value.image.or(left_value.image);
            left_value.list_item = right_value.list_item.or(left_value.list_item);
            left_value.block_style = right_value.block_style.or(left_value.block_style);
            left_value.extra.extend(right_value.extra);
            Some(left_value)
        }
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn is_semantic_container(element: ElementRef<'_>) -> bool {
    let tag = element.value().name();
    if !matches!(tag, "div" | "section" | "article" | "aside" | "nav") {
        return false;
    }
    let attr_text = attr_search_text(element);
    contains_any(
        &attr_text,
        &[
            "note",
            "annotation",
            "aside",
            "sidebar",
            "tip",
            "box",
            "boxed",
            "toc",
            "poem",
            "poetry",
            "verse",
        ],
    )
}

fn has_semantic_ancestor(element: ElementRef<'_>) -> bool {
    element.ancestors().any(|ancestor| {
        ElementRef::wrap(ancestor)
            .map(is_semantic_container)
            .unwrap_or(false)
    })
}

fn is_descendant_block_tag(tag: &str) -> bool {
    matches!(
        tag,
        "address"
            | "article"
            | "aside"
            | "blockquote"
            | "div"
            | "dl"
            | "figure"
            | "footer"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "header"
            | "hr"
            | "li"
            | "nav"
            | "ol"
            | "p"
            | "pre"
            | "section"
            | "table"
            | "ul"
    )
}

fn append_visible_text_node(
    node: ego_tree::NodeRef<'_, scraper::Node>,
    output: &mut String,
    skip_nested_lists: bool,
) {
    if let Some(text) = node.value().as_text() {
        output.push_str(text.deref());
        return;
    }

    let Some(element) = ElementRef::wrap(node) else {
        return;
    };
    let tag = element.value().name();
    if matches!(tag, "head" | "script" | "style" | "title" | "rt" | "rp") {
        return;
    }
    if skip_nested_lists && matches!(tag, "ol" | "ul") {
        return;
    }
    if tag == "br" {
        output.push('\n');
        return;
    }
    if tag == "hr" {
        output.push_str("\n---\n");
        return;
    }

    let wraps_lines = is_descendant_block_tag(tag);
    if wraps_lines {
        output.push('\n');
    }
    for child in element.children() {
        append_visible_text_node(child, output, skip_nested_lists);
    }
    if wraps_lines {
        output.push('\n');
    }
}

fn normalize_visible_text(raw: &str) -> String {
    let normalized = normalize_line_endings(raw);
    let lines = normalized
        .lines()
        .map(collapse_whitespace)
        .collect::<Vec<_>>();
    let first_non_empty = lines.iter().position(|line| !line.is_empty());
    let last_non_empty = lines.iter().rposition(|line| !line.is_empty());
    match (first_non_empty, last_non_empty) {
        (Some(start), Some(end)) => lines[start..=end].join("\n"),
        _ => String::new(),
    }
}

fn element_visible_text(element: ElementRef<'_>) -> String {
    let skip_nested_lists = element.value().name() == "li";
    let mut raw = String::new();
    for child in element.children() {
        append_visible_text_node(child, &mut raw, skip_nested_lists);
    }
    normalize_visible_text(&raw)
}

fn element_direct_visible_text(element: ElementRef<'_>) -> String {
    let mut raw = String::new();
    for child in element.children() {
        if ElementRef::wrap(child)
            .map(|child_element| is_descendant_block_tag(child_element.value().name()))
            .unwrap_or(false)
        {
            continue;
        }
        append_visible_text_node(child, &mut raw, false);
    }
    normalize_visible_text(&raw)
}

fn element_text(element: ElementRef<'_>) -> String {
    element_visible_text(element)
}

fn inline_spans_for_block(
    element: ElementRef<'_>,
    block_text: &str,
) -> Option<Vec<ReaderInlineSpan>> {
    let selector = parse_selector("strong,b,em,i,code,ruby");
    let mut spans = Vec::new();
    let mut search_cursor = 0;

    for inline in element.select(&selector) {
        let style = match inline.value().name() {
            "strong" | "b" => "strong",
            "em" | "i" => "emphasis",
            "code" => "code",
            "ruby" => "ruby",
            _ => continue,
        };
        let span_text = element_visible_text(inline);
        if span_text.is_empty() || search_cursor > block_text.len() {
            continue;
        }
        if let Some(relative_start) = block_text[search_cursor..].find(&span_text) {
            let byte_start = search_cursor + relative_start;
            let byte_end = byte_start + span_text.len();
            spans.push(ReaderInlineSpan {
                start: utf16_len(&block_text[..byte_start]),
                end: utf16_len(&block_text[..byte_end]),
                style: style.to_string(),
                annotation: if style == "ruby" {
                    ruby_annotation(inline)
                } else {
                    None
                },
            });
            search_cursor = byte_end;
        }
    }

    if spans.is_empty() {
        None
    } else {
        Some(spans)
    }
}

fn ruby_annotation(element: ElementRef<'_>) -> Option<String> {
    let selector = parse_selector("rt");
    let annotation = element
        .select(&selector)
        .map(|rt| rt.text().collect::<Vec<_>>().join(""))
        .map(|value| collapse_whitespace(&value))
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    (!annotation.is_empty()).then_some(annotation)
}

/// Appends a content block to the block list and its text to the running linear text buffer.
///
/// UTF-16 start/end offsets are computed from the current linear text length before and after
/// appending, so callers must keep `linear_text` in sync with block emission.
pub(super) fn append_linear_block(
    blocks: &mut Vec<ReaderContentBlock>,
    linear_text: &mut String,
    kind: &str,
    text: String,
    heading_level: Option<u8>,
    text_align: Option<String>,
    spans: Option<Vec<ReaderInlineSpan>>,
    extensions: Option<ReaderBlockExtensions>,
) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }

    if !linear_text.is_empty() {
        linear_text.push_str("\n\n");
    }
    let start_offset = utf16_len(linear_text);
    linear_text.push_str(trimmed);
    let end_offset = utf16_len(linear_text);

    blocks.push(ReaderContentBlock {
        id: Uuid::new_v4().to_string(),
        kind: kind.to_string(),
        text: trimmed.to_string(),
        start_offset: Some(start_offset),
        end_offset: Some(end_offset),
        participates_in_linear_text: true,
        heading_level,
        text_align,
        spans,
        extensions,
    });
}

fn table_extension(table: ElementRef<'_>) -> ReaderBlockExtensions {
    let row_selector = parse_selector("tr");
    let cell_selector = parse_selector("th,td");
    let rows = table
        .select(&row_selector)
        .map(|row| {
            let cells = row
                .select(&cell_selector)
                .map(|cell| {
                    let text = element_text(cell);
                    ReaderTableCell {
                        spans: inline_spans_for_block(cell, &text),
                        text,
                        is_header: cell.value().name() == "th",
                    }
                })
                .collect::<Vec<_>>();
            ReaderTableRow { cells }
        })
        .filter(|row| !row.cells.is_empty())
        .collect::<Vec<_>>();

    ReaderBlockExtensions {
        table: Some(ReaderTableExtension { rows }),
        ..ReaderBlockExtensions::default()
    }
}

fn image_extension(
    image: ElementRef<'_>,
    base_url: Option<&reqwest::Url>,
) -> Option<ReaderBlockExtensions> {
    let src = first_attr(image, &["src", "data-src"])?;
    let alt = first_attr(image, &["alt", "title"]).unwrap_or_default();
    let width = first_attr(image, &["width"]).and_then(|value| value.parse::<u32>().ok());
    let height = first_attr(image, &["height"]).and_then(|value| value.parse::<u32>().ok());
    let safe_src = safe_remote_image_src(&src, base_url);

    let mut extra = Map::new();
    extra.insert("alt".to_string(), Value::String(alt));
    // When the source could not be resolved as a safe remote URL, keep the raw src so callers
    // that read from a local archive (e.g. EPUB) can resolve and inline the image themselves.
    if safe_src.is_none() {
        extra.insert("src".to_string(), Value::String(src));
    }
    Some(ReaderBlockExtensions {
        image: Some(ReaderImageExtension {
            asset_id: Uuid::new_v4().to_string(),
            mime_type: "image/*".to_string(),
            inline_src: safe_src,
            width,
            height,
        }),
        extra,
        ..ReaderBlockExtensions::default()
    })
}

fn title_from_html(document: &Html) -> Option<String> {
    document
        .select(&parse_selector("title"))
        .next()
        .map(element_text)
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            document
                .select(&parse_selector("h1"))
                .next()
                .map(element_text)
                .filter(|value| !value.trim().is_empty())
        })
}

/// Parses an HTML string into linear text, content blocks, and an optional document title.
///
/// Returns `(linear_text, blocks, title)`. The `base_url` is used to resolve relative image
/// `src` attributes when present.
pub(super) fn html_to_blocks(
    html: &str,
    base_url: Option<&reqwest::Url>,
) -> (String, Vec<ReaderContentBlock>, Option<String>) {
    let document = Html::parse_document(html);
    let title = title_from_html(&document);
    let selector = parse_selector(
        "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table,img,hr,figure,div,section,article,aside,nav,small",
    );
    let mut text = String::new();
    let mut blocks = Vec::new();
    let block_tags = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "li",
        "blockquote",
        "pre",
        "table",
        "figure",
    ];

    for element in document.select(&selector) {
        let tag = element.value().name();
        if tag != "img" && has_semantic_ancestor(element) {
            continue;
        }
        if tag != "img" && has_block_ancestor(element, &block_tags) {
            continue;
        }

        match tag {
            "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
                let level = tag.trim_start_matches('h').parse::<u8>().ok();
                let block_text = element_text(element);
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "heading",
                    block_text.clone(),
                    level,
                    infer_text_align(element),
                    inline_spans_for_block(element, &block_text),
                    block_style_extension(element),
                );
            }
            "p" | "small" => {
                let block_text = element_text(element);
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "paragraph",
                    block_text.clone(),
                    None,
                    infer_text_align(element),
                    inline_spans_for_block(element, &block_text),
                    block_style_extension(element),
                );
            }
            "li" => {
                let parent_list = element
                    .ancestors()
                    .find_map(ElementRef::wrap)
                    .filter(|ancestor| matches!(ancestor.value().name(), "ol" | "ul"));
                let list_style = parent_list
                    .map(|ancestor| {
                        if ancestor.value().name() == "ol" {
                            "ordered"
                        } else {
                            "bullet"
                        }
                    })
                    .unwrap_or("bullet");
                let nesting_depth = element
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .filter(|ancestor| matches!(ancestor.value().name(), "ol" | "ul"))
                    .count()
                    .saturating_sub(1);
                let list_id = parent_list
                    .and_then(|list| first_attr(list, &["id"]))
                    .unwrap_or_else(|| {
                        let hash = sha256_hex(
                            parent_list
                                .map(|list| list.html())
                                .unwrap_or_default()
                                .as_bytes(),
                        );
                        format!("html-list-{}", &hash[..12])
                    });
                let ordinal = parent_list
                    .filter(|list| list.value().name() == "ol")
                    .map(|list| {
                        let start = list
                            .value()
                            .attr("start")
                            .and_then(|value| value.parse::<i64>().ok())
                            .unwrap_or(1);
                        let previous_items = element
                            .prev_siblings()
                            .filter_map(ElementRef::wrap)
                            .filter(|sibling| sibling.value().name() == "li")
                            .count() as i64;
                        start + previous_items
                    });
                let block_text = element_text(element);
                let list_extension = Some(ReaderBlockExtensions {
                    list_item: Some(ReaderListItemExtension {
                        list_id,
                        nesting_depth,
                        list_style: list_style.to_string(),
                        ordinal,
                    }),
                    ..ReaderBlockExtensions::default()
                });
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "list_item",
                    block_text.clone(),
                    None,
                    infer_text_align(element),
                    inline_spans_for_block(element, &block_text),
                    merge_extensions(list_extension, block_style_extension(element)),
                );
            }
            "blockquote" => {
                let block_text = element_text(element);
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "blockquote",
                    block_text.clone(),
                    None,
                    infer_text_align(element),
                    inline_spans_for_block(element, &block_text),
                    block_style_extension(element),
                );
            }
            "pre" => {
                let code_text =
                    normalize_line_endings(&element.text().collect::<Vec<_>>().join(""));
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "code_block",
                    code_text.clone(),
                    None,
                    infer_text_align(element),
                    Some(vec![ReaderInlineSpan {
                        start: 0,
                        end: utf16_len(&code_text),
                        style: "code".to_string(),
                        annotation: None,
                    }]),
                    block_style_extension(element),
                );
            }
            "table" => {
                let table_text = element_text(element);
                let extensions = table_extension(element);
                blocks.push(ReaderContentBlock {
                    id: Uuid::new_v4().to_string(),
                    kind: "table".to_string(),
                    text: table_text,
                    start_offset: None,
                    end_offset: None,
                    participates_in_linear_text: false,
                    heading_level: None,
                    text_align: None,
                    spans: None,
                    extensions: Some(extensions),
                });
            }
            "img" => {
                if has_block_ancestor(element, &["table"]) {
                    continue;
                }
                if let Some(extensions) = image_extension(element, base_url) {
                    let alt = first_attr(element, &["alt", "title"]).unwrap_or_default();
                    blocks.push(ReaderContentBlock {
                        id: Uuid::new_v4().to_string(),
                        kind: "image".to_string(),
                        text: alt,
                        start_offset: None,
                        end_offset: None,
                        participates_in_linear_text: false,
                        heading_level: None,
                        text_align: None,
                        spans: None,
                        extensions: Some(extensions),
                    });
                }
            }
            "hr" => blocks.push(ReaderContentBlock {
                id: Uuid::new_v4().to_string(),
                kind: "thematic_break".to_string(),
                text: String::new(),
                start_offset: None,
                end_offset: None,
                participates_in_linear_text: false,
                heading_level: None,
                text_align: None,
                spans: None,
                extensions: None,
            }),
            "figure" => {
                let figure_text = element_text(element);
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    "paragraph",
                    figure_text.clone(),
                    None,
                    infer_text_align(element),
                    inline_spans_for_block(element, &figure_text),
                    block_style_extension(element),
                );
            }
            "div" | "section" | "article" | "aside" | "nav" => {
                let block_text = if is_semantic_container(element) {
                    element_text(element)
                } else {
                    element_direct_visible_text(element)
                };
                let style_extension = block_style_extension(element);
                if block_text.trim().is_empty() || style_extension.is_none() {
                    continue;
                }
                let kind = if style_extension
                    .as_ref()
                    .and_then(|value| value.block_style.as_ref())
                    .map(|style| style.note == Some(true) || style.boxed == Some(true))
                    .unwrap_or(false)
                {
                    "aside"
                } else {
                    "paragraph"
                };
                append_linear_block(
                    &mut blocks,
                    &mut text,
                    kind,
                    block_text.clone(),
                    None,
                    infer_text_align(element),
                    inline_spans_for_block(element, &block_text),
                    style_extension,
                );
            }
            _ => {}
        }
    }

    if blocks.is_empty() {
        let fallback = html2text::from_read(html.as_bytes(), 240)
            .map(|value| normalize_line_endings(&value))
            .unwrap_or_default();
        for block in extract_text_blocks(&fallback) {
            blocks.push(block);
        }
        text = fallback;
    }

    (text, blocks, title)
}
