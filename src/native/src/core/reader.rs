use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

const TEXT_EXTRACTOR_VERSION: u16 = 1;

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct ReaderContentBlock {
    id: String,
    kind: String,
    text: String,
    start_offset: usize,
    end_offset: usize,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct ReaderImportPayload {
    title: String,
    file_name: String,
    source_type: String,
    mime_type: String,
    extractor_version: u16,
    text: String,
    blocks: Vec<ReaderContentBlock>,
}

#[tauri::command(async)]
pub async fn import_reader_document(
    app: tauri::AppHandle,
) -> Result<Option<ReaderImportPayload>, String> {
    let file_path = app
        .dialog()
        .file()
        .set_title("Import Reading Document")
        .add_filter("Plain Text", &["txt", "text"])
        .blocking_pick_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };

    let file_path_display = file_path.to_string();
    let path = Path::new(&file_path_display);
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("");

    if !matches!(extension.to_lowercase().as_str(), "txt" | "text") {
        return Err("Reader import currently supports plain text files only.".to_string());
    }

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Untitled.txt")
        .to_string();
    let title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Untitled")
        .to_string();

    let raw_text = app
        .fs()
        .read_to_string(file_path)
        .map_err(|err| format!("Failed to read the selected document: {}", err))?;

    Ok(Some(extract_plain_text_document(title, file_name, raw_text)))
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
        title,
        file_name,
        source_type: "plain_text".to_string(),
        mime_type: "text/plain".to_string(),
        extractor_version: TEXT_EXTRACTOR_VERSION,
        text,
        blocks,
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
            id: "block-0".to_string(),
            kind: "paragraph".to_string(),
            text: String::new(),
            start_offset: 0,
            end_offset: text.len(),
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
        id: format!("block-{}", blocks.len()),
        kind,
        text,
        start_offset,
        end_offset,
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
}
