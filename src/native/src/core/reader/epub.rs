//! EPUB import.
//!
//! Reads EPUB archives via the `rbook` crate, iterates over spine chapters, and delegates
//! HTML content extraction to [`html::html_to_blocks`]. Chapter offsets are adjusted so
//! the final linear text is a single contiguous string with correct UTF-16 code unit offsets.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use rbook::Epub;
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
        let epub = Epub::read(cursor).map_err(|error| format!("Could not read EPUB: {}", error))?;
        let title = epub
            .metadata()
            .title()
            .map(|title_entry| title_entry.value().to_string())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| title_from_file_stem(&file_name));

        let mut text = String::new();
        let mut blocks = Vec::new();
        let mut html_title = None;
        // rbook's default reader (LinearBehavior::Original) yields every spine entry, linear and
        // non-linear, in reading order.
        let mut reader = epub.reader();
        while let Some(chapter_result) = reader.read_next() {
            let Ok(chapter) = chapter_result else {
                continue;
            };
            let manifest_entry = chapter.manifest_entry();
            let resource = manifest_entry.resource();
            let mime_lower = resource.kind().as_str().to_lowercase();
            if !(mime_lower.contains("html") || mime_lower.contains("xml")) {
                continue;
            }
            // The resource key is the chapter's absolute path from the archive root (e.g.
            // "/EPUB/text/c1.xhtml"), which relative <img> sources are resolved against below.
            let chapter_path = resource.key().value().map(str::to_string);
            let chapter_html = chapter.content().to_string();

            let (chapter_text, mut chapter_blocks, chapter_title) =
                html_to_blocks(&chapter_html, None);
            if html_title.is_none() {
                html_title = chapter_title;
            }

            // Resolve relative <img> sources against the chapter's location in the archive and
            // inline them as data URIs so EPUB images render. html_to_blocks only resolves remote
            // URLs, leaving intra-archive images without a usable source.
            if let Some(chapter_path) = chapter_path.as_deref() {
                let chapter_path = Path::new(chapter_path);
                for block in &mut chapter_blocks {
                    inline_epub_image(&epub, chapter_path, block);
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
fn inline_epub_image(epub: &Epub, chapter_path: &Path, block: &mut ReaderContentBlock) {
    let Some(extensions) = block.extensions.as_mut() else {
        return;
    };
    let already_resolved = extensions
        .image
        .as_ref()
        .is_none_or(|image| image.inline_src.is_some());
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
    // rbook keys archive resources by their absolute path from the zip root (e.g.
    // "/EPUB/images/x.png"); resolve_epub_resource_path returns that path without the leading
    // slash, so restore it. Per rbook's Epub::copy_resource docs, "/EPUB/c1.xhtml" resolves while
    // "EPUB/c1.xhtml" does not.
    let absolute_path = format!("/{}", archive_path);
    let Ok(image_bytes) = epub.read_resource_bytes(absolute_path.as_str()) else {
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
    use super::{epub_image_mime, resolve_epub_resource_path, EpubFormat};
    use crate::core::reader::FormatExtractor;
    use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
    use std::io::{Cursor, Write};
    use std::path::Path;
    use zip::write::SimpleFileOptions;

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

    // Arbitrary bytes standing in for a PNG resource. The extractor keys image inlining off the
    // manifest path/extension, not the byte content, so a real image is unnecessary here.
    const IMAGE_BYTES: &[u8] = b"\x89PNG\r\n\x1a\nsyng-fake-png-payload";

    /// Builds a valid EPUB 3 archive in memory: a chapter under `EPUB/text/` with a `<p>` and an
    /// `<img>` whose relative `src` points up into `EPUB/images/`. Exercises rbook's spine reader,
    /// metadata title, and archive resource lookup end to end.
    fn build_epub_with_chapter_and_image() -> Vec<u8> {
        let container = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#;

        let package = r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:syng-test-book</dc:identifier>
    <dc:title>Syng Test Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="image1" href="images/pic.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>"#;

        let chapter = r#"<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Chapter One</title></head>
  <body>
    <h1>Chapter One</h1>
    <p>The quick brown fox jumps over the lazy dog.</p>
    <img src="../images/pic.png" alt="a picture"/>
  </body>
</html>"#;

        let mut buffer = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);
            // The mimetype entry must be stored (uncompressed) and first, per the EPUB spec.
            let stored =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            writer.start_file("mimetype", stored).expect("mimetype");
            writer
                .write_all(b"application/epub+zip")
                .expect("mimetype body");

            let deflate = SimpleFileOptions::default();
            for (path, body) in [
                ("META-INF/container.xml", container.as_bytes()),
                ("EPUB/package.opf", package.as_bytes()),
                ("EPUB/text/c1.xhtml", chapter.as_bytes()),
                ("EPUB/images/pic.png", IMAGE_BYTES),
            ] {
                writer.start_file(path, deflate).expect("start file");
                writer.write_all(body).expect("write file");
            }
            writer.finish().expect("finish epub");
        }
        buffer.into_inner()
    }

    #[test]
    fn extracts_epub_title_text_and_inlines_images() {
        let bytes = build_epub_with_chapter_and_image();
        let payload = EpubFormat::extract(
            &bytes,
            "book.epub".to_string(),
            "hash".to_string(),
            bytes.len() as u64,
        )
        .expect("valid EPUB should extract");

        assert_eq!(payload.title, "Syng Test Book");
        assert_eq!(payload.source_type, "epub");
        assert!(
            payload
                .text
                .contains("The quick brown fox jumps over the lazy dog."),
            "expected chapter text in payload, got: {}",
            payload.text
        );

        // The intra-archive <img> should be resolved and inlined as a base64 data URI.
        let inline_src = payload
            .blocks
            .iter()
            .filter_map(|block| block.extensions.as_ref())
            .filter_map(|extensions| extensions.image.as_ref())
            .find_map(|image| image.inline_src.as_deref())
            .expect("EPUB image should be inlined as a data URI");
        let encoded = inline_src
            .strip_prefix("data:image/png;base64,")
            .expect("image should inline as a base64 PNG data URI");
        let decoded = BASE64_STANDARD.decode(encoded).expect("valid base64");
        assert_eq!(decoded, IMAGE_BYTES);
    }
}
