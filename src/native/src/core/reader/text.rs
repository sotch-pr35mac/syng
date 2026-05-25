use uuid::Uuid;

use super::{
    default_canonical_schema_version, utf16_len, ReaderContentBlock, ReaderImportPayload,
    TEXT_EXTRACTOR_VERSION,
};

pub(super) fn extract_plain_text_document(
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

pub(super) fn normalize_line_endings(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

pub(super) fn infer_plain_text_title(raw_text: &str) -> String {
    normalize_line_endings(raw_text)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(80).collect::<String>())
        .filter(|line| !line.is_empty())
        .unwrap_or_else(|| "Untitled".to_string())
}

pub(super) fn extract_text_blocks(text: &str) -> Vec<ReaderContentBlock> {
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
