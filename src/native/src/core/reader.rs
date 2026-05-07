//! Reader import and tokenization.
//!
//! Rust owns the canonical import pipeline for files, raw text/HTML, and webpages. Payload offsets
//! crossing IPC are JavaScript UTF-16 code unit indices because the Svelte renderer paginates with
//! `String.length` and `String.prototype.slice`.

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use epub::doc::EpubDoc;
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader as XmlReader;
use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::io::{Cursor, Read};
use std::net::{IpAddr, ToSocketAddrs};
use std::ops::Deref;
use std::path::Path;
use std::time::Duration;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
use tauri_plugin_http::reqwest;
use uuid::Uuid;

const TEXT_EXTRACTOR_VERSION: u8 = 1;
const EPUB_EXTRACTOR_VERSION: u8 = 2;
const PDF_EXTRACTOR_VERSION: u8 = 3;
const HTML_EXTRACTOR_VERSION: u8 = 2;
const DOCX_EXTRACTOR_VERSION: u8 = 1;
const WEBPAGE_CONNECT_TIMEOUT_SECONDS: u64 = 10;
const WEBPAGE_REQUEST_TIMEOUT_SECONDS: u64 = 45;
const WEBPAGE_REDIRECT_LIMIT: usize = 10;
const WEBPAGE_LARGE_HTML_WARNING_BYTES: usize = 10 * 1024 * 1024;
const WEBPAGE_MAX_HTML_BYTES: usize = 100 * 1024 * 1024;
const LARGE_HTML_ERROR_CODE: &str = "reader_large_html_requires_confirmation";
const TEXT_IMPORT_EXTENSIONS: &[&str] = &["txt", "text"];
const EPUB_IMPORT_EXTENSIONS: &[&str] = &["epub"];
const PDF_IMPORT_EXTENSIONS: &[&str] = &["pdf"];
const HTML_IMPORT_EXTENSIONS: &[&str] = &["html", "htm"];
const DOCX_IMPORT_EXTENSIONS: &[&str] = &["docx"];

fn default_canonical_schema_version() -> u8 {
    1
}

fn default_participates_in_linear_text() -> bool {
    true
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
/// Inline style spans use UTF-16 offsets into their containing block text.
pub struct ReaderInlineSpan {
    pub start: usize,
    pub end: usize,
    pub style: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq, Default)]
/// Canonical per-block presentation hints inferred from HTML/CSS or PDF layout.
pub struct ReaderBlockStyleExtension {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_indent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_align: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub small_text: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub boxed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poem: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub centered: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_writing_mode: Option<bool>,
}

impl ReaderBlockStyleExtension {
    fn is_empty(&self) -> bool {
        self.text_indent.is_none()
            && self.text_align.is_none()
            && self.small_text.is_none()
            && self.note.is_none()
            && self.boxed.is_none()
            && self.poem.is_none()
            && self.centered.is_none()
            && self.vertical_writing_mode.is_none()
    }
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
/// Ordered/bulleted list metadata that lets the renderer preserve nesting and ordinals.
pub struct ReaderListItemExtension {
    pub list_id: String,
    pub nesting_depth: usize,
    pub list_style: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ordinal: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
/// Canonical table cell text; dictionary tokenization is run from visible cell text only.
pub struct ReaderTableCell {
    pub text: String,
    pub is_header: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spans: Option<Vec<ReaderInlineSpan>>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderTableRow {
    pub cells: Vec<ReaderTableCell>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderTableExtension {
    pub rows: Vec<ReaderTableRow>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderImageExtension {
    pub asset_id: String,
    pub mime_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inline_src: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq, Default)]
/// Known extension envelope plus a flattened map for importer-specific metadata.
pub struct ReaderBlockExtensions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table: Option<ReaderTableExtension>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<ReaderImageExtension>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub list_item: Option<ReaderListItemExtension>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_style: Option<ReaderBlockStyleExtension>,
    #[serde(flatten, default, skip_serializing_if = "Map::is_empty")]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
/// Canonical render block. Linear blocks carry offsets into `ReaderImportPayload::text`;
/// atomic blocks such as tables/images opt out and keep their visible text in extensions.
pub struct ReaderContentBlock {
    pub id: String,
    pub kind: String,
    pub text: String,
    #[serde(default)]
    pub start_offset: Option<usize>,
    #[serde(default)]
    pub end_offset: Option<usize>,
    #[serde(default = "default_participates_in_linear_text")]
    pub participates_in_linear_text: bool,
    #[serde(default)]
    pub heading_level: Option<u8>,
    #[serde(default)]
    pub text_align: Option<String>,
    #[serde(default)]
    pub spans: Option<Vec<ReaderInlineSpan>>,
    #[serde(default)]
    pub extensions: Option<ReaderBlockExtensions>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
/// Import payload sent over Tauri IPC after native file, HTML, webpage, or text extraction.
pub struct ReaderImportPayload {
    #[serde(default = "default_canonical_schema_version")]
    pub canonical_schema_version: u8,
    pub title: String,
    pub file_name: String,
    pub source_type: String,
    pub mime_type: String,
    pub extractor_version: u8,
    /// Full linear text for pagination and progress anchoring. Offsets in blocks point into this
    /// string using JavaScript UTF-16 code unit indices.
    pub text: String,
    pub blocks: Vec<ReaderContentBlock>,
    #[serde(default)]
    pub source_sha256: Option<String>,
    #[serde(default)]
    pub source_byte_length: Option<u64>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub source_html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_data: Option<Vec<u8>>,
    #[serde(default)]
    pub import_app_version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareReaderImportArgs {
    /// Absolute filesystem path; preferred over `source_base64` for large binaries (EPUB/PDF).
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub source_base64: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub allow_large_html: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderToken {
    pub text: String,
    pub start: usize,
    pub end: usize,
}

struct WebpageFetchResult {
    html: String,
    final_url: String,
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn title_from_file_stem(file_name: &str) -> String {
    Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Untitled")
        .to_string()
}

fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
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

fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_multicast()
                || ip.is_broadcast()
                || ip.is_documentation()
                || ip.is_unspecified()
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
        }
    }
}

fn is_blocked_hostname(host: &str) -> bool {
    let host = host.trim().trim_end_matches('.').to_lowercase();
    host.is_empty()
        || host == "localhost"
        || host.ends_with(".localhost")
        || host == "local"
        || host.ends_with(".local")
}

fn validate_remote_url(url: &reqwest::Url, resolve_host: bool) -> Result<(), String> {
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("Reader webpage import only supports http and https URLs.".to_string()),
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Reader webpage import URLs must not include credentials.".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "Reader webpage import URL must include a host.".to_string())?;
    if is_blocked_hostname(host) {
        return Err("Reader webpage import does not allow local network URLs.".to_string());
    }
    let ip_host = host.trim_matches(|ch| ch == '[' || ch == ']');
    if let Ok(ip) = ip_host.parse::<IpAddr>() {
        if is_blocked_ip(ip) {
            return Err("Reader webpage import does not allow local network URLs.".to_string());
        }
    }

    if resolve_host {
        let port = url.port_or_known_default().unwrap_or(443);
        let addresses = (host, port)
            .to_socket_addrs()
            .map_err(|error| format!("Could not resolve webpage host: {}", error))?;
        for address in addresses {
            if is_blocked_ip(address.ip()) {
                return Err("Reader webpage import does not allow local network URLs.".to_string());
            }
        }
    }

    Ok(())
}

fn safe_remote_image_src(src: &str, base_url: Option<&reqwest::Url>) -> Option<String> {
    let parsed = reqwest::Url::parse(src)
        .ok()
        .or_else(|| base_url.and_then(|url| url.join(src).ok()))?;
    validate_remote_url(&parsed, false).ok()?;
    Some(parsed.to_string())
}

fn large_html_confirmation_error(received_bytes: usize) -> String {
    serde_json::json!({
        "code": LARGE_HTML_ERROR_CODE,
        "receivedBytes": received_bytes,
        "warningBytes": WEBPAGE_LARGE_HTML_WARNING_BYTES,
        "maxBytes": WEBPAGE_MAX_HTML_BYTES,
        "message": "This webpage is unusually large. Importing it may use significant memory and storage."
    })
    .to_string()
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
    let selector = parse_selector("strong,b,em,i,code");
    let mut spans = Vec::new();
    let mut search_cursor = 0;

    for inline in element.select(&selector) {
        let style = match inline.value().name() {
            "strong" | "b" => "strong",
            "em" | "i" => "emphasis",
            "code" => "code",
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

fn append_linear_block(
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
                .map(|cell| ReaderTableCell {
                    text: element_text(cell),
                    is_header: cell.value().name() == "th",
                    spans: None,
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

fn html_to_blocks(
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

#[derive(Debug, Clone, Default)]
struct DocxRunStyle {
    strong: bool,
    emphasis: bool,
    underline: bool,
    strikethrough: bool,
    subscript: bool,
    superscript: bool,
}

#[derive(Debug, Clone, Default)]
struct DocxParagraphStyle {
    heading_level: Option<u8>,
    text_align: Option<String>,
    list_id: Option<String>,
    list_depth: usize,
}

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
            list_style: "bullet".to_string(),
            ordinal: None,
        }),
        ..ReaderBlockExtensions::default()
    })
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
        kind,
        paragraph.text,
        paragraph.style.heading_level,
        paragraph.style.text_align.clone(),
        if paragraph.spans.is_empty() {
            None
        } else {
            Some(paragraph.spans)
        },
        docx_paragraph_extensions(&paragraph.style),
    );
}

fn docx_table_text(rows: &[ReaderTableRow]) -> String {
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
            Ok(Event::Start(start)) => {
                if xml_local_name(start.name().as_ref()) == b"title" {
                    inside_title = true;
                }
            }
            Ok(Event::Text(text)) if inside_title => {
                return text
                    .xml_content()
                    .ok()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
            }
            Ok(Event::End(end)) => {
                if xml_local_name(end.name().as_ref()) == b"title" {
                    inside_title = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    None
}

fn parse_docx_document(xml: &str) -> Result<(String, Vec<ReaderContentBlock>), String> {
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
                            if let Some(level) = docx_heading_level(&value) {
                                if let Some(paragraph) = paragraph.as_mut() {
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
                            if let Some(level) = docx_heading_level(&value) {
                                if let Some(paragraph) = paragraph.as_mut() {
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
                    b"tr" if table_depth == 1 => {
                        if !current_cells.is_empty() {
                            current_rows.push(ReaderTableRow {
                                cells: std::mem::take(&mut current_cells),
                            });
                        }
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

fn extract_docx_payload(
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

    let (text, blocks) = parse_docx_document(&document_xml)?;
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

fn extract_epub_payload(
    bytes: &[u8],
    file_name: String,
    hash: String,
    byte_len: u64,
) -> Result<ReaderImportPayload, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut doc =
        EpubDoc::from_reader(cursor).map_err(|error| format!("Could not read EPUB: {}", error))?;
    let title = doc
        .get_title()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| title_from_file_stem(&file_name));

    let spine_len = doc.spine.len();
    let mut html_fragments: Vec<String> = Vec::new();
    for chapter_index in 0..spine_len {
        if !doc.set_current_chapter(chapter_index) {
            continue;
        }
        if let Some((chapter_html, mime)) = doc.get_current_str() {
            let mime_lower = mime.to_lowercase();
            if mime_lower.contains("html") || mime_lower.contains("xml") {
                html_fragments.push(chapter_html);
            }
        }
    }

    let mut text = String::new();
    let mut blocks = Vec::new();
    let mut html_title = None;
    for chapter_html in html_fragments {
        let (chapter_text, mut chapter_blocks, chapter_title) = html_to_blocks(&chapter_html, None);
        if html_title.is_none() {
            html_title = chapter_title;
        }

        let mut offset_delta = utf16_len(&text);
        if !text.is_empty() && !chapter_text.trim().is_empty() {
            text.push_str("\n\n");
            offset_delta = utf16_len(&text);
        }

        for block in &mut chapter_blocks {
            if block.participates_in_linear_text {
                block.start_offset = block.start_offset.map(|offset| offset + offset_delta);
                block.end_offset = block.end_offset.map(|offset| offset + offset_delta);
            }
        }

        if !chapter_text.trim().is_empty() {
            text.push_str(&chapter_text);
        }
        blocks.extend(chapter_blocks);
    }

    if text.trim().is_empty() && blocks.is_empty() {
        return Err("EPUB did not contain readable text.".to_string());
    }
    let title = if title.trim().is_empty() {
        html_title.unwrap_or_else(|| title_from_file_stem(&file_name))
    } else {
        title
    };

    Ok(ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title,
        file_name,
        source_type: "epub".to_string(),
        mime_type: "application/epub+zip".to_string(),
        extractor_version: EPUB_EXTRACTOR_VERSION,
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

#[derive(Debug, Clone, PartialEq, Eq)]
enum PdfExtractionFailure {
    Unreadable(String),
}

#[cfg(test)]
fn extract_pdf_pages_with<F>(extract: F) -> Result<Vec<String>, PdfExtractionFailure>
where
    F: FnOnce() -> Result<Vec<String>, pdf_extract::OutputError>,
{
    extract()
        .map_err(|error| PdfExtractionFailure::Unreadable(format!("Could not read PDF: {}", error)))
}

fn extract_pdf_layout_with<F>(extract: F) -> Result<PdfLayoutDocument, PdfExtractionFailure>
where
    F: FnOnce() -> Result<PdfLayoutDocument, pdf_extract::OutputError>,
{
    extract()
        .map_err(|error| PdfExtractionFailure::Unreadable(format!("Could not read PDF: {}", error)))
}

#[derive(Debug, Clone)]
struct PdfGlyph {
    text: String,
    x: f64,
    y: f64,
    end_x: f64,
    font_size: f64,
}

#[derive(Debug, Clone)]
struct PdfLayoutPage {
    page_num: u32,
    width: f64,
    glyphs: Vec<PdfGlyph>,
}

#[derive(Debug, Clone)]
struct PdfLayoutDocument {
    pages: Vec<PdfLayoutPage>,
}

struct PdfLayoutOutput {
    pages: Vec<PdfLayoutPage>,
    current_page: Option<PdfLayoutPage>,
    flip_ctm: pdf_extract::Transform,
}

impl PdfLayoutOutput {
    fn new() -> Self {
        Self {
            pages: Vec::new(),
            current_page: None,
            flip_ctm: pdf_extract::Transform::identity(),
        }
    }

    fn into_document(self) -> PdfLayoutDocument {
        PdfLayoutDocument { pages: self.pages }
    }
}

impl pdf_extract::OutputDev for PdfLayoutOutput {
    fn begin_page(
        &mut self,
        page_num: u32,
        media_box: &pdf_extract::MediaBox,
        _: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), pdf_extract::OutputError> {
        let width = media_box.urx - media_box.llx;
        self.flip_ctm =
            pdf_extract::Transform::row_major(1., 0., 0., -1., 0., media_box.ury - media_box.lly);
        self.current_page = Some(PdfLayoutPage {
            page_num,
            width,
            glyphs: Vec::new(),
        });
        Ok(())
    }

    fn end_page(&mut self) -> Result<(), pdf_extract::OutputError> {
        if let Some(page) = self.current_page.take() {
            self.pages.push(page);
        }
        Ok(())
    }

    fn output_character(
        &mut self,
        trm: &pdf_extract::Transform,
        width: f64,
        _spacing: f64,
        font_size: f64,
        char_text: &str,
    ) -> Result<(), pdf_extract::OutputError> {
        if char_text.is_empty() {
            return Ok(());
        }
        let Some(page) = self.current_page.as_mut() else {
            return Ok(());
        };

        let position = trm.post_transform(&self.flip_ctm);
        let x = position.m31;
        let y = position.m32;
        let vector_x = (trm.m11 * font_size) + (trm.m21 * font_size);
        let vector_y = (trm.m12 * font_size) + (trm.m22 * font_size);
        let transformed_font_size = (vector_x * vector_y).abs().sqrt();
        let glyph_font_size = if transformed_font_size.is_finite() && transformed_font_size > 0.0 {
            transformed_font_size
        } else {
            font_size
        };
        let end_x = x + (width * glyph_font_size);

        page.glyphs.push(PdfGlyph {
            text: char_text.to_string(),
            x,
            y,
            end_x,
            font_size: glyph_font_size,
        });
        Ok(())
    }

    fn begin_word(&mut self) -> Result<(), pdf_extract::OutputError> {
        Ok(())
    }

    fn end_word(&mut self) -> Result<(), pdf_extract::OutputError> {
        Ok(())
    }

    fn end_line(&mut self) -> Result<(), pdf_extract::OutputError> {
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct PdfLine {
    text: String,
    segments: Vec<PdfLineSegment>,
    x_min: f64,
    x_max: f64,
    y: f64,
    font_size: f64,
    page_num: u32,
    page_width: f64,
}

#[derive(Debug, Clone)]
struct PdfLineSegment {
    text: String,
    x_min: f64,
    x_max: f64,
}

fn cmp_f64(left: f64, right: f64) -> Ordering {
    left.partial_cmp(&right).unwrap_or(Ordering::Equal)
}

fn group_pdf_page_lines(page: &PdfLayoutPage) -> Vec<PdfLine> {
    let mut glyphs = page.glyphs.clone();
    glyphs.sort_by(|left, right| {
        cmp_f64(left.y, right.y)
            .then_with(|| cmp_f64(left.x, right.x))
            .then_with(|| left.text.cmp(&right.text))
    });

    let mut grouped: Vec<Vec<PdfGlyph>> = Vec::new();
    for glyph in glyphs {
        let line_threshold = glyph.font_size.max(1.0) * 0.45;
        if let Some(line) = grouped
            .last_mut()
            .filter(|line| (line[0].y - glyph.y).abs() <= line_threshold)
        {
            line.push(glyph);
        } else {
            grouped.push(vec![glyph]);
        }
    }

    grouped
        .into_iter()
        .filter_map(|mut glyphs| {
            glyphs.sort_by(|left, right| cmp_f64(left.x, right.x));
            let mut text = String::new();
            let mut segments = Vec::new();
            let mut segment_text = String::new();
            let mut segment_x_min = f64::INFINITY;
            let mut segment_x_max = f64::NEG_INFINITY;
            let mut previous_end: Option<f64> = None;
            let mut x_min = f64::INFINITY;
            let mut x_max = f64::NEG_INFINITY;
            let mut y_total = 0.0;
            let mut font_total = 0.0;
            let mut count = 0.0;

            for glyph in glyphs {
                if let Some(end) = previous_end {
                    let gap = glyph.x - end;
                    if gap > glyph.font_size * 0.65 && !segment_text.trim().is_empty() {
                        segments.push(PdfLineSegment {
                            text: segment_text.trim().to_string(),
                            x_min: segment_x_min,
                            x_max: segment_x_max,
                        });
                        segment_text.clear();
                        segment_x_min = f64::INFINITY;
                        segment_x_max = f64::NEG_INFINITY;
                    }
                    if gap > glyph.font_size * 0.35
                        && !text.ends_with(char::is_whitespace)
                        && !glyph.text.starts_with(char::is_whitespace)
                    {
                        text.push(' ');
                    }
                }
                text.push_str(&glyph.text);
                segment_text.push_str(&glyph.text);
                segment_x_min = segment_x_min.min(glyph.x);
                segment_x_max = segment_x_max.max(glyph.end_x);
                x_min = x_min.min(glyph.x);
                x_max = x_max.max(glyph.end_x);
                y_total += glyph.y;
                font_total += glyph.font_size;
                count += 1.0;
                previous_end = Some(glyph.end_x);
            }
            if !segment_text.trim().is_empty() {
                segments.push(PdfLineSegment {
                    text: segment_text.trim().to_string(),
                    x_min: segment_x_min,
                    x_max: segment_x_max,
                });
            }

            let text = text.trim().to_string();
            if text.is_empty() {
                return None;
            }

            Some(PdfLine {
                text,
                segments,
                x_min,
                x_max,
                y: y_total / count,
                font_size: font_total / count,
                page_num: page.page_num,
                page_width: page.width,
            })
        })
        .collect()
}

fn median_f64(values: &mut [f64], fallback: f64) -> f64 {
    values.sort_by(|left, right| cmp_f64(*left, *right));
    values
        .get(values.len().saturating_sub(1) / 2)
        .copied()
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(fallback)
}

fn percentile_f64(values: &mut [f64], percentile: f64, fallback: f64) -> f64 {
    values.sort_by(|left, right| cmp_f64(*left, *right));
    if values.is_empty() {
        return fallback;
    }
    let index = ((values.len() - 1) as f64 * percentile).round() as usize;
    values.get(index).copied().unwrap_or(fallback)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PdfLineRole {
    kind: String,
    heading_level: Option<u8>,
    text_align: Option<String>,
    small_text: bool,
    centered: bool,
    text_indent: Option<String>,
}

fn classify_pdf_line(line: &PdfLine, body_font_size: f64, typical_left: f64) -> PdfLineRole {
    let font_ratio = line.font_size / body_font_size.max(1.0);
    let line_width = line.x_max - line.x_min;
    let char_count = line.text.chars().count();
    let heading_level = if char_count <= 90 && font_ratio >= 1.45 {
        Some(1)
    } else if char_count <= 90 && font_ratio >= 1.28 {
        Some(2)
    } else if char_count <= 80 && font_ratio >= 1.14 {
        Some(3)
    } else {
        None
    };
    let center_offset = ((line.x_min + line_width / 2.0) - (line.page_width / 2.0)).abs();
    let centered_width_limit = if heading_level.is_some() { 0.82 } else { 0.58 };
    let starts_like_body_text = line.x_min <= typical_left + body_font_size.max(1.0) * 2.75;
    let centered = center_offset <= line.page_width * 0.08
        && line_width <= line.page_width * centered_width_limit
        && (heading_level.is_some() || !starts_like_body_text);
    let indent_em = ((line.x_min - typical_left) / body_font_size.max(1.0)).max(0.0);
    let text_indent = if heading_level.is_none() && !centered && indent_em >= 0.8 {
        Some(format!("{:.1}em", indent_em.min(4.0)))
    } else {
        None
    };

    PdfLineRole {
        kind: if heading_level.is_some() {
            "heading".to_string()
        } else {
            "paragraph".to_string()
        },
        heading_level,
        text_align: centered.then(|| "center".to_string()),
        small_text: heading_level.is_none() && font_ratio <= 0.86,
        centered: centered && heading_level.is_none(),
        text_indent,
    }
}

fn pdf_role_extensions(role: &PdfLineRole) -> Option<ReaderBlockExtensions> {
    let mut block_style = ReaderBlockStyleExtension::default();
    if let Some(text_indent) = &role.text_indent {
        block_style.text_indent = Some(text_indent.clone());
    }
    if let Some(text_align) = &role.text_align {
        block_style.text_align = Some(text_align.clone());
    }
    if role.small_text {
        block_style.small_text = Some(true);
    }
    if role.centered {
        block_style.centered = Some(true);
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

fn push_pdf_reader_block(
    blocks: &mut Vec<ReaderContentBlock>,
    text: String,
    start_offset: usize,
    end_offset: usize,
    role: &PdfLineRole,
) {
    blocks.push(ReaderContentBlock {
        id: Uuid::new_v4().to_string(),
        kind: role.kind.clone(),
        text,
        start_offset: Some(start_offset),
        end_offset: Some(end_offset),
        participates_in_linear_text: true,
        heading_level: role.heading_level,
        text_align: role.text_align.clone(),
        spans: None,
        extensions: pdf_role_extensions(role),
    });
}

fn is_pdf_table_candidate_line(line: &PdfLine, body_font_size: f64) -> bool {
    let segment_count = line.segments.len();
    if !(2..=8).contains(&segment_count) {
        return false;
    }

    let line_width = line.x_max - line.x_min;
    if line_width > line.page_width * 0.94 {
        return false;
    }

    let has_substantial_column_gap = line.segments.windows(2).any(|pair| {
        (pair[1].x_min - pair[0].x_max).abs() >= body_font_size.max(line.font_size).max(1.0) * 1.8
    });
    if !has_substantial_column_gap {
        return false;
    }

    line.segments
        .iter()
        .all(|segment| !segment.text.trim().is_empty())
}

fn pdf_table_rows_compatible(
    anchor: &PdfLine,
    previous: &PdfLine,
    candidate: &PdfLine,
    body_font_size: f64,
) -> bool {
    if anchor.page_num != candidate.page_num
        || anchor.segments.len() != candidate.segments.len()
        || !is_pdf_table_candidate_line(candidate, body_font_size)
    {
        return false;
    }

    let row_gap = candidate.y - previous.y;
    if row_gap <= 0.0 || row_gap > body_font_size.max(previous.font_size).max(1.0) * 4.0 {
        return false;
    }

    let column_tolerance = body_font_size.max(anchor.font_size).max(1.0) * 2.0;
    anchor
        .segments
        .iter()
        .zip(candidate.segments.iter())
        .all(|(left, right)| (left.x_min - right.x_min).abs() <= column_tolerance)
}

fn detect_pdf_table_run(lines: &[PdfLine], start: usize, body_font_size: f64) -> Option<usize> {
    let anchor = lines.get(start)?;
    if !is_pdf_table_candidate_line(anchor, body_font_size) {
        return None;
    }

    let mut end = start + 1;
    while let (Some(previous), Some(candidate)) = (lines.get(end - 1), lines.get(end)) {
        if !pdf_table_rows_compatible(anchor, previous, candidate, body_font_size) {
            break;
        }
        end += 1;
    }

    if end - start >= 2 {
        Some(end)
    } else {
        None
    }
}

fn push_pdf_table_block(blocks: &mut Vec<ReaderContentBlock>, lines: &[PdfLine]) {
    let rows = lines
        .iter()
        .enumerate()
        .map(|(row_index, line)| {
            let cells = line
                .segments
                .iter()
                .map(|segment| ReaderTableCell {
                    text: segment.text.clone(),
                    is_header: row_index == 0,
                    spans: None,
                })
                .collect::<Vec<_>>();
            ReaderTableRow { cells }
        })
        .collect::<Vec<_>>();
    let table_text = lines
        .iter()
        .map(|line| {
            line.segments
                .iter()
                .map(|segment| segment.text.as_str())
                .collect::<Vec<_>>()
                .join("\t")
        })
        .collect::<Vec<_>>()
        .join("\n");

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
        extensions: Some(ReaderBlockExtensions {
            table: Some(ReaderTableExtension { rows }),
            ..ReaderBlockExtensions::default()
        }),
    });
}

fn join_pdf_continuation(previous: &mut String, next: &str) {
    if previous.ends_with('-') {
        previous.pop();
        previous.push_str(next.trim_start());
    } else if previous
        .chars()
        .last()
        .map(|ch| ch.is_ascii_alphanumeric())
        .unwrap_or(false)
        && next
            .chars()
            .next()
            .map(|ch| ch.is_ascii_alphanumeric())
            .unwrap_or(false)
    {
        previous.push(' ');
        previous.push_str(next.trim_start());
    } else {
        previous.push('\n');
        previous.push_str(next);
    }
}

fn pdf_layout_to_text_blocks(document: &PdfLayoutDocument) -> (String, Vec<ReaderContentBlock>) {
    let mut lines = document
        .pages
        .iter()
        .flat_map(group_pdf_page_lines)
        .collect::<Vec<_>>();
    lines.sort_by(|left, right| {
        left.page_num
            .cmp(&right.page_num)
            .then_with(|| cmp_f64(left.y, right.y))
            .then_with(|| cmp_f64(left.x_min, right.x_min))
    });

    if lines.is_empty() {
        return (String::new(), Vec::new());
    }

    let mut font_sizes = lines
        .iter()
        .filter(|line| line.text.chars().count() > 2)
        .map(|line| line.font_size)
        .collect::<Vec<_>>();
    let body_font_size = median_f64(&mut font_sizes, 12.0);
    let mut left_edges = lines
        .iter()
        .filter(|line| {
            line.text.chars().count() > 4
                && (line.font_size / body_font_size.max(1.0) - 1.0).abs() <= 0.18
        })
        .map(|line| line.x_min)
        .collect::<Vec<_>>();
    let min_left = lines
        .iter()
        .map(|line| line.x_min)
        .fold(f64::INFINITY, f64::min);
    let typical_left = percentile_f64(&mut left_edges, 0.2, min_left);

    let mut text = String::new();
    let mut blocks = Vec::new();
    let mut active_text = String::new();
    let mut active_role: Option<PdfLineRole> = None;
    let mut active_start = 0;
    let mut previous_line: Option<PdfLine> = None;

    let flush_active = |text: &mut String,
                        blocks: &mut Vec<ReaderContentBlock>,
                        active_text: &mut String,
                        active_role: &mut Option<PdfLineRole>,
                        active_start: &mut usize| {
        let Some(role) = active_role.take() else {
            return;
        };
        if active_text.trim().is_empty() {
            active_text.clear();
            return;
        }
        if !text.is_empty() {
            text.push_str("\n\n");
        }
        *active_start = utf16_len(text);
        text.push_str(active_text);
        let end_offset = utf16_len(text);
        push_pdf_reader_block(
            blocks,
            active_text.clone(),
            *active_start,
            end_offset,
            &role,
        );
        active_text.clear();
    };

    let mut index = 0;
    while index < lines.len() {
        if let Some(table_end) = detect_pdf_table_run(&lines, index, body_font_size) {
            flush_active(
                &mut text,
                &mut blocks,
                &mut active_text,
                &mut active_role,
                &mut active_start,
            );
            push_pdf_table_block(&mut blocks, &lines[index..table_end]);
            previous_line = lines.get(table_end - 1).cloned();
            index = table_end;
            continue;
        }

        let line = lines[index].clone();
        let role = classify_pdf_line(&line, body_font_size, typical_left);
        let previous_gap = previous_line
            .as_ref()
            .filter(|previous| previous.page_num == line.page_num)
            .map(|previous| line.y - previous.y)
            .unwrap_or(f64::INFINITY);
        let hard_break = previous_line
            .as_ref()
            .map(|previous| previous.page_num != line.page_num)
            .unwrap_or(false)
            || previous_gap > body_font_size * 1.75
            || role.kind == "heading"
            || role.text_align.is_some()
            || role.small_text
            || role.text_indent.is_some();
        let same_role = active_role.as_ref().is_some_and(|active| {
            active == &role
                || (active.kind == "paragraph"
                    && role.kind == "paragraph"
                    && active.heading_level.is_none()
                    && role.heading_level.is_none()
                    && active.text_align == role.text_align
                    && active.small_text == role.small_text)
        });
        let can_continue = same_role && !hard_break && role.kind == "paragraph";

        if !can_continue {
            flush_active(
                &mut text,
                &mut blocks,
                &mut active_text,
                &mut active_role,
                &mut active_start,
            );
            active_role = Some(role.clone());
            active_text.push_str(&line.text);
        } else {
            join_pdf_continuation(&mut active_text, &line.text);
        }

        previous_line = Some(line);
        index += 1;
    }

    flush_active(
        &mut text,
        &mut blocks,
        &mut active_text,
        &mut active_role,
        &mut active_start,
    );

    (text, blocks)
}

fn extract_pdf_layout_from_mem(
    bytes: &[u8],
) -> Result<PdfLayoutDocument, pdf_extract::OutputError> {
    let mut doc = pdf_extract::Document::load_mem(bytes)?;
    if doc.is_encrypted() {
        doc.decrypt("")?;
    }
    let mut output = PdfLayoutOutput::new();
    pdf_extract::output_doc(&doc, &mut output)?;
    Ok(output.into_document())
}

fn pdf_notice_payload(
    file_name: String,
    hash: String,
    byte_len: u64,
    notice: &str,
) -> ReaderImportPayload {
    ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title: title_from_file_stem(&file_name),
        file_name,
        source_type: "pdf".to_string(),
        mime_type: "application/pdf".to_string(),
        extractor_version: PDF_EXTRACTOR_VERSION,
        text: notice.to_string(),
        blocks: vec![ReaderContentBlock {
            id: Uuid::new_v4().to_string(),
            kind: "paragraph".to_string(),
            text: notice.to_string(),
            start_offset: Some(0),
            end_offset: Some(utf16_len(notice)),
            participates_in_linear_text: true,
            heading_level: None,
            text_align: None,
            spans: None,
            extensions: None,
        }],
        source_sha256: Some(hash),
        source_byte_length: Some(byte_len),
        source_url: None,
        source_html: None,
        source_data: None,
        import_app_version: None,
    }
}

fn extract_pdf_payload(
    bytes: &[u8],
    file_name: String,
    hash: String,
    byte_len: u64,
) -> Result<ReaderImportPayload, String> {
    let document = match extract_pdf_layout_with(|| extract_pdf_layout_from_mem(bytes)) {
        Ok(document) => document,
        Err(PdfExtractionFailure::Unreadable(error)) => return Err(error),
    };
    let (text, blocks) = pdf_layout_to_text_blocks(&document);
    let (text, blocks) = if text.trim().is_empty() {
        let notice =
            "This PDF does not contain extractable text (it may be scanned or image-only).";
        return Ok(pdf_notice_payload(file_name, hash, byte_len, notice));
    } else {
        (normalize_line_endings(&text), blocks)
    };

    Ok(ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title: title_from_file_stem(&file_name),
        file_name,
        source_type: "pdf".to_string(),
        mime_type: "application/pdf".to_string(),
        extractor_version: PDF_EXTRACTOR_VERSION,
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

fn extract_html_file_payload(
    bytes: &[u8],
    file_name: String,
    hash: String,
    byte_len: u64,
) -> Result<ReaderImportPayload, String> {
    let html = std::str::from_utf8(bytes).map_err(|_| "HTML file must be UTF-8.".to_string())?;
    let (text, blocks, html_title) = html_to_blocks(html, None);
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
        source_html: None,
        source_data: None,
        import_app_version: None,
    })
}

fn prepare_from_html(
    html: &str,
    title_override: Option<&str>,
    source_url: Option<String>,
) -> Result<ReaderImportPayload, String> {
    let parsed_source_url = source_url
        .as_deref()
        .and_then(|value| reqwest::Url::parse(value).ok());
    let (text, blocks, html_title) = html_to_blocks(html, parsed_source_url.as_ref());
    if text.trim().is_empty() && blocks.is_empty() {
        return Err("HTML import did not contain readable text.".to_string());
    }
    let title = title_override
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or(html_title)
        .unwrap_or_else(|| "Web import".to_string());

    Ok(ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title,
        file_name: "webpage.html".to_string(),
        source_type: "webpage".to_string(),
        mime_type: "text/html".to_string(),
        extractor_version: HTML_EXTRACTOR_VERSION,
        text,
        blocks,
        source_sha256: None,
        source_byte_length: None,
        source_url,
        source_html: Some(html.to_string()),
        source_data: None,
        import_app_version: None,
    })
}

fn prepare_from_bytes(
    bytes: &[u8],
    file_name: &str,
    mime_hint: Option<&str>,
) -> Result<ReaderImportPayload, String> {
    let path = Path::new(file_name);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime_lower = mime_hint
        .map(|value| value.to_lowercase())
        .unwrap_or_default();

    let hash = sha256_hex(bytes);
    let byte_len = bytes.len() as u64;

    if TEXT_IMPORT_EXTENSIONS.contains(&extension.as_str()) || mime_lower == "text/plain" {
        let raw_text =
            std::str::from_utf8(bytes).map_err(|_| "Text file must be valid UTF-8.".to_string())?;
        let mut payload = extract_plain_text_document(
            title_from_file_stem(file_name),
            file_name.to_string(),
            raw_text.to_string(),
        );
        payload.source_sha256 = Some(hash);
        payload.source_byte_length = Some(byte_len);
        return Ok(payload);
    }

    if DOCX_IMPORT_EXTENSIONS.contains(&extension.as_str())
        || mime_lower == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    {
        return extract_docx_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    if EPUB_IMPORT_EXTENSIONS.contains(&extension.as_str()) || mime_lower == "application/epub+zip"
    {
        return extract_epub_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    if PDF_IMPORT_EXTENSIONS.contains(&extension.as_str()) || mime_lower == "application/pdf" {
        return extract_pdf_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    if HTML_IMPORT_EXTENSIONS.contains(&extension.as_str()) || mime_lower == "text/html" {
        return extract_html_file_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    Err(format!(
        "Unsupported reader import type (extension {extension:?}, mime {mime_hint:?})."
    ))
}

#[tauri::command]
pub fn prepare_reader_import(args: PrepareReaderImportArgs) -> Result<ReaderImportPayload, String> {
    if args
        .path
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        return Err(
            "Path import is only available through the native reader file picker.".to_string(),
        );
    }

    let url = args
        .url
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());

    if let Some(url) = url {
        if args.source_base64.is_some() || args.path.is_some() || args.html.is_some() {
            return Err("URL import must not include path, sourceBase64, or html.".to_string());
        }
        let result = fetch_webpage_html(url, args.allow_large_html)?;
        return prepare_from_html(&result.html, args.title.as_deref(), Some(result.final_url));
    }

    let html = args
        .html
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());

    if let Some(html_body) = html {
        if args.source_base64.is_some() || args.path.is_some() {
            return Err("HTML import must not include path or sourceBase64.".to_string());
        }
        return prepare_from_html(html_body, args.title.as_deref(), None);
    }

    if let Some(raw_text) = args.text.as_ref() {
        if args.source_base64.is_some() || args.path.is_some() {
            return Err("Text import must not include path or sourceBase64.".to_string());
        }
        let title = args
            .title
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| infer_plain_text_title(raw_text));
        let file_name = args
            .file_name
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "clipboard.txt".to_string());
        return Ok(extract_plain_text_document(
            title,
            file_name,
            raw_text.clone(),
        ));
    }

    let source_b64 = args
        .source_base64
        .as_ref()
        .ok_or_else(|| "Missing path, sourceBase64, html, text, or url.".to_string())?;
    let file_name = args
        .file_name
        .as_ref()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "fileName is required with sourceBase64.".to_string())?;

    let decoded = BASE64_STANDARD
        .decode(source_b64.as_bytes())
        .map_err(|error| format!("Invalid base64 source: {}", error))?;

    prepare_from_bytes(&decoded, file_name, args.mime_type.as_deref())
}

fn fetch_webpage_html(url: &str, allow_large_html: bool) -> Result<WebpageFetchResult, String> {
    let parsed = reqwest::Url::parse(url).map_err(|error| format!("Invalid URL: {}", error))?;
    validate_remote_url(&parsed, true)?;

    tauri::async_runtime::block_on(async {
        let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= WEBPAGE_REDIRECT_LIMIT {
                return attempt.error("Reader webpage import followed too many redirects.");
            }
            match validate_remote_url(attempt.url(), true) {
                Ok(()) => attempt.follow(),
                Err(error) => attempt.error(error),
            }
        });
        let response = reqwest::Client::builder()
            .user_agent("Syng reader import")
            .connect_timeout(Duration::from_secs(WEBPAGE_CONNECT_TIMEOUT_SECONDS))
            .timeout(Duration::from_secs(WEBPAGE_REQUEST_TIMEOUT_SECONDS))
            .redirect(redirect_policy)
            .build()
            .map_err(|error| format!("Could not create HTTP client: {}", error))?
            .get(parsed)
            .send()
            .await
            .map_err(|error| format!("Could not fetch webpage: {}", error))?;

        if !response.status().is_success() {
            return Err(format!("Webpage returned HTTP {}.", response.status()));
        }

        if let Some(content_length) = response.content_length() {
            let content_length = content_length as usize;
            if content_length > WEBPAGE_MAX_HTML_BYTES {
                return Err(format!(
                    "Webpage response is too large to import ({} bytes).",
                    content_length
                ));
            }
            if content_length > WEBPAGE_LARGE_HTML_WARNING_BYTES && !allow_large_html {
                return Err(large_html_confirmation_error(content_length));
            }
        }

        let final_url = response.url().to_string();
        let mut bytes = Vec::new();
        let mut response = response;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Could not read webpage response: {}", error))?
        {
            let next_len = bytes.len() + chunk.len();
            if next_len > WEBPAGE_MAX_HTML_BYTES {
                return Err(format!(
                    "Webpage response is too large to import (more than {} bytes).",
                    WEBPAGE_MAX_HTML_BYTES
                ));
            }
            if next_len > WEBPAGE_LARGE_HTML_WARNING_BYTES && !allow_large_html {
                return Err(large_html_confirmation_error(next_len));
            }
            bytes.extend_from_slice(&chunk);
        }

        let html = String::from_utf8_lossy(&bytes).to_string();
        if html.trim().is_empty() {
            return Err("Webpage response was empty.".to_string());
        }
        Ok(WebpageFetchResult { html, final_url })
    })
}

#[tauri::command(async)]
pub async fn import_reader_document(
    app: tauri::AppHandle,
) -> Result<Option<ReaderImportPayload>, String> {
    let file_path = app
        .dialog()
        .file()
        .set_title("Import Reading Document")
        .add_filter(
            "Reader documents",
            &["txt", "text", "epub", "pdf", "html", "htm", "docx"],
        )
        .blocking_pick_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };

    let file_path_display = file_path.to_string();
    let path = Path::new(&file_path_display);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Untitled.txt")
        .to_string();

    let bytes = app
        .fs()
        .read(file_path)
        .map_err(|err| format!("Failed to read the selected document: {}", err))?;

    let mut payload = prepare_from_bytes(&bytes, &file_name, None)?;
    payload.source_data = Some(bytes);
    Ok(Some(payload))
}

#[tauri::command]
pub fn tokenize_reader_text(text: String) -> Vec<ReaderToken> {
    let mut cursor = 0;
    chinese_dictionary::tokenize(&text)
        .into_iter()
        .filter_map(|token| {
            let token_text = token.to_string();
            let byte_start = text[cursor..]
                .find(&token_text)
                .map(|offset| cursor + offset)?;
            let byte_end = byte_start + token_text.len();
            let start = utf16_len(&text[..byte_start]);
            let end = start + utf16_len(&token_text);
            cursor = byte_end;
            Some(ReaderToken {
                text: token_text,
                start,
                end,
            })
        })
        .collect()
}

fn extract_plain_text_document(
    title: String,
    file_name: String,
    raw_text: String,
) -> ReaderImportPayload {
    let text = normalize_line_endings(&raw_text);
    let blocks = extract_text_blocks(&text);

    ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title,
        file_name,
        source_type: "plain_text".to_string(),
        mime_type: "text/plain".to_string(),
        extractor_version: TEXT_EXTRACTOR_VERSION,
        text,
        blocks,
        source_sha256: None,
        source_byte_length: None,
        source_url: None,
        source_html: None,
        source_data: None,
        import_app_version: None,
    }
}

fn normalize_line_endings(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn infer_plain_text_title(raw_text: &str) -> String {
    normalize_line_endings(raw_text)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(80).collect::<String>())
        .filter(|line| !line.is_empty())
        .unwrap_or_else(|| "Untitled".to_string())
}

fn extract_text_blocks(text: &str) -> Vec<ReaderContentBlock> {
    let mut blocks = Vec::new();
    let mut block_start: Option<usize> = None;
    let mut block_lines: Vec<&str> = Vec::new();
    let mut utf16_cursor = 0;

    for line in text.split_inclusive('\n') {
        let line_without_break = line.strip_suffix('\n').unwrap_or(line);
        let line_utf16_start = utf16_cursor;
        let line_utf16_len = utf16_len(line);

        if line_without_break.trim().is_empty() {
            if let Some(start_offset) = block_start {
                push_text_block(&mut blocks, start_offset, line_utf16_start, &block_lines);
                block_start = None;
                block_lines.clear();
            }
        } else {
            if block_start.is_none() {
                block_start = Some(line_utf16_start);
            }
            block_lines.push(line_without_break);
        }

        utf16_cursor += line_utf16_len;
    }

    if let Some(start_offset) = block_start {
        push_text_block(&mut blocks, start_offset, utf16_len(text), &block_lines);
    }

    if blocks.is_empty() && text.trim().is_empty() {
        blocks.push(ReaderContentBlock {
            id: Uuid::new_v4().to_string(),
            kind: "paragraph".to_string(),
            text: String::new(),
            start_offset: Some(0),
            end_offset: Some(utf16_len(text)),
            participates_in_linear_text: true,
            heading_level: None,
            text_align: None,
            spans: None,
            extensions: None,
        });
    }

    blocks
}

fn push_text_block(
    blocks: &mut Vec<ReaderContentBlock>,
    start_offset: usize,
    end_offset: usize,
    lines: &[&str],
) {
    let text = lines.join("\n");
    blocks.push(ReaderContentBlock {
        id: Uuid::new_v4().to_string(),
        kind: "paragraph".to_string(),
        text,
        start_offset: Some(start_offset),
        end_offset: Some(end_offset),
        participates_in_linear_text: true,
        heading_level: None,
        text_align: None,
        spans: None,
        extensions: None,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn build_test_docx(document_xml: &str, core_xml: Option<&str>) -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut bytes);
            let options = SimpleFileOptions::default();
            writer
                .start_file("[Content_Types].xml", options)
                .expect("content types");
            writer
                .write_all(
                    br#"<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>"#,
                )
                .expect("write content types");
            writer
                .start_file("word/document.xml", options)
                .expect("document");
            writer
                .write_all(document_xml.as_bytes())
                .expect("write document");
            if let Some(core_xml) = core_xml {
                writer
                    .start_file("docProps/core.xml", options)
                    .expect("core");
                writer.write_all(core_xml.as_bytes()).expect("write core");
            }
            writer.finish().expect("finish docx");
        }
        bytes.into_inner()
    }

    #[test]
    fn extracts_plain_text_blocks_and_normalizes_line_endings() {
        let payload = extract_plain_text_document(
            "Sample".to_string(),
            "sample.txt".to_string(),
            "Title\r\n\r\n你好今天的天气还好。\r\nSecond line.".to_string(),
        );

        assert_eq!(payload.canonical_schema_version, 1);
        assert_eq!(payload.text, "Title\n\n你好今天的天气还好。\nSecond line.");
        assert_eq!(payload.blocks.len(), 2);
        assert_eq!(payload.blocks[0].kind, "paragraph");
        assert_eq!(payload.blocks[0].text, "Title");
        assert_eq!(payload.blocks[1].kind, "paragraph");
        assert_eq!(payload.blocks[1].text, "你好今天的天气还好。\nSecond line.");
    }

    #[test]
    fn tokenizes_chinese_text() {
        let tokens = tokenize_reader_text("你好今天的天气还好。".to_string());
        assert!(tokens
            .iter()
            .any(|token| token.text == "你好" && token.start == 0));
        assert!(tokens.iter().any(|token| token.text == "今天"));
    }

    #[test]
    fn classifies_chinese_paragraph_ending_with_closing_quote_as_paragraph() {
        let payload = extract_plain_text_document(
            "Sample".to_string(),
            "sample.txt".to_string(),
            "他笑着说：“这条巷子里的人平时看起来都很忙，但不代表他们没有心。”".to_string(),
        );

        assert_eq!(payload.blocks.len(), 1);
        assert_eq!(payload.blocks[0].kind, "paragraph");
    }

    #[test]
    fn prepare_reader_import_html_produces_text() {
        let payload = prepare_reader_import(PrepareReaderImportArgs {
            path: None,
            source_base64: None,
            file_name: None,
            mime_type: None,
            html: Some("<article><p>Alpha <strong>Beta</strong></p></article>".to_string()),
            text: None,
            title: Some("T".to_string()),
            url: None,
            allow_large_html: false,
        })
        .expect("html import");

        assert_eq!(payload.title, "T");
        assert!(payload.text.contains("Alpha"));
        assert!(payload.text.contains("Beta"));
        assert_eq!(payload.source_type, "webpage");
    }

    #[test]
    fn docx_import_preserves_document_structure_and_inline_styles() {
        let bytes = build_test_docx(
            r#"<?xml version="1.0" encoding="UTF-8"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                <w:body>
                    <w:p>
                        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
                        <w:r><w:t>第一章</w:t></w:r>
                    </w:p>
                    <w:p>
                        <w:r><w:t>普通文本和</w:t></w:r>
                        <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>重点</w:t></w:r>
                    </w:p>
                    <w:p>
                        <w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr>
                        <w:r><w:t>列表项</w:t></w:r>
                    </w:p>
                    <w:tbl>
                        <w:tr>
                            <w:tc><w:p><w:r><w:t>词</w:t></w:r></w:p></w:tc>
                            <w:tc><w:p><w:r><w:t>你好</w:t></w:r></w:p></w:tc>
                        </w:tr>
                    </w:tbl>
                </w:body>
            </w:document>"#,
            Some(
                r#"<?xml version="1.0" encoding="UTF-8"?>
                <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
                    <dc:title>测试文档</dc:title>
                </cp:coreProperties>"#,
            ),
        );

        let payload = extract_docx_payload(
            &bytes,
            "sample.docx".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("docx import");

        assert_eq!(payload.title, "测试文档");
        assert_eq!(payload.source_type, "docx");
        assert_eq!(
            payload.mime_type,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        assert_eq!(payload.blocks[0].kind, "heading");
        assert_eq!(payload.blocks[0].heading_level, Some(1));
        assert_eq!(payload.blocks[1].text, "普通文本和重点");
        assert!(payload.blocks[1]
            .spans
            .as_ref()
            .expect("inline spans")
            .iter()
            .any(|span| span.style == "strong"));
        assert_eq!(payload.blocks[2].kind, "list_item");
        assert_eq!(
            payload.blocks[2]
                .extensions
                .as_ref()
                .and_then(|extensions| extensions.list_item.as_ref())
                .map(|list_item| list_item.nesting_depth),
            Some(1)
        );
        assert_eq!(payload.blocks[3].kind, "table");
        assert_eq!(
            payload.blocks[3]
                .extensions
                .as_ref()
                .and_then(|extensions| extensions.table.as_ref())
                .map(|table| table.rows[0].cells[1].text.as_str()),
            Some("你好")
        );
    }

    #[test]
    fn prepare_reader_import_accepts_docx_mime_type() {
        let bytes = build_test_docx(
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>你好</w:t></w:r></w:p></w:body></w:document>"#,
            None,
        );

        let payload = prepare_from_bytes(
            &bytes,
            "sample.bin",
            Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        )
        .expect("docx import from mime");

        assert_eq!(payload.source_type, "docx");
        assert_eq!(payload.text, "你好");
    }

    #[test]
    fn html_import_preserves_structural_blocks() {
        let payload = prepare_reader_import(PrepareReaderImportArgs {
            path: None,
            source_base64: None,
            file_name: None,
            mime_type: None,
            html: Some(
                r#"
                <article>
                    <h2>Chapter</h2>
                    <p>First paragraph.</p>
                    <ul><li>List item</li></ul>
                    <blockquote>Quote</blockquote>
                    <table><tr><th>Word</th><td>你好</td></tr></table>
                    <img src="https://example.com/image.png" alt="Cover">
                </article>
                "#
                .to_string(),
            ),
            text: None,
            title: None,
            url: None,
            allow_large_html: false,
        })
        .expect("html import");

        assert_eq!(payload.blocks[0].kind, "heading");
        assert_eq!(payload.blocks[0].heading_level, Some(2));
        assert!(payload.blocks.iter().any(|block| block.kind == "list_item"));
        assert!(payload
            .blocks
            .iter()
            .any(|block| block.kind == "blockquote"));
        assert!(payload.blocks.iter().any(|block| {
            block.kind == "table"
                && block.participates_in_linear_text == false
                && block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.table.as_ref())
                    .is_some()
        }));
        assert!(payload.blocks.iter().any(|block| {
            block.kind == "image"
                && block.participates_in_linear_text == false
                && block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.image.as_ref())
                    .and_then(|value| value.inline_src.as_deref())
                    == Some("https://example.com/image.png")
        }));
    }

    #[test]
    fn html_import_strips_unsafe_image_sources() {
        let base_url = reqwest::Url::parse("https://example.com/articles/story.html").unwrap();
        let (_, blocks, _) = html_to_blocks(
            r#"
                <img src="/cover.png" alt="Cover">
                <img src="file:///etc/passwd" alt="File">
                <img src="http://127.0.0.1/track.png" alt="Local">
            "#,
            Some(&base_url),
        );

        let image_sources = blocks
            .iter()
            .filter(|block| block.kind == "image")
            .map(|block| {
                block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.image.as_ref())
                    .and_then(|value| value.inline_src.as_deref())
            })
            .collect::<Vec<_>>();

        assert_eq!(
            image_sources,
            vec![Some("https://example.com/cover.png"), None, None]
        );
    }

    #[test]
    fn webpage_url_validation_rejects_local_targets() {
        for url in [
            "http://localhost/article",
            "http://127.0.0.1/article",
            "http://[::1]/article",
            "file:///tmp/article.html",
            "https://user@example.com/article",
        ] {
            let parsed = reqwest::Url::parse(url).expect("parse url");
            assert!(
                validate_remote_url(&parsed, false).is_err(),
                "expected {url} to be rejected"
            );
        }
    }

    #[test]
    fn large_html_error_is_structured_json() {
        let error = large_html_confirmation_error(WEBPAGE_LARGE_HTML_WARNING_BYTES + 1);
        let parsed: Value = serde_json::from_str(&error).expect("json error");

        assert_eq!(parsed["code"], LARGE_HTML_ERROR_CODE);
        assert_eq!(
            parsed["receivedBytes"],
            WEBPAGE_LARGE_HTML_WARNING_BYTES + 1
        );
    }

    #[test]
    fn html_import_preserves_image_alt_when_source_is_blocked() {
        let (_, blocks, _) =
            html_to_blocks(r#"<img src="file:///tmp/cover.png" alt="Cover">"#, None);

        let image = blocks
            .iter()
            .find(|block| block.kind == "image")
            .expect("image block");
        assert_eq!(image.text, "Cover");
        assert_eq!(
            image
                .extensions
                .as_ref()
                .and_then(|value| value.image.as_ref())
                .and_then(|value| value.inline_src.as_ref()),
            None
        );
    }

    #[test]
    fn html_import_preserves_epub_like_fidelity_hints() {
        let (text, blocks, _) = html_to_blocks(
            r#"
            <html>
                <head><title>Fixture</title></head>
                <body>
                    <h1>第一章</h1>
                    <p class="subtitle center">副标题</p>
                    <p style="text-indent: 2em">缩进段落 <ruby>漢<rt>han</rt></ruby> 字。</p>
                    <div class="note box">提示内容</div>
                    <hr />
                    <div class="poem center">春眠不觉晓<br/>处处闻啼鸟</div>
                    <table><tr><th>词</th><th>义</th></tr><tr><td>山</td><td>mountain</td></tr></table>
                    <ol start="3"><li>甲</li><li>乙</li></ol>
                </body>
            </html>
            "#,
            None,
        );

        assert!(text.contains("漢 字"));
        assert!(!text.contains("han"));
        assert!(blocks.iter().any(|block| {
            block.kind == "paragraph"
                && block.text == "副标题"
                && block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.block_style.as_ref())
                    .and_then(|value| value.centered)
                    == Some(true)
        }));
        assert!(blocks.iter().any(|block| {
            block.kind == "aside"
                && block.text == "提示内容"
                && block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.block_style.as_ref())
                    .and_then(|value| value.boxed)
                    == Some(true)
        }));
        assert!(blocks.iter().any(|block| block.kind == "thematic_break"));
        assert!(blocks
            .iter()
            .any(|block| block.text == "春眠不觉晓\n处处闻啼鸟"));
        assert!(blocks.iter().any(|block| {
            block.kind == "table"
                && block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.table.as_ref())
                    .and_then(|value| value.rows.first())
                    .and_then(|value| value.cells.first())
                    .map(|value| value.is_header)
                    == Some(true)
        }));
        let ordinals = blocks
            .iter()
            .filter(|block| block.kind == "list_item")
            .filter_map(|block| {
                block
                    .extensions
                    .as_ref()
                    .and_then(|value| value.list_item.as_ref())
                    .and_then(|value| value.ordinal)
            })
            .collect::<Vec<_>>();
        assert_eq!(ordinals, vec![3, 4]);
    }

    #[test]
    fn html_import_marks_vertical_writing_mode() {
        let (_, blocks, _) = html_to_blocks(
            r#"<section style="writing-mode: vertical-rl"><p>直排文字</p></section>"#,
            None,
        );

        assert!(blocks.iter().any(|block| {
            block
                .extensions
                .as_ref()
                .and_then(|value| value.block_style.as_ref())
                .and_then(|value| value.vertical_writing_mode)
                == Some(true)
        }));
    }

    #[test]
    fn pdf_extract_decodes_unigb_ucs2_text() {
        use lopdf::content::{Content, Operation};
        use lopdf::{dictionary, Document, Object, Stream, StringFormat};

        let mut doc = Document::new();
        let pages_id = doc.new_object_id();
        let text = "中文测试";
        let encoded_text = text
            .encode_utf16()
            .flat_map(|unit| unit.to_be_bytes())
            .collect::<Vec<_>>();

        let font_descriptor_id = doc.add_object(dictionary! {
            "Type" => "FontDescriptor",
            "FontName" => "SimSun",
            "Flags" => 4,
            "FontBBox" => vec![0.into(), (-200).into(), 1000.into(), 900.into()],
            "ItalicAngle" => 0,
            "Ascent" => 880,
            "Descent" => -120,
            "CapHeight" => 700,
            "StemV" => 80,
        });
        let cid_font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "CIDFontType2",
            "BaseFont" => "SimSun",
            "CIDSystemInfo" => dictionary! {
                "Registry" => Object::string_literal("Adobe"),
                "Ordering" => Object::string_literal("GB1"),
                "Supplement" => 5,
            },
            "FontDescriptor" => font_descriptor_id,
            "DW" => 1000,
        });
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type0",
            "BaseFont" => "SimSun",
            "Encoding" => "UniGB-UCS2-H",
            "DescendantFonts" => vec![cid_font_id.into()],
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 16.into()]),
                Operation::new("Td", vec![72.into(), 720.into()]),
                Operation::new(
                    "Tj",
                    vec![Object::String(encoded_text, StringFormat::Hexadecimal)],
                ),
                Operation::new("ET", vec![]),
            ],
        };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });

        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![page_id.into()],
                "Count" => 1,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).expect("write pdf");

        let pages = extract_pdf_pages_with(|| pdf_extract::extract_text_from_mem_by_pages(&bytes))
            .expect("extract pages");

        assert_eq!(pages.len(), 1);
        assert!(pages[0].contains(text), "{:?}", pages[0]);

        let payload = extract_pdf_payload(
            &bytes,
            "unigb.pdf".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("pdf import payload");
        assert!(payload.text.contains(text), "{:?}", payload.text);
        assert!(!payload.text.contains("cannot extract"));
    }

    #[test]
    fn pdf_import_preserves_basic_layout_hints() {
        use lopdf::content::{Content, Operation};
        use lopdf::{dictionary, Document, Object, Stream, StringFormat};

        let mut doc = Document::new();
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let text_at = |font_size: i64, x: i64, y: i64, text: &str| {
            vec![
                Operation::new("Tf", vec!["F1".into(), font_size.into()]),
                Operation::new(
                    "Tm",
                    vec![1.into(), 0.into(), 0.into(), 1.into(), x.into(), y.into()],
                ),
                Operation::new(
                    "Tj",
                    vec![Object::String(
                        text.as_bytes().to_vec(),
                        StringFormat::Literal,
                    )],
                ),
            ]
        };
        let mut operations = vec![Operation::new("BT", vec![])];
        operations.extend(text_at(24, 218, 760, "Centered Title"));
        operations.extend(text_at(12, 108, 710, "Indented first line"));
        operations.extend(text_at(12, 72, 692, "Continuation line"));
        operations.extend(text_at(8, 72, 640, "Small caption"));
        operations.push(Operation::new("ET", vec![]));

        let content = Content { operations };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });

        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![page_id.into()],
                "Count" => 1,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 600.into(), 800.into()],
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).expect("write pdf");
        let payload = extract_pdf_payload(
            &bytes,
            "layout.pdf".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("pdf import payload");

        let title = payload
            .blocks
            .iter()
            .find(|block| block.text == "Centered Title")
            .expect("title block");
        assert_eq!(title.kind, "heading");
        assert_eq!(title.heading_level, Some(1));
        assert_eq!(title.text_align.as_deref(), Some("center"));

        let body = payload
            .blocks
            .iter()
            .find(|block| block.text.contains("Indented first line"))
            .expect("body block");
        assert!(body.text.contains("Continuation line"), "{:?}", body.text);
        assert_eq!(
            body.extensions
                .as_ref()
                .and_then(|value| value.block_style.as_ref())
                .and_then(|value| value.text_indent.as_deref()),
            Some("3.0em")
        );

        let small = payload
            .blocks
            .iter()
            .find(|block| block.text == "Small caption")
            .expect("small block");
        assert_eq!(
            small
                .extensions
                .as_ref()
                .and_then(|value| value.block_style.as_ref())
                .and_then(|value| value.small_text),
            Some(true)
        );
    }

    #[test]
    fn pdf_import_preserves_simple_tables_from_aligned_columns() {
        use lopdf::content::{Content, Operation};
        use lopdf::{dictionary, Document, Object, Stream, StringFormat};

        let mut doc = Document::new();
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let text_at = |font_size: i64, x: i64, y: i64, text: &str| {
            vec![
                Operation::new("Tf", vec!["F1".into(), font_size.into()]),
                Operation::new(
                    "Tm",
                    vec![1.into(), 0.into(), 0.into(), 1.into(), x.into(), y.into()],
                ),
                Operation::new(
                    "Tj",
                    vec![Object::String(
                        text.as_bytes().to_vec(),
                        StringFormat::Literal,
                    )],
                ),
            ]
        };
        let mut operations = vec![Operation::new("BT", vec![])];
        operations.extend(text_at(12, 72, 740, "Before table paragraph."));
        operations.extend(text_at(12, 72, 700, "Word"));
        operations.extend(text_at(12, 210, 700, "Pinyin"));
        operations.extend(text_at(12, 350, 700, "Meaning"));
        operations.extend(text_at(12, 72, 682, "shan"));
        operations.extend(text_at(12, 210, 682, "shan"));
        operations.extend(text_at(12, 350, 682, "mountain"));
        operations.extend(text_at(12, 72, 664, "shui"));
        operations.extend(text_at(12, 210, 664, "shui"));
        operations.extend(text_at(12, 350, 664, "water"));
        operations.extend(text_at(12, 72, 620, "After table paragraph."));
        operations.push(Operation::new("ET", vec![]));

        let content = Content { operations };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });

        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![page_id.into()],
                "Count" => 1,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 600.into(), 800.into()],
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).expect("write pdf");
        let payload = extract_pdf_payload(
            &bytes,
            "table.pdf".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("pdf import payload");

        let table = payload
            .blocks
            .iter()
            .find(|block| block.kind == "table")
            .expect("table block");
        assert!(!table.participates_in_linear_text);
        assert_eq!(table.start_offset, None);
        assert!(payload.text.contains("Before table paragraph."));
        assert!(payload.text.contains("After table paragraph."));
        assert!(!payload.text.contains("Word\tPinyin\tMeaning"));

        let rows = table
            .extensions
            .as_ref()
            .and_then(|value| value.table.as_ref())
            .map(|value| value.rows.as_slice())
            .expect("table rows");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].cells[0].text, "Word");
        assert!(rows[0].cells[0].is_header);
        assert_eq!(rows[1].cells[0].text, "shan");
        assert_eq!(rows[1].cells[1].text, "shan");
        assert_eq!(rows[1].cells[2].text, "mountain");
        assert_eq!(rows[2].cells[0].text, "shui");
        assert_eq!(rows[2].cells[2].text, "water");
    }

    #[test]
    fn pdf_table_detector_accepts_wide_spaced_chinese_rows() {
        let segment = |text: &str, x_min: f64, x_max: f64| PdfLineSegment {
            text: text.to_string(),
            x_min,
            x_max,
        };
        let line = |text: &str, y: f64, segments: Vec<PdfLineSegment>| PdfLine {
            text: text.to_string(),
            x_min: segments.first().map(|segment| segment.x_min).unwrap_or(0.0),
            x_max: segments.last().map(|segment| segment.x_max).unwrap_or(0.0),
            segments,
            y,
            font_size: 10.5,
            page_num: 3,
            page_width: 419.5,
        };
        let lines = vec![
            line(
                "线索 位置 备注",
                420.0,
                vec![
                    segment("线索", 51.2, 72.2),
                    segment("位置", 144.7, 165.7),
                    segment("备注", 243.9, 264.9),
                ],
            ),
            line(
                "铜铃 外婆家门口 雨后会响",
                452.0,
                vec![
                    segment("铜铃", 51.2, 70.2),
                    segment("外婆家门口", 144.7, 192.2),
                    segment("雨后会响", 243.9, 281.9),
                ],
            ),
            line(
                "旧井 南山脚下 井壁有刻痕",
                484.0,
                vec![
                    segment("旧井", 51.2, 70.2),
                    segment("南山脚下", 144.7, 182.7),
                    segment("井壁有刻痕", 243.9, 291.4),
                ],
            ),
            line(
                "青梅树 荒院东侧 花期提前",
                516.0,
                vec![
                    segment("青梅树", 51.2, 79.7),
                    segment("荒院东侧", 144.7, 182.7),
                    segment("花期提前", 243.9, 281.9),
                ],
            ),
        ];

        assert_eq!(detect_pdf_table_run(&lines, 0, 10.5), Some(4));

        let mut blocks = Vec::new();
        push_pdf_table_block(&mut blocks, &lines);
        let rows = blocks[0]
            .extensions
            .as_ref()
            .and_then(|value| value.table.as_ref())
            .map(|value| value.rows.as_slice())
            .expect("table rows");
        assert_eq!(rows[0].cells[0].text, "线索");
        assert_eq!(rows[1].cells[1].text, "外婆家门口");
        assert_eq!(rows[3].cells[2].text, "花期提前");
    }

    #[test]
    fn pdf_line_classifier_does_not_center_body_prose_by_symmetry() {
        let body_font_size = 10.5;
        let typical_left = 48.2;
        let centered_subtitle = classify_pdf_line(
            &PdfLine {
                text: "一个用于中文阅读器测试的短篇样张".to_string(),
                segments: Vec::new(),
                x_min: 121.8,
                x_max: 297.8,
                y: 127.6,
                font_size: 11.0,
                page_num: 1,
                page_width: 419.5,
            },
            body_font_size,
            typical_left,
        );
        assert_eq!(centered_subtitle.text_align.as_deref(), Some("center"));

        let indented_prose = classify_pdf_line(
            &PdfLine {
                text: "雨停以后，城南的小巷像被人重新擦亮。青石板上积着浅".to_string(),
                segments: Vec::new(),
                x_min: 68.2,
                x_max: 330.7,
                y: 204.1,
                font_size: body_font_size,
                page_num: 1,
                page_width: 419.5,
            },
            body_font_size,
            typical_left,
        );
        assert_eq!(indented_prose.text_align, None);
        assert_eq!(indented_prose.text_indent.as_deref(), Some("1.9em"));

        let continuation_prose = classify_pdf_line(
            &PdfLine {
                text: "浅的水，倒映出屋檐、灯笼，以及一只从墙头跳下来的花".to_string(),
                segments: Vec::new(),
                x_min: typical_left,
                x_max: 310.7,
                y: 220.1,
                font_size: body_font_size,
                page_num: 1,
                page_width: 419.5,
            },
            body_font_size,
            typical_left,
        );
        assert_eq!(continuation_prose.text_align, None);
        assert_eq!(continuation_prose.text_indent, None);
    }

    #[test]
    fn prepare_reader_import_plain_base64_sets_sha256() {
        let utf8 = "Line one\n\nLine two.";
        let encoded = BASE64_STANDARD.encode(utf8);
        let payload = prepare_reader_import(PrepareReaderImportArgs {
            path: None,
            source_base64: Some(encoded),
            file_name: Some("note.txt".to_string()),
            mime_type: Some("text/plain".to_string()),
            html: None,
            text: None,
            title: None,
            url: None,
            allow_large_html: false,
        })
        .expect("txt import");

        assert_eq!(payload.source_sha256, Some(sha256_hex(utf8.as_bytes())));
        assert_eq!(payload.source_byte_length, Some(utf8.len() as u64));
    }

    #[test]
    fn prepare_reader_import_rejects_renderer_path_reads() {
        let temp = tempfile::tempdir().expect("tempdir");
        let file_path = temp.path().join("path-import.txt");
        std::fs::write(&file_path, "Line one\n\nLine two.").expect("write test file");

        let error = prepare_reader_import(PrepareReaderImportArgs {
            path: Some(file_path.to_string_lossy().to_string()),
            source_base64: None,
            file_name: Some("path-import.txt".to_string()),
            mime_type: Some("text/plain".to_string()),
            html: None,
            text: None,
            title: None,
            url: None,
            allow_large_html: false,
        })
        .expect_err("renderer path import should be rejected");

        assert!(error.contains("native reader file picker"));
    }
}
