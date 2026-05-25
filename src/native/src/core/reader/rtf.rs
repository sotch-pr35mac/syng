use uuid::Uuid;

use super::{
    append_linear_block, decode_reader_text, decode_with_encoding,
    default_canonical_schema_version, docx_table_text, normalize_line_endings,
    title_from_file_stem, utf16_len, ReaderBlockExtensions, ReaderContentBlock,
    ReaderImportPayload, ReaderInlineSpan, ReaderTableCell, ReaderTableExtension, ReaderTableRow,
    RTF_EXTRACTOR_VERSION,
};

#[derive(Debug, Clone, Default)]
struct RtfTextStyle {
    strong: bool,
    emphasis: bool,
    underline: bool,
    strikethrough: bool,
    subscript: bool,
    superscript: bool,
    text_align: Option<String>,
    uc_skip: usize,
    ansi_codepage: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct RtfParagraphBuilder {
    text: String,
    spans: Vec<ReaderInlineSpan>,
    text_align: Option<String>,
}

impl RtfParagraphBuilder {
    fn push_text(&mut self, value: &str, style: &RtfTextStyle) {
        if value.is_empty() {
            return;
        }
        if self.text_align.is_none() {
            self.text_align = style.text_align.clone();
        }
        let start = utf16_len(&self.text);
        self.text.push_str(value);
        let end = utf16_len(&self.text);
        for style_name in rtf_style_names(style) {
            self.spans.push(ReaderInlineSpan {
                start,
                end,
                style: style_name.to_string(),
                annotation: None,
            });
        }
    }

    fn finish(self) -> Option<RtfParagraph> {
        let text = normalize_line_endings(&self.text)
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        if text.is_empty() {
            return None;
        }
        let text_utf16_len = utf16_len(&text);
        let spans = self
            .spans
            .into_iter()
            .filter(|span| span.start < span.end && span.end <= text_utf16_len)
            .collect::<Vec<_>>();
        Some(RtfParagraph {
            text,
            spans,
            text_align: self.text_align,
        })
    }
}

#[derive(Debug, Clone)]
struct RtfParagraph {
    text: String,
    spans: Vec<ReaderInlineSpan>,
    text_align: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct RtfTableBuilder {
    cells: Vec<ReaderTableCell>,
    rows: Vec<ReaderTableRow>,
}

impl RtfTableBuilder {
    fn push_cell(&mut self, paragraph: &mut RtfParagraphBuilder) {
        if let Some(cell) = std::mem::take(paragraph).finish() {
            self.cells.push(ReaderTableCell {
                text: cell.text,
                is_header: false,
                spans: if cell.spans.is_empty() {
                    None
                } else {
                    Some(cell.spans)
                },
            });
        }
    }

    fn push_row(&mut self, paragraph: &mut RtfParagraphBuilder) {
        self.push_cell(paragraph);
        if !self.cells.is_empty() {
            self.rows.push(ReaderTableRow {
                cells: std::mem::take(&mut self.cells),
            });
        }
    }

    fn finish(&mut self) -> Option<ReaderContentBlock> {
        if self.rows.is_empty() {
            return None;
        }
        let rows = std::mem::take(&mut self.rows);
        Some(ReaderContentBlock {
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
        })
    }
}

fn rtf_style_names(style: &RtfTextStyle) -> Vec<&'static str> {
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

fn rtf_hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn rtf_codepage_label(value: i32) -> Option<&'static str> {
    match value {
        65001 => Some("utf-8"),
        936 | 54936 => Some("gbk"),
        950 => Some("big5"),
        _ => None,
    }
}

fn rtf_decode_hex_bytes(values: &[u8], style: &RtfTextStyle) -> String {
    if let Some(label) = style.ansi_codepage.as_deref() {
        if let Some(decoded) = decode_with_encoding(values, label) {
            return decoded;
        }
    }
    // Latin-1 is a lossless single-byte fallback for bytes that do not arrive through \u escapes.
    values.iter().map(|value| char::from(*value)).collect()
}

fn rtf_unicode_char(value: i32) -> Option<char> {
    let unit = if value < 0 {
        (value + 65_536) as u16
    } else {
        value as u16
    };
    char::from_u32(unit as u32)
}

fn rtf_destination_should_skip(control: &str) -> bool {
    matches!(
        control,
        "fonttbl"
            | "colortbl"
            | "stylesheet"
            | "info"
            | "pict"
            | "object"
            | "objdata"
            | "themedata"
            | "datastore"
            | "xmlnstbl"
            | "generator"
            | "filetbl"
            | "listtable"
            | "listoverridetable"
            | "rsidtbl"
            | "latentstyles"
            | "mmathPr"
            | "nonshppict"
            | "shp"
            | "shptxt"
            | "annotation"
            | "header"
            | "footer"
            | "headerl"
            | "headerr"
            | "headerf"
            | "footerl"
            | "footerr"
            | "footerf"
            | "footnote"
            | "endnote"
            | "private"
    )
}

fn append_rtf_paragraph(
    blocks: &mut Vec<ReaderContentBlock>,
    linear_text: &mut String,
    paragraph: &mut RtfParagraphBuilder,
) {
    if let Some(paragraph) = std::mem::take(paragraph).finish() {
        append_linear_block(
            blocks,
            linear_text,
            "paragraph",
            paragraph.text,
            None,
            paragraph.text_align,
            if paragraph.spans.is_empty() {
                None
            } else {
                Some(paragraph.spans)
            },
            None,
        );
    }
}

fn apply_rtf_control(
    control: &str,
    parameter: Option<i32>,
    style: &mut RtfTextStyle,
    paragraph: &mut RtfParagraphBuilder,
    blocks: &mut Vec<ReaderContentBlock>,
    linear_text: &mut String,
    table: &mut RtfTableBuilder,
    in_table: &mut bool,
) -> Option<usize> {
    match control {
        "b" => style.strong = parameter.unwrap_or(1) != 0,
        "i" => style.emphasis = parameter.unwrap_or(1) != 0,
        "ul" | "ulw" | "uld" | "uldash" | "uldashd" | "uldashdd" | "uldb" | "ulth" | "ulwave" => {
            style.underline = parameter.unwrap_or(1) != 0
        }
        "ulnone" => style.underline = false,
        "strike" | "striked" => style.strikethrough = parameter.unwrap_or(1) != 0,
        "sub" => {
            style.subscript = true;
            style.superscript = false;
        }
        "super" => {
            style.superscript = true;
            style.subscript = false;
        }
        "nosupersub" => {
            style.subscript = false;
            style.superscript = false;
        }
        "plain" => {
            let uc_skip = style.uc_skip;
            *style = RtfTextStyle {
                uc_skip,
                ..RtfTextStyle::default()
            };
        }
        "pard" => style.text_align = None,
        "qc" => style.text_align = Some("center".to_string()),
        "qr" => style.text_align = Some("end".to_string()),
        "qj" => style.text_align = Some("justify".to_string()),
        "ql" => style.text_align = None,
        "trowd" => {
            if let Some(block) = table.finish() {
                blocks.push(block);
            }
            *in_table = true;
        }
        "intbl" => *in_table = true,
        "cell" => {
            *in_table = true;
            table.push_cell(paragraph);
        }
        "row" => {
            *in_table = true;
            table.push_row(paragraph);
            if let Some(block) = table.finish() {
                blocks.push(block);
            }
            *in_table = false;
        }
        "par" | "sect" | "page" => {
            if *in_table {
                paragraph.push_text("\n", style);
            } else {
                if let Some(block) = table.finish() {
                    blocks.push(block);
                }
                append_rtf_paragraph(blocks, linear_text, paragraph);
            }
        }
        "line" => paragraph.push_text("\n", style),
        "tab" => paragraph.push_text("\t", style),
        "emdash" => paragraph.push_text("—", style),
        "endash" => paragraph.push_text("–", style),
        "bullet" => paragraph.push_text("•", style),
        "lquote" | "rquote" => paragraph.push_text("'", style),
        "ldblquote" | "rdblquote" => paragraph.push_text("\"", style),
        "u" => {
            if let Some(value) = parameter {
                if let Some(ch) = rtf_unicode_char(value) {
                    paragraph.push_text(&ch.to_string(), style);
                }
                return Some(style.uc_skip);
            }
        }
        "uc" => {
            if let Some(value) = parameter {
                style.uc_skip = value.max(0) as usize;
            }
        }
        "ansicpg" => {
            if let Some(value) = parameter {
                style.ansi_codepage = rtf_codepage_label(value).map(str::to_string);
            }
        }
        _ => {}
    }
    None
}

fn parse_rtf_document(input: &str) -> Result<(String, Vec<ReaderContentBlock>), String> {
    if !input.trim_start().starts_with("{\\rtf") {
        return Err("RTF file did not start with a valid RTF header.".to_string());
    }

    let bytes = input.as_bytes();
    let mut index = 0usize;
    let mut depth = 0usize;
    let mut styles = vec![RtfTextStyle {
        uc_skip: 1,
        ..RtfTextStyle::default()
    }];
    let mut paragraph = RtfParagraphBuilder::default();
    let mut table = RtfTableBuilder::default();
    let mut in_table = false;
    let mut linear_text = String::new();
    let mut blocks = Vec::new();
    let mut skip_depth: Option<usize> = None;
    let mut ignorable_current_group = false;
    let mut unicode_fallback_remaining = 0usize;

    while index < bytes.len() {
        let byte = bytes[index];

        if unicode_fallback_remaining > 0 {
            if byte == b'\\' && index + 1 < bytes.len() && bytes[index + 1] == b'\'' {
                index = (index + 4).min(bytes.len());
            } else {
                index += 1;
            }
            unicode_fallback_remaining -= 1;
            continue;
        }

        if let Some(active_skip_depth) = skip_depth {
            match byte {
                b'{' => {
                    depth += 1;
                    index += 1;
                }
                b'}' => {
                    if depth == active_skip_depth {
                        skip_depth = None;
                    }
                    depth = depth.saturating_sub(1);
                    styles.pop();
                    if styles.is_empty() {
                        styles.push(RtfTextStyle {
                            uc_skip: 1,
                            ..RtfTextStyle::default()
                        });
                    }
                    index += 1;
                }
                _ => index += 1,
            }
            continue;
        }

        match byte {
            b'{' => {
                depth += 1;
                styles.push(styles.last().cloned().unwrap_or_default());
                ignorable_current_group = false;
                index += 1;
            }
            b'}' => {
                depth = depth.saturating_sub(1);
                styles.pop();
                if styles.is_empty() {
                    styles.push(RtfTextStyle {
                        uc_skip: 1,
                        ..RtfTextStyle::default()
                    });
                }
                index += 1;
            }
            b'\\' => {
                index += 1;
                if index >= bytes.len() {
                    break;
                }
                match bytes[index] {
                    b'\\' | b'{' | b'}' => {
                        let ch = bytes[index] as char;
                        if let Some(style) = styles.last() {
                            paragraph.push_text(&ch.to_string(), style);
                        }
                        index += 1;
                    }
                    b'*' => {
                        ignorable_current_group = true;
                        index += 1;
                    }
                    b'\'' => {
                        if index + 2 < bytes.len() {
                            let mut hex_bytes = Vec::new();
                            while index + 2 < bytes.len() && bytes[index] == b'\'' {
                                let (Some(high), Some(low)) = (
                                    rtf_hex_value(bytes[index + 1]),
                                    rtf_hex_value(bytes[index + 2]),
                                ) else {
                                    break;
                                };
                                hex_bytes.push((high << 4) | low);
                                index += 3;
                                if !(index + 3 < bytes.len()
                                    && bytes[index] == b'\\'
                                    && bytes[index + 1] == b'\'')
                                {
                                    break;
                                }
                                index += 1;
                            }
                            if !hex_bytes.is_empty() {
                                let ch = styles
                                    .last()
                                    .map(|style| rtf_decode_hex_bytes(&hex_bytes, style))
                                    .unwrap_or_else(|| {
                                        hex_bytes.iter().map(|byte| char::from(*byte)).collect()
                                    });
                                if let Some(style) = styles.last() {
                                    paragraph.push_text(&ch, style);
                                }
                            } else {
                                index += 1;
                            }
                        } else {
                            index += 1;
                        }
                    }
                    b'\n' | b'\r' => index += 1,
                    control_start if control_start.is_ascii_alphabetic() => {
                        let control_start_index = index;
                        while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
                            index += 1;
                        }
                        let control = std::str::from_utf8(&bytes[control_start_index..index])
                            .map_err(|error| {
                                format!("Could not read RTF control word: {}", error)
                            })?;

                        let mut negative = false;
                        if index < bytes.len() && bytes[index] == b'-' {
                            negative = true;
                            index += 1;
                        }
                        let parameter_start = index;
                        while index < bytes.len() && bytes[index].is_ascii_digit() {
                            index += 1;
                        }
                        let parameter = if index > parameter_start {
                            let parsed = std::str::from_utf8(&bytes[parameter_start..index])
                                .ok()
                                .and_then(|value| value.parse::<i32>().ok());
                            parsed.map(|value| if negative { -value } else { value })
                        } else {
                            None
                        };

                        if index < bytes.len() && bytes[index] == b' ' {
                            index += 1;
                        }

                        if rtf_destination_should_skip(control)
                            || (ignorable_current_group && control != "rtf")
                        {
                            skip_depth = Some(depth);
                            continue;
                        }

                        let skip_count = if let Some(style) = styles.last_mut() {
                            apply_rtf_control(
                                control,
                                parameter,
                                style,
                                &mut paragraph,
                                &mut blocks,
                                &mut linear_text,
                                &mut table,
                                &mut in_table,
                            )
                        } else {
                            None
                        };
                        unicode_fallback_remaining = skip_count.unwrap_or(0);
                        ignorable_current_group = false;
                    }
                    _ => index += 1,
                }
            }
            b'\n' | b'\r' => index += 1,
            _ => {
                let ch = byte as char;
                if let Some(style) = styles.last() {
                    paragraph.push_text(&ch.to_string(), style);
                }
                index += 1;
            }
        }
    }

    if in_table {
        table.push_row(&mut paragraph);
    }
    if let Some(block) = table.finish() {
        blocks.push(block);
    }
    append_rtf_paragraph(&mut blocks, &mut linear_text, &mut paragraph);
    Ok((linear_text, blocks))
}

pub(super) fn extract_rtf_payload(
    bytes: &[u8],
    file_name: String,
    hash: String,
    byte_len: u64,
) -> Result<ReaderImportPayload, String> {
    let raw = decode_reader_text(bytes, None)?;
    let (text, blocks) = parse_rtf_document(&raw)?;
    if text.trim().is_empty() && blocks.is_empty() {
        return Err("RTF document did not contain readable text.".to_string());
    }

    Ok(ReaderImportPayload {
        canonical_schema_version: default_canonical_schema_version(),
        title: title_from_file_stem(&file_name),
        file_name,
        source_type: "rtf".to_string(),
        mime_type: "application/rtf".to_string(),
        extractor_version: RTF_EXTRACTOR_VERSION,
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
