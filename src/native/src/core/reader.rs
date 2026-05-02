//! Reader import and tokenization.
//!
//! Canonical block offsets and `text` use Unicode scalar indices (Rust `str` / `char` boundaries).
//! The webview pagination path uses JavaScript UTF-16 code unit indices; importers must align
//! payloads accordingly when produced from this module (or normalize in TS on IPC boundary).

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use epub::doc::EpubDoc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
use uuid::Uuid;

const TEXT_EXTRACTOR_VERSION: u16 = 1;
const EPUB_EXTRACTOR_VERSION: u16 = 2;
const PDF_EXTRACTOR_VERSION: u16 = 2;
const HTML_EXTRACTOR_VERSION: u16 = 2;

fn default_canonical_schema_version() -> u16 {
    1
}

fn default_participates_in_linear_text() -> bool {
    true
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderInlineSpan {
    pub start: usize,
    pub end: usize,
    pub style: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
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
    pub extensions: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct ReaderImportPayload {
    #[serde(default = "default_canonical_schema_version")]
    pub canonical_schema_version: u16,
    pub title: String,
    pub file_name: String,
    pub source_type: String,
    pub mime_type: String,
    pub extractor_version: u16,
    pub text: String,
    pub blocks: Vec<ReaderContentBlock>,
    #[serde(default)]
    pub source_sha256: Option<String>,
    #[serde(default)]
    pub source_byte_length: Option<u64>,
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
    pub title: Option<String>,
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn html_to_plain_text(html: &str) -> Result<String, String> {
    html2text::from_read(html.as_bytes(), 240)
        .map_err(|error| format!("HTML to text failed: {}", error))
}

fn title_from_file_stem(file_name: &str) -> String {
    Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Untitled")
        .to_string()
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

    let combined_html = html_fragments.join("\n");
    let plain = html_to_plain_text(&combined_html)?;
    let text = normalize_line_endings(&plain);
    let blocks = extract_text_blocks(&text);

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
        import_app_version: None,
    })
}

fn extract_pdf_payload(
    bytes: &[u8],
    file_name: String,
    hash: String,
    byte_len: u64,
) -> Result<ReaderImportPayload, String> {
    let pages = pdf_extract::extract_text_from_mem_by_pages(bytes)
        .map_err(|error| format!("Could not read PDF: {}", error))?;
    let combined: String = pages
        .iter()
        .map(|page| page.trim())
        .filter(|page| !page.is_empty())
        .map(|page| page.to_string())
        .collect::<Vec<_>>()
        .join("\n\n");

    let normalized = normalize_line_endings(&combined);
    let (text, blocks) = if normalized.trim().is_empty() {
        let notice = "This PDF does not contain extractable text (it may be scanned or image-only).";
        (
            notice.to_string(),
            vec![ReaderContentBlock {
                id: Uuid::new_v4().to_string(),
                kind: "paragraph".to_string(),
                text: notice.to_string(),
                start_offset: Some(0),
                end_offset: Some(notice.len()),
                participates_in_linear_text: true,
                heading_level: None,
                text_align: None,
                spans: None,
                extensions: None,
            }],
        )
    } else {
        let blocks = extract_text_blocks(&normalized);
        (normalized, blocks)
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
    let plain = html_to_plain_text(html)?;
    let text = normalize_line_endings(&plain);
    let blocks = extract_text_blocks(&text);

    Ok(ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title: title_from_file_stem(&file_name),
        file_name,
        source_type: "html".to_string(),
        mime_type: "text/html".to_string(),
        extractor_version: HTML_EXTRACTOR_VERSION,
        text,
        blocks,
        source_sha256: Some(hash),
        source_byte_length: Some(byte_len),
        import_app_version: None,
    })
}

fn prepare_from_html(html: &str, title_override: Option<&str>) -> Result<ReaderImportPayload, String> {
    let plain = html_to_plain_text(html)?;
    let text = normalize_line_endings(&plain);
    let blocks = extract_text_blocks(&text);
    let title = title_override
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
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
    let mime_lower = mime_hint.map(|value| value.to_lowercase()).unwrap_or_default();

    let hash = sha256_hex(bytes);
    let byte_len = bytes.len() as u64;

    if extension == "txt" || extension == "text" || mime_lower == "text/plain" {
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

    if extension == "docx"
        || mime_lower
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    {
        return Err("Word (.docx) reader import is not supported yet.".to_string());
    }

    if extension == "epub" || mime_lower == "application/epub+zip" {
        return extract_epub_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    if extension == "pdf" || mime_lower == "application/pdf" {
        return extract_pdf_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    if extension == "html" || extension == "htm" || mime_lower == "text/html" {
        return extract_html_file_payload(bytes, file_name.to_string(), hash, byte_len);
    }

    Err(format!(
        "Unsupported reader import type (extension {extension:?}, mime {mime_hint:?})."
    ))
}

#[tauri::command]
pub fn prepare_reader_import(args: PrepareReaderImportArgs) -> Result<ReaderImportPayload, String> {
    let html = args
        .html
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());

    if let Some(html_body) = html {
        if args.source_base64.is_some() || args.path.is_some() {
            return Err("HTML import must not include path or sourceBase64.".to_string());
        }
        return prepare_from_html(html_body, args.title.as_deref());
    }

    if let Some(path_str) = args.path.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty())
    {
        if args.source_base64.is_some() {
            return Err("Provide either path or sourceBase64, not both.".to_string());
        }
        let bytes = std::fs::read(path_str)
            .map_err(|error| format!("Failed to read import path {}: {}", path_str, error))?;
        let file_name = args
            .file_name
            .as_ref()
            .filter(|value| !value.is_empty())
            .cloned()
            .or_else(|| {
                Path::new(path_str)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.to_string())
            })
            .ok_or_else(|| "Could not determine a file name for the import path.".to_string())?;
        return prepare_from_bytes(&bytes, &file_name, args.mime_type.as_deref());
    }

    let source_b64 = args
        .source_base64
        .as_ref()
        .ok_or_else(|| "Missing path, sourceBase64, or html.".to_string())?;
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
            &["txt", "text", "epub", "pdf", "html", "htm"],
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

    prepare_from_bytes(&bytes, &file_name, None).map(Some)
}

#[tauri::command]
pub fn tokenize_reader_text(text: String) -> Vec<String> {
    chinese_dictionary::tokenize(&text)
        .into_iter()
        .map(ToString::to_string)
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
        import_app_version: None,
    }
}

fn normalize_line_endings(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn extract_text_blocks(text: &str) -> Vec<ReaderContentBlock> {
    let mut blocks = Vec::new();
    let mut block_start: Option<usize> = None;
    let mut block_lines: Vec<&str> = Vec::new();
    let mut cursor = 0;

    for line in text.split_inclusive('\n') {
        let line_without_break = line.strip_suffix('\n').unwrap_or(line);
        let line_start = cursor;
        let line_end = cursor + line.len();

        if line_without_break.trim().is_empty() {
            if let Some(start_offset) = block_start {
                push_text_block(&mut blocks, start_offset, line_start, &block_lines);
                block_start = None;
                block_lines.clear();
            }
        } else {
            if block_start.is_none() {
                block_start = Some(line_start);
            }
            block_lines.push(line_without_break);
        }

        cursor = line_end;
    }

    if let Some(start_offset) = block_start {
        push_text_block(&mut blocks, start_offset, text.len(), &block_lines);
    }

    if blocks.is_empty() && text.trim().is_empty() {
        blocks.push(ReaderContentBlock {
            id: Uuid::new_v4().to_string(),
            kind: "paragraph".to_string(),
            text: String::new(),
            start_offset: Some(0),
            end_offset: Some(text.len()),
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
    let kind = infer_block_kind(&text);
    blocks.push(ReaderContentBlock {
        id: Uuid::new_v4().to_string(),
        kind,
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

fn infer_block_kind(text: &str) -> String {
    let trimmed = text.trim();
    let inner = trimmed.trim_end_matches([
        '"', '\'', '”', '’', '」', '』', '》', '〉', '】', '〗', ')', ']', '）', '］',
    ]);
    let word_count = trimmed.split_whitespace().count();
    if !inner.ends_with(['.', '!', '?', '。', '！', '？']) && word_count > 0 && word_count <= 12 {
        "heading".to_string()
    } else {
        "paragraph".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(payload.blocks[0].kind, "heading");
        assert_eq!(payload.blocks[0].text, "Title");
        assert_eq!(payload.blocks[1].kind, "paragraph");
        assert_eq!(payload.blocks[1].text, "你好今天的天气还好。\nSecond line.");
    }

    #[test]
    fn tokenizes_chinese_text() {
        let tokens = tokenize_reader_text("你好今天的天气还好。".to_string());
        assert!(tokens.contains(&"你好".to_string()));
        assert!(tokens.contains(&"今天".to_string()));
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
            title: Some("T".to_string()),
        })
        .expect("html import");

        assert_eq!(payload.title, "T");
        assert!(payload.text.contains("Alpha"));
        assert!(payload.text.contains("Beta"));
        assert_eq!(payload.source_type, "webpage");
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
            title: None,
        })
        .expect("txt import");

        assert_eq!(payload.source_sha256, Some(sha256_hex(utf8.as_bytes())));
        assert_eq!(payload.source_byte_length, Some(utf8.len() as u64));
    }

    #[test]
    fn prepare_reader_import_from_path_reads_utf8_text() {
        let temp = tempfile::tempdir().expect("tempdir");
        let file_path = temp.path().join("path-import.txt");
        std::fs::write(&file_path, "Line one\n\nLine two.").expect("write test file");

        let payload = prepare_reader_import(PrepareReaderImportArgs {
            path: Some(file_path.to_string_lossy().to_string()),
            source_base64: None,
            file_name: Some("path-import.txt".to_string()),
            mime_type: Some("text/plain".to_string()),
            html: None,
            title: None,
        })
        .expect("path import");

        assert_eq!(payload.text, "Line one\n\nLine two.");
        assert_eq!(
            payload.source_sha256,
            Some(sha256_hex(
                std::fs::read(&file_path)
                    .expect("read back")
                    .as_slice()
            ))
        );
    }
}
