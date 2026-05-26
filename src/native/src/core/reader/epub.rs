//! EPUB import.
//!
//! Reads EPUB archives via the `epub` crate, iterates over spine chapters, and delegates
//! HTML content extraction to [`html::html_to_blocks`]. Chapter offsets are adjusted so
//! the final linear text is a single contiguous string with correct UTF-16 code unit offsets.

use epub::doc::EpubDoc;
use std::io::Cursor;

use crate::core::reader::html::html_to_blocks;
use crate::core::reader::{
    default_canonical_schema_version, title_from_file_stem, utf16_len, FormatExtractor,
    ReaderImportPayload, EPUB_EXTRACTOR_VERSION,
};

/// EPUB format extractor implementing [`FormatExtractor`].
pub(crate) struct EpubFormat;

impl FormatExtractor for EpubFormat {
    fn extract(
        bytes: &[u8],
        file_name: String,
        hash: String,
        byte_len: u64,
    ) -> Result<ReaderImportPayload, String> {
        extract_epub_payload(bytes, file_name, hash, byte_len)
    }
}

/// Extracts a reader import payload from an EPUB file's raw bytes.
///
/// Iterates over every chapter in the EPUB spine, parses each as HTML, and concatenates
/// the resulting text and blocks with adjusted UTF-16 offsets.
pub(super) fn extract_epub_payload(
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
