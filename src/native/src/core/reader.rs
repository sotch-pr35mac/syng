//! Reader import and tokenization.
//!
//! Rust owns the canonical import pipeline for files, raw text/HTML, and webpages. Payload offsets
//! crossing IPC are JavaScript UTF-16 code unit indices because the Svelte renderer paginates with
//! `String.length` and `String.prototype.slice`.

mod docx;
mod epub;
mod html;
mod pdf;
mod rtf;
mod text;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use encoding_rs::{BIG5, GBK, UTF_16BE, UTF_16LE, UTF_8};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::io::{Cursor, Read};
use std::net::{IpAddr, Ipv4Addr, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
use tauri_plugin_http::reqwest;

use docx::DocxFormat;
use epub::EpubFormat;
use html::html_to_blocks;
use html::HtmlFileFormat;
use pdf::PdfFormat;
use rtf::RtfFormat;
use text::{extract_plain_text_document, infer_plain_text_title, PlainTextFormat};

use docx::docx_table_text;
use html::append_linear_block;
use text::{extract_text_blocks, normalize_line_endings};

const TEXT_EXTRACTOR_VERSION: u8 = 1;
const EPUB_EXTRACTOR_VERSION: u8 = 2;
const PDF_EXTRACTOR_VERSION: u8 = 3;
const HTML_EXTRACTOR_VERSION: u8 = 2;
const DOCX_EXTRACTOR_VERSION: u8 = 1;
const RTF_EXTRACTOR_VERSION: u8 = 1;
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
const RTF_IMPORT_EXTENSIONS: &[&str] = &["rtf"];

/// A file format that can be imported into the reader.
///
/// Implementors extract structured content blocks and linear text from raw file bytes,
/// producing a [`ReaderImportPayload`] ready for frontend consumption.
pub(crate) trait FormatExtractor {
    /// Extract a reader import payload from the raw bytes of a file.
    fn extract(
        bytes: &[u8],
        file_name: String,
        hash: String,
        byte_len: u64,
    ) -> Result<ReaderImportPayload, String>;
}

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,
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

/// Serializes `Option<Vec<u8>>` as base64 (or omits it) so a binary source payload crosses the
/// IPC boundary as a compact string instead of a JSON array of integers, which would inflate the
/// transfer ~4-6x and stress the JSON parser for multi-megabyte documents.
mod base64_source_data {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(value: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(bytes) => serializer.serialize_str(&STANDARD.encode(bytes)),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded: Option<String> = Option::deserialize(deserializer)?;
        match encoded {
            Some(encoded) => STANDARD
                .decode(encoded.as_bytes())
                .map(Some)
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
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
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "base64_source_data"
    )]
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

fn decode_with_encoding(bytes: &[u8], label: &str) -> Option<String> {
    let encoding = match label.trim().to_ascii_lowercase().as_str() {
        "utf-8" | "utf8" => UTF_8,
        "utf-16le" => UTF_16LE,
        "utf-16be" => UTF_16BE,
        "gb18030" | "gbk" | "gb2312" | "x-gbk" => GBK,
        "big5" | "big-5" | "big5-hkscs" => BIG5,
        _ => return None,
    };
    let (decoded, _, had_errors) = encoding.decode(bytes);
    if had_errors && encoding == UTF_8 {
        return None;
    }
    Some(decoded.into_owned())
}

/// Detects a leading UTF byte-order mark and returns its encoding label together with the bytes
/// that follow it. The BOM-stripped slice must be used for every fallback decode so a failed
/// primary decode never re-attaches the BOM bytes to the output.
fn strip_bom(bytes: &[u8]) -> Option<(&'static str, &[u8])> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        Some(("utf-8", &bytes[3..]))
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        Some(("utf-16le", &bytes[2..]))
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        Some(("utf-16be", &bytes[2..]))
    } else {
        None
    }
}

fn decoded_text_score(value: &str) -> i32 {
    let replacement_penalty = value.chars().filter(|ch| *ch == '\u{fffd}').count() as i32 * 20;
    let cjk_score = value
        .chars()
        .filter(|ch| matches!(*ch as u32, 0x3400..=0x9fff | 0xf900..=0xfaff))
        .count() as i32
        * 2;
    let control_penalty = value
        .chars()
        .filter(|ch| ch.is_control() && !matches!(*ch, '\n' | '\r' | '\t'))
        .count() as i32
        * 4;
    cjk_score - replacement_penalty - control_penalty
}

fn decode_reader_text(bytes: &[u8], declared_charset: Option<&str>) -> Result<String, String> {
    // If a BOM is present, decode the bytes that follow it — and use that same BOM-stripped slice
    // for every fallback below, so a failed primary decode never re-decodes the BOM bytes (which
    // would leave a stray U+FEFF / replacement character at the start of the document).
    let (bom_encoding, content_bytes) = match strip_bom(bytes) {
        Some((encoding, stripped)) => (Some(encoding), stripped),
        None => (None, bytes),
    };

    if let Some(encoding) = bom_encoding {
        if let Some(decoded) = decode_with_encoding(content_bytes, encoding) {
            return Ok(decoded);
        }
    }
    if let Some(charset) = declared_charset {
        if let Some(decoded) = decode_with_encoding(content_bytes, charset) {
            return Ok(decoded);
        }
    }
    if let Ok(value) = std::str::from_utf8(content_bytes) {
        return Ok(value.to_string());
    }

    let (gbk, _, _) = GBK.decode(content_bytes);
    let gbk = gbk.into_owned();
    let (big5, _, _) = BIG5.decode(content_bytes);
    let big5 = big5.into_owned();
    let decoded = if decoded_text_score(&big5) > decoded_text_score(&gbk) {
        big5
    } else {
        gbk
    };
    (!decoded.trim().is_empty())
        .then_some(decoded)
        .ok_or_else(|| "Text file could not be decoded as UTF-8, GBK, or Big5.".to_string())
}

fn is_blocked_ipv4(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();
    // CGNAT shared address space (100.64.0.0/10) and the benchmarking range (198.18.0.0/15) are
    // not covered by the std predicates below but can still reach internal infrastructure.
    let is_shared_cgnat = octets[0] == 100 && (64..=127).contains(&octets[1]);
    let is_benchmarking = octets[0] == 198 && (18..=19).contains(&octets[1]);
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || is_shared_cgnat
        || is_benchmarking
}

fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_blocked_ipv4(ip),
        IpAddr::V6(ip) => {
            if let Some(mapped_ip) = ip.to_ipv4_mapped() {
                return is_blocked_ipv4(mapped_ip);
            }
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReaderFormat {
    Text,
    Docx,
    Rtf,
    Epub,
    Pdf,
    Html,
}

fn detect_reader_format(extension: &str, mime_lower: &str) -> Option<ReaderFormat> {
    if TEXT_IMPORT_EXTENSIONS.contains(&extension) || mime_lower == "text/plain" {
        return Some(ReaderFormat::Text);
    }
    if DOCX_IMPORT_EXTENSIONS.contains(&extension)
        || mime_lower == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    {
        return Some(ReaderFormat::Docx);
    }
    if RTF_IMPORT_EXTENSIONS.contains(&extension)
        || mime_lower == "application/rtf"
        || mime_lower == "text/rtf"
    {
        return Some(ReaderFormat::Rtf);
    }
    if EPUB_IMPORT_EXTENSIONS.contains(&extension) || mime_lower == "application/epub+zip" {
        return Some(ReaderFormat::Epub);
    }
    if PDF_IMPORT_EXTENSIONS.contains(&extension) || mime_lower == "application/pdf" {
        return Some(ReaderFormat::Pdf);
    }
    if HTML_IMPORT_EXTENSIONS.contains(&extension) || mime_lower == "text/html" {
        return Some(ReaderFormat::Html);
    }
    None
}

/// Best-effort format detection from raw bytes. Used when neither file
/// extension nor mime hint identify the format — for example, Android content
/// URIs returned by the dialog plugin can hide the original file name and
/// extension.
fn sniff_reader_format(bytes: &[u8]) -> Option<ReaderFormat> {
    if bytes.starts_with(b"%PDF") {
        return Some(ReaderFormat::Pdf);
    }
    if bytes.starts_with(b"{\\rtf") {
        return Some(ReaderFormat::Rtf);
    }
    if bytes.starts_with(b"PK\x03\x04") {
        return sniff_zip_reader_format(bytes);
    }
    if bytes_look_like_html(bytes) {
        return Some(ReaderFormat::Html);
    }
    if bytes_look_like_plain_text(bytes) {
        return Some(ReaderFormat::Text);
    }
    None
}

fn sniff_zip_reader_format(bytes: &[u8]) -> Option<ReaderFormat> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).ok()?;
    if let Ok(mut entry) = archive.by_name("mimetype") {
        let mut content = String::new();
        if entry.read_to_string(&mut content).is_ok() && content.trim() == "application/epub+zip" {
            return Some(ReaderFormat::Epub);
        }
    }
    if archive.by_name("META-INF/container.xml").is_ok() {
        return Some(ReaderFormat::Epub);
    }
    if archive.by_name("word/document.xml").is_ok() {
        return Some(ReaderFormat::Docx);
    }
    None
}

fn bytes_look_like_html(bytes: &[u8]) -> bool {
    let prefix_len = bytes.len().min(1024);
    let prefix = String::from_utf8_lossy(&bytes[..prefix_len]).to_lowercase();
    let trimmed = prefix.trim_start();
    trimmed.starts_with("<!doctype html")
        || trimmed.starts_with("<html")
        || trimmed.starts_with("<head")
        || trimmed.starts_with("<body")
}

fn bytes_look_like_plain_text(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF])
        || bytes.starts_with(&[0xFE, 0xFF])
        || bytes.starts_with(&[0xFF, 0xFE])
    {
        return true;
    }
    let chunk_len = bytes.len().min(8192);
    let chunk = &bytes[..chunk_len];
    if chunk.iter().any(|&byte| byte == 0) {
        return false;
    }
    std::str::from_utf8(chunk).is_ok()
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

    let format = detect_reader_format(extension.as_str(), mime_lower.as_str())
        .or_else(|| sniff_reader_format(bytes));

    match format {
        Some(ReaderFormat::Text) => {
            PlainTextFormat::extract(bytes, file_name.to_string(), hash, byte_len)
        }
        Some(ReaderFormat::Docx) => {
            DocxFormat::extract(bytes, file_name.to_string(), hash, byte_len)
        }
        Some(ReaderFormat::Rtf) => RtfFormat::extract(bytes, file_name.to_string(), hash, byte_len),
        Some(ReaderFormat::Epub) => {
            EpubFormat::extract(bytes, file_name.to_string(), hash, byte_len)
        }
        Some(ReaderFormat::Pdf) => PdfFormat::extract(bytes, file_name.to_string(), hash, byte_len),
        Some(ReaderFormat::Html) => {
            HtmlFileFormat::extract(bytes, file_name.to_string(), hash, byte_len)
        }
        None => Err(format!(
            "Unsupported reader import type (extension {extension:?}, mime {mime_hint:?})."
        )),
    }
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
            &["txt", "text", "epub", "pdf", "html", "htm", "docx", "rtf"],
        )
        .blocking_pick_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };

    let file_path_display = file_path.to_string();
    // On Android, the dialog returns a `content://` URI whose path components
    // rarely include the original filename or extension. PathResolver::file_name
    // queries the platform's ContentResolver for the display name in that case;
    // on other platforms it falls back to Path::file_name.
    let file_name = app
        .path()
        .file_name(&file_path_display)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Untitled.txt".to_string());

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

#[cfg(test)]
mod tests {
    use super::*;
    use pdf::{
        classify_pdf_line, detect_pdf_table_run, extract_pdf_pages_with, push_pdf_table_block,
        PdfLine, PdfLineSegment,
    };
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;

    fn build_test_docx(document_xml: &str, core_xml: Option<&str>) -> Vec<u8> {
        build_test_docx_with_numbering(document_xml, core_xml, None)
    }

    fn build_test_docx_with_numbering(
        document_xml: &str,
        core_xml: Option<&str>,
        numbering_xml: Option<&str>,
    ) -> Vec<u8> {
        build_test_docx_with_parts(document_xml, core_xml, numbering_xml, None)
    }

    fn build_test_docx_with_styles(
        document_xml: &str,
        core_xml: Option<&str>,
        numbering_xml: Option<&str>,
        styles_xml: Option<&str>,
    ) -> Vec<u8> {
        build_test_docx_with_parts(document_xml, core_xml, numbering_xml, styles_xml)
    }

    fn build_test_docx_with_parts(
        document_xml: &str,
        core_xml: Option<&str>,
        numbering_xml: Option<&str>,
        styles_xml: Option<&str>,
    ) -> Vec<u8> {
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
            if let Some(numbering_xml) = numbering_xml {
                writer
                    .start_file("word/numbering.xml", options)
                    .expect("numbering");
                writer
                    .write_all(numbering_xml.as_bytes())
                    .expect("write numbering");
            }
            if let Some(styles_xml) = styles_xml {
                writer
                    .start_file("word/styles.xml", options)
                    .expect("styles");
                writer
                    .write_all(styles_xml.as_bytes())
                    .expect("write styles");
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
    fn blocks_cgnat_and_benchmarking_ipv4() {
        assert!(is_blocked_ipv4("100.64.0.1".parse::<Ipv4Addr>().unwrap()));
        assert!(is_blocked_ipv4("100.127.255.255".parse::<Ipv4Addr>().unwrap()));
        assert!(is_blocked_ipv4("198.18.0.1".parse::<Ipv4Addr>().unwrap()));
        assert!(!is_blocked_ipv4("100.128.0.1".parse::<Ipv4Addr>().unwrap()));
        assert!(!is_blocked_ipv4("8.8.8.8".parse::<Ipv4Addr>().unwrap()));
    }

    #[test]
    fn bom_text_fallback_does_not_reattach_bom() {
        // UTF-8 BOM followed by GBK bytes that are invalid UTF-8 ("你好" in GBK). The post-BOM
        // UTF-8 decode fails, so the GBK fallback must run on the BOM-stripped bytes only — never
        // re-decoding the BOM bytes (which would prepend stray characters).
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(&[0xC4, 0xE3, 0xBA, 0xC3]);
        let decoded = decode_reader_text(&bytes, None).unwrap();
        assert_eq!(decoded, "你好");
    }

    #[test]
    fn classifies_chinese_paragraph_ending_with_closing_quote_as_paragraph() {
        let payload = extract_plain_text_document(
            "Sample".to_string(),
            "sample.txt".to_string(),
            "他笑着说：\u{201c}这条巷子里的人平时看起来都很忙，但不代表他们没有心。\u{201d}"
                .to_string(),
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

        let payload = DocxFormat::extract(
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
    fn docx_import_resolves_numbering_xml_list_styles() {
        let bytes = build_test_docx_with_numbering(
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
                <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>第一项</w:t></w:r></w:p>
                <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="10"/></w:numPr></w:pPr><w:r><w:t>项目符号</w:t></w:r></w:p>
            </w:body></w:document>"#,
            None,
            Some(
                r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                    <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
                    <w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
                    <w:num w:numId="9"><w:abstractNumId w:val="1"/></w:num>
                    <w:num w:numId="10"><w:abstractNumId w:val="2"/></w:num>
                </w:numbering>"#,
            ),
        );

        let payload = DocxFormat::extract(
            &bytes,
            "numbered.docx".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("docx import");

        let first = payload.blocks[0]
            .extensions
            .as_ref()
            .and_then(|extensions| extensions.list_item.as_ref())
            .expect("ordered item");
        assert_eq!(first.list_style, "ordered");
        assert_eq!(first.ordinal, Some(3));
        let second = payload.blocks[1]
            .extensions
            .as_ref()
            .and_then(|extensions| extensions.list_item.as_ref())
            .expect("bullet item");
        assert_eq!(second.list_style, "bullet");
        assert_eq!(second.ordinal, None);
    }

    #[test]
    fn docx_import_resolves_list_numbering_from_paragraph_styles() {
        let bytes = build_test_docx_with_styles(
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
                <w:p><w:pPr><w:pStyle w:val="BulletedStyle"/></w:pPr><w:r><w:t>Styled bullet</w:t></w:r></w:p>
                <w:p><w:pPr><w:pStyle w:val="ChildBulletStyle"/></w:pPr><w:r><w:t>Inherited bullet</w:t></w:r></w:p>
                <w:p><w:pPr><w:pStyle w:val="NumberedStyle"/></w:pPr><w:r><w:t>Styled number</w:t></w:r></w:p>
            </w:body></w:document>"#,
            None,
            Some(
                r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                    <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
                    <w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="5"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
                    <w:num w:numId="20"><w:abstractNumId w:val="1"/></w:num>
                    <w:num w:numId="21"><w:abstractNumId w:val="2"/></w:num>
                </w:numbering>"#,
            ),
            Some(
                r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                    <w:style w:type="paragraph" w:styleId="BulletedStyle">
                        <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="20"/></w:numPr></w:pPr>
                    </w:style>
                    <w:style w:type="paragraph" w:styleId="ChildBulletStyle">
                        <w:basedOn w:val="BulletedStyle"/>
                    </w:style>
                    <w:style w:type="paragraph" w:styleId="NumberedStyle">
                        <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="21"/></w:numPr></w:pPr>
                    </w:style>
                </w:styles>"#,
            ),
        );

        let payload = DocxFormat::extract(
            &bytes,
            "styled-lists.docx".to_string(),
            sha256_hex(&bytes),
            bytes.len() as u64,
        )
        .expect("docx import");

        let list_items = payload
            .blocks
            .iter()
            .map(|block| {
                block
                    .extensions
                    .as_ref()
                    .and_then(|extensions| extensions.list_item.as_ref())
                    .expect("list item")
            })
            .collect::<Vec<_>>();
        assert!(payload.blocks.iter().all(|block| block.kind == "list_item"));
        assert_eq!(list_items[0].list_style, "bullet");
        assert_eq!(list_items[1].list_style, "bullet");
        assert_eq!(list_items[2].list_style, "ordered");
        assert_eq!(list_items[2].ordinal, Some(5));
    }

    #[test]
    fn rtf_import_preserves_paragraphs_alignment_unicode_and_inline_styles() {
        let bytes = b"{\\rtf1\\ansi\\uc1\n{\\fonttbl{\\f0 Helvetica;}}\n{\\info{\\title Hidden metadata}}\n\\pard\\qc\\b Title\\b0\\par\n\\pard Plain \\i italic \\i0 and \\ul underlined \\ulnone text.\\par\n\\pard Unicode: \\u20320?\\u22909?\\par\n}";

        let payload = RtfFormat::extract(
            bytes,
            "sample.rtf".to_string(),
            sha256_hex(bytes),
            bytes.len() as u64,
        )
        .expect("rtf import");

        assert_eq!(payload.title, "sample");
        assert_eq!(payload.source_type, "rtf");
        assert_eq!(payload.mime_type, "application/rtf");
        assert_eq!(payload.blocks.len(), 3);
        assert_eq!(payload.blocks[0].text, "Title");
        assert_eq!(payload.blocks[0].text_align.as_deref(), Some("center"));
        assert!(payload.blocks[0]
            .spans
            .as_ref()
            .expect("title spans")
            .iter()
            .any(|span| span.style == "strong"));
        assert_eq!(payload.blocks[1].text, "Plain italic and underlined text.");
        assert!(payload.blocks[1]
            .spans
            .as_ref()
            .expect("body spans")
            .iter()
            .any(|span| span.style == "emphasis"));
        assert!(payload.blocks[1]
            .spans
            .as_ref()
            .expect("body spans")
            .iter()
            .any(|span| span.style == "underline"));
        assert_eq!(payload.blocks[2].text, "Unicode: 你好");
        assert!(!payload.text.contains("Helvetica"));
        assert!(!payload.text.contains("Hidden metadata"));
    }

    #[test]
    fn prepare_reader_import_accepts_rtf_mime_type() {
        let bytes = br"{\rtf1\ansi Hello\par}";
        let payload = prepare_from_bytes(bytes, "sample.bin", Some("text/rtf"))
            .expect("rtf import from mime");

        assert_eq!(payload.source_type, "rtf");
        assert_eq!(payload.text, "Hello");
    }

    #[test]
    fn rtf_import_preserves_basic_tables_and_legacy_chinese_codepage() {
        let bytes = br"{\rtf1\ansi\ansicpg936\trowd\intbl \'b4\'ca\cell \'d2\'e5\cell\row}";
        let payload = RtfFormat::extract(
            bytes,
            "table.rtf".to_string(),
            sha256_hex(bytes),
            bytes.len() as u64,
        )
        .expect("rtf import");

        let table = payload
            .blocks
            .iter()
            .find(|block| block.kind == "table")
            .and_then(|block| block.extensions.as_ref())
            .and_then(|extensions| extensions.table.as_ref())
            .expect("table rows");
        assert_eq!(table.rows[0].cells[0].text, "词");
        assert_eq!(table.rows[0].cells[1].text, "义");
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
    fn text_and_html_import_decode_legacy_chinese_encodings_and_ruby() {
        let gbk_text = b"\xc4\xe3\xba\xc3";
        let text_payload = prepare_from_bytes(gbk_text, "sample.txt", Some("text/plain"))
            .expect("gbk text import");
        assert_eq!(text_payload.text, "你好");

        let big5_html = b"<meta charset=\"big5\"><p><ruby>\xba~<rt>han</rt></ruby></p>";
        let html_payload = prepare_from_bytes(big5_html, "sample.html", Some("text/html"))
            .expect("big5 html import");
        assert_eq!(html_payload.text, "漢");
        let ruby_span = html_payload.blocks[0]
            .spans
            .as_ref()
            .and_then(|spans| spans.iter().find(|span| span.style == "ruby"))
            .expect("ruby span");
        assert_eq!(ruby_span.annotation.as_deref(), Some("han"));
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
            "http://[::ffff:127.0.0.1]/article",
            "http://[::ffff:10.0.0.1]/article",
            "http://[::ffff:169.254.1.1]/article",
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
    fn webpage_url_validation_allows_public_targets() {
        let parsed = reqwest::Url::parse("https://example.com/article").expect("parse url");
        assert!(validate_remote_url(&parsed, false).is_ok());
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
            block
                .spans
                .as_ref()
                .map(|spans| {
                    spans.iter().any(|span| {
                        span.style == "ruby" && span.annotation.as_deref() == Some("han")
                    })
                })
                .unwrap_or(false)
        }));
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

        let payload = PdfFormat::extract(
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
        let payload = PdfFormat::extract(
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
        let payload = PdfFormat::extract(
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

        let table_run = detect_pdf_table_run(&lines, 0, 10.5).expect("table run");
        assert_eq!(table_run.end, 4);

        let mut blocks = Vec::new();
        push_pdf_table_block(&mut blocks, &table_run.rows);
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
    fn pdf_table_detector_merges_wrapped_cell_lines() {
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
            page_num: 1,
            page_width: 419.5,
        };
        let lines = vec![
            line(
                "词语 拼音 说明",
                100.0,
                vec![
                    segment("词语", 50.0, 71.0),
                    segment("拼音", 150.0, 171.0),
                    segment("说明", 250.0, 271.0),
                ],
            ),
            line(
                "春风 chun1 feng1 第一段说明",
                118.0,
                vec![
                    segment("春风", 50.0, 71.0),
                    segment("chun1 feng1", 150.0, 205.0),
                    segment("第一段说明", 250.0, 302.0),
                ],
            ),
            line(
                "第二段说明",
                131.0,
                vec![segment("第二段说明", 250.0, 302.0)],
            ),
            line(
                "秋雨 qiu1 yu3 雨声渐近",
                150.0,
                vec![
                    segment("秋雨", 50.0, 71.0),
                    segment("qiu1 yu3", 150.0, 194.0),
                    segment("雨声渐近", 250.0, 292.0),
                ],
            ),
        ];

        let table_run = detect_pdf_table_run(&lines, 0, 10.5).expect("table run");
        assert_eq!(table_run.end, 4);
        assert_eq!(table_run.rows.len(), 3);

        let mut blocks = Vec::new();
        push_pdf_table_block(&mut blocks, &table_run.rows);
        let rows = blocks[0]
            .extensions
            .as_ref()
            .and_then(|value| value.table.as_ref())
            .map(|value| value.rows.as_slice())
            .expect("table rows");
        assert_eq!(rows[1].cells[2].text, "第一段说明\n第二段说明");
        assert_eq!(rows[2].cells[0].text, "秋雨");
    }

    #[test]
    fn pdf_table_detector_continues_across_page_breaks() {
        let segment = |text: &str, x_min: f64, x_max: f64| PdfLineSegment {
            text: text.to_string(),
            x_min,
            x_max,
        };
        let line = |text: &str, page_num: u32, y: f64, segments: Vec<PdfLineSegment>| PdfLine {
            text: text.to_string(),
            x_min: segments.first().map(|segment| segment.x_min).unwrap_or(0.0),
            x_max: segments.last().map(|segment| segment.x_max).unwrap_or(0.0),
            segments,
            y,
            font_size: 10.5,
            page_num,
            page_width: 419.5,
        };
        let lines = vec![
            line(
                "编号 词语 说明",
                1,
                720.0,
                vec![
                    segment("编号", 50.0, 71.0),
                    segment("词语", 150.0, 171.0),
                    segment("说明", 250.0, 271.0),
                ],
            ),
            line(
                "一 春风 第一页末",
                1,
                740.0,
                vec![
                    segment("一", 50.0, 60.0),
                    segment("春风", 150.0, 171.0),
                    segment("第一页末", 250.0, 292.0),
                ],
            ),
            line(
                "二 秋雨 第二页首",
                2,
                90.0,
                vec![
                    segment("二", 50.0, 60.0),
                    segment("秋雨", 150.0, 171.0),
                    segment("第二页首", 250.0, 292.0),
                ],
            ),
        ];

        let table_run = detect_pdf_table_run(&lines, 0, 10.5).expect("table run");
        assert_eq!(table_run.end, 3);
        assert_eq!(table_run.rows.len(), 3);
        assert_eq!(table_run.rows[2][1], "秋雨");
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

    fn build_minimal_epub_bytes() -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut bytes);
            let stored =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            writer.start_file("mimetype", stored).expect("mimetype");
            writer
                .write_all(b"application/epub+zip")
                .expect("mimetype body");
            let deflate = SimpleFileOptions::default();
            writer
                .start_file("META-INF/container.xml", deflate)
                .expect("container");
            writer
                .write_all(b"<?xml version=\"1.0\"?><container/>")
                .expect("container body");
            writer.finish().expect("finish epub");
        }
        bytes.into_inner()
    }

    #[test]
    fn sniffs_pdf_from_magic_bytes() {
        let bytes = b"%PDF-1.5\n%not really a pdf";
        assert_eq!(sniff_reader_format(bytes), Some(ReaderFormat::Pdf));
    }

    #[test]
    fn sniffs_rtf_from_magic_bytes() {
        let bytes = br"{\rtf1\ansi Hello}";
        assert_eq!(sniff_reader_format(bytes), Some(ReaderFormat::Rtf));
    }

    #[test]
    fn sniffs_docx_from_zip_contents() {
        let bytes = build_test_docx(
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>hi</w:t></w:r></w:p></w:body></w:document>"#,
            None,
        );
        assert_eq!(sniff_reader_format(&bytes), Some(ReaderFormat::Docx));
    }

    #[test]
    fn sniffs_epub_from_zip_contents() {
        let bytes = build_minimal_epub_bytes();
        assert_eq!(sniff_reader_format(&bytes), Some(ReaderFormat::Epub));
    }

    #[test]
    fn sniffs_html_from_doctype() {
        let bytes = b"<!DOCTYPE html>\n<html><body><p>hi</p></body></html>";
        assert_eq!(sniff_reader_format(bytes), Some(ReaderFormat::Html));
    }

    #[test]
    fn sniffs_plain_text_as_fallback() {
        let bytes = b"Hello there.\nJust a note.";
        assert_eq!(sniff_reader_format(bytes), Some(ReaderFormat::Text));
    }

    #[test]
    fn prepare_from_bytes_sniffs_when_file_name_has_no_extension() {
        // Mimics an Android content URI segment with no extension or mime hint.
        let payload = prepare_from_bytes(b"Hello there.\n\nSecond line.", "document%3A1234", None)
            .expect("plain text should be detected from bytes");
        assert_eq!(payload.source_type, "plain_text");
        assert_eq!(payload.mime_type, "text/plain");
    }

    #[test]
    fn prepare_from_bytes_sniffs_pdf_when_extension_missing() {
        let bytes = b"%PDF-1.4\nnot a valid pdf body";
        let error = prepare_from_bytes(bytes, "document%3A1234", None)
            .expect_err("synthetic pdf bytes should fail to parse but route to PDF extractor");
        assert!(
            !error.contains("Unsupported reader import type"),
            "expected sniffing to dispatch to the PDF extractor, got: {error}"
        );
    }
}
