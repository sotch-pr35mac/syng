//! EPUB import.
//!
//! Reads EPUB archives via the `epub` crate, iterates over spine chapters, and delegates
//! HTML content extraction to [`html::html_to_blocks`]. Chapter offsets are adjusted so
//! the final linear text is a single contiguous string with correct UTF-16 code unit offsets.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use epub::doc::EpubDoc;
use serde_json::Value;
use std::io::Cursor;
use std::path::Path;

use crate::core::reader::html::html_to_blocks;
use crate::core::reader::{
    default_canonical_schema_version, title_from_file_stem, utf16_len, FormatExtractor,
    ReaderContentBlock, ReaderImportPayload, EPUB_EXTRACTOR_VERSION,
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
        let cursor = Cursor::new(bytes.to_vec());
        let mut doc = EpubDoc::from_reader(cursor)
            .map_err(|error| format!("Could not read EPUB: {}", error))?;
        let title = doc
            .get_title()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| title_from_file_stem(&file_name));

        let spine_len = doc.spine.len();
        let mut text = String::new();
        let mut blocks = Vec::new();
        let mut html_title = None;
        for chapter_index in 0..spine_len {
            if !doc.set_current_chapter(chapter_index) {
                continue;
            }
            let chapter_path = doc.get_current_path();
            let Some((chapter_html, mime)) = doc.get_current_str() else {
                continue;
            };
            let mime_lower = mime.to_lowercase();
            if !(mime_lower.contains("html") || mime_lower.contains("xml")) {
                continue;
            }

            let (chapter_text, mut chapter_blocks, chapter_title) =
                html_to_blocks(&chapter_html, None);
            if html_title.is_none() {
                html_title = chapter_title;
            }

            // Resolve relative <img> sources against the chapter's location in the archive and
            // inline them as data URIs so EPUB images render. html_to_blocks only resolves remote
            // URLs, leaving intra-archive images without a usable source.
            if let Some(chapter_path) = chapter_path.as_deref() {
                for block in &mut chapter_blocks {
                    inline_epub_image(&mut doc, chapter_path, block);
                }
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
}

/// Resolves a relative resource href (e.g. an `<img src>`) against the chapter's path inside the
/// EPUB archive, returning the normalized archive path. Remote and data URIs return `None`.
fn resolve_epub_resource_path(chapter_path: &Path, raw_src: &str) -> Option<String> {
    if raw_src.contains("://") || raw_src.starts_with("data:") {
        return None;
    }
    let cleaned = raw_src.split(['#', '?']).next().unwrap_or(raw_src);
    if cleaned.is_empty() {
        return None;
    }

    let mut components: Vec<String> = Vec::new();
    if !cleaned.starts_with('/') {
        if let Some(parent) = chapter_path.parent() {
            for part in parent.to_string_lossy().split('/') {
                if !part.is_empty() {
                    components.push(part.to_string());
                }
            }
        }
    }
    for part in cleaned.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                components.pop();
            }
            other => components.push(other.to_string()),
        }
    }

    (!components.is_empty()).then(|| components.join("/"))
}

/// Guesses an image MIME type from a resource path's extension.
fn epub_image_mime(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "image/*"
    }
}

/// Resolves a single image block's relative source against the archive and inlines it as a data
/// URI. No-op for non-image blocks or images that already carry a source.
fn inline_epub_image(
    doc: &mut EpubDoc<Cursor<Vec<u8>>>,
    chapter_path: &Path,
    block: &mut ReaderContentBlock,
) {
    let Some(extensions) = block.extensions.as_mut() else {
        return;
    };
    let already_resolved = extensions
        .image
        .as_ref()
        .map_or(true, |image| image.inline_src.is_some());
    if already_resolved {
        return;
    }
    let Some(raw_src) = extensions
        .extra
        .get("src")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return;
    };
    extensions.extra.remove("src");

    let Some(archive_path) = resolve_epub_resource_path(chapter_path, &raw_src) else {
        return;
    };
    let Some(image_bytes) = doc.get_resource_by_path(&archive_path) else {
        return;
    };
    let mime = epub_image_mime(&archive_path);
    let data_uri = format!(
        "data:{};base64,{}",
        mime,
        BASE64_STANDARD.encode(&image_bytes)
    );
    if let Some(image) = extensions.image.as_mut() {
        image.inline_src = Some(data_uri);
        image.mime_type = mime.to_string();
    }
}

#[cfg(test)]
mod tests {
    use super::{epub_image_mime, resolve_epub_resource_path};
    use std::path::Path;

    #[test]
    fn resolves_relative_epub_image_paths() {
        let chapter = Path::new("OEBPS/text/chap1.xhtml");
        assert_eq!(
            resolve_epub_resource_path(chapter, "../images/cover.jpg").as_deref(),
            Some("OEBPS/images/cover.jpg")
        );
        assert_eq!(
            resolve_epub_resource_path(chapter, "pic.png").as_deref(),
            Some("OEBPS/text/pic.png")
        );
        assert_eq!(
            resolve_epub_resource_path(chapter, "/OEBPS/img/a.gif").as_deref(),
            Some("OEBPS/img/a.gif")
        );
        assert_eq!(
            resolve_epub_resource_path(chapter, "img.png#frag").as_deref(),
            Some("OEBPS/text/img.png")
        );
        assert_eq!(
            resolve_epub_resource_path(chapter, "https://example.com/x.png"),
            None
        );
        assert_eq!(
            resolve_epub_resource_path(chapter, "data:image/png;base64,AAAA"),
            None
        );
    }

    #[test]
    fn guesses_image_mime_from_extension() {
        assert_eq!(epub_image_mime("a/b/cover.JPG"), "image/jpeg");
        assert_eq!(epub_image_mime("x.png"), "image/png");
        assert_eq!(epub_image_mime("x.svg"), "image/svg+xml");
        assert_eq!(epub_image_mime("x.bin"), "image/*");
    }
}
