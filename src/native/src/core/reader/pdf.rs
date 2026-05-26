//! PDF import.
//!
//! Extracts text from PDF files using glyph-level layout analysis. Groups glyphs into lines
//! based on spatial proximity, detects paragraphs, headings, and tables from font size and
//! column alignment, and produces canonical reader content blocks with UTF-16 offsets.

use std::cmp::Ordering;

use uuid::Uuid;

use crate::core::reader::{
    default_canonical_schema_version, normalize_line_endings, title_from_file_stem,
    utf16_len, FormatExtractor, ReaderBlockExtensions, ReaderBlockStyleExtension,
    ReaderContentBlock, ReaderImportPayload, ReaderTableCell, ReaderTableExtension,
    ReaderTableRow, PDF_EXTRACTOR_VERSION,
};

/// PDF format extractor implementing [`FormatExtractor`].
pub(crate) struct PdfFormat;

impl FormatExtractor for PdfFormat {
    fn extract(
        bytes: &[u8],
        file_name: String,
        hash: String,
        byte_len: u64,
    ) -> Result<ReaderImportPayload, String> {
        extract_pdf_payload(bytes, file_name, hash, byte_len)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum PdfExtractionFailure {
    Unreadable(String),
}

#[cfg(test)]
/// Extracts per-page text strings using the provided extraction closure.
pub(super) fn extract_pdf_pages_with<F>(extract: F) -> Result<Vec<String>, PdfExtractionFailure>
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
pub(super) struct PdfLine {
    pub(super) text: String,
    pub(super) segments: Vec<PdfLineSegment>,
    pub(super) x_min: f64,
    pub(super) x_max: f64,
    pub(super) y: f64,
    pub(super) font_size: f64,
    pub(super) page_num: u32,
    pub(super) page_width: f64,
}

#[derive(Debug, Clone)]
pub(super) struct PdfLineSegment {
    pub(super) text: String,
    pub(super) x_min: f64,
    pub(super) x_max: f64,
}

#[derive(Debug, Clone)]
pub(super) struct PdfDetectedTableRun {
    pub(super) end: usize,
    pub(super) rows: Vec<Vec<String>>,
}

fn cmp_f64(left: f64, right: f64) -> Ordering {
    left.partial_cmp(&right).unwrap_or(Ordering::Equal)
}

/// Groups page glyphs into lines by clustering on vertical position and sorting horizontally.
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
pub(super) struct PdfLineRole {
    pub(super) kind: String,
    pub(super) heading_level: Option<u8>,
    pub(super) text_align: Option<String>,
    pub(super) small_text: bool,
    pub(super) centered: bool,
    pub(super) text_indent: Option<String>,
}

/// Classifies a PDF line as heading, centered, or body text based on font size and position.
pub(super) fn classify_pdf_line(line: &PdfLine, body_font_size: f64, typical_left: f64) -> PdfLineRole {
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
    if anchor.segments.len() != candidate.segments.len()
        || !is_pdf_table_candidate_line(candidate, body_font_size)
    {
        return false;
    }

    if candidate.page_num == previous.page_num {
        let row_gap = candidate.y - previous.y;
        if row_gap <= 0.0 || row_gap > body_font_size.max(previous.font_size).max(1.0) * 4.0 {
            return false;
        }
    } else if candidate.page_num <= previous.page_num {
        return false;
    }

    let column_tolerance = body_font_size.max(anchor.font_size).max(1.0) * 2.0;
    anchor
        .segments
        .iter()
        .zip(candidate.segments.iter())
        .all(|(left, right)| (left.x_min - right.x_min).abs() <= column_tolerance)
}

fn pdf_table_segment_column(
    anchor: &PdfLine,
    segment: &PdfLineSegment,
    body_font_size: f64,
) -> Option<usize> {
    let column_tolerance = body_font_size.max(anchor.font_size).max(1.0) * 2.0;
    anchor
        .segments
        .iter()
        .enumerate()
        .filter_map(|(index, column)| {
            let distance = (column.x_min - segment.x_min).abs();
            (distance <= column_tolerance).then_some((index, distance))
        })
        .min_by(|left, right| cmp_f64(left.1, right.1))
        .map(|(index, _)| index)
}

fn is_pdf_table_continuation_line(
    anchor: &PdfLine,
    previous: &PdfLine,
    candidate: &PdfLine,
    body_font_size: f64,
) -> bool {
    if candidate.page_num != previous.page_num
        || candidate.page_num != anchor.page_num
        || candidate.segments.is_empty()
        || candidate.segments.len() > anchor.segments.len()
    {
        return false;
    }

    let row_gap = candidate.y - previous.y;
    if row_gap <= 0.0 || row_gap > body_font_size.max(previous.font_size).max(1.0) * 2.0 {
        return false;
    }

    let boundary_tolerance = body_font_size.max(anchor.font_size).max(1.0) * 2.0;
    if candidate.x_min < anchor.x_min - boundary_tolerance {
        return false;
    }

    candidate
        .segments
        .iter()
        .all(|segment| pdf_table_segment_column(anchor, segment, body_font_size).is_some())
}

fn detected_pdf_table_row_from_line(line: &PdfLine) -> Vec<String> {
    line.segments
        .iter()
        .map(|segment| segment.text.clone())
        .collect()
}

/// Detects a contiguous run of lines that form a table based on consistent column alignment.
pub(super) fn detect_pdf_table_run(
    lines: &[PdfLine],
    start: usize,
    body_font_size: f64,
) -> Option<PdfDetectedTableRun> {
    let anchor = lines.get(start)?;
    if !is_pdf_table_candidate_line(anchor, body_font_size) {
        return None;
    }

    let mut end = start + 1;
    let mut rows = vec![detected_pdf_table_row_from_line(anchor)];
    while let (Some(previous), Some(candidate)) = (lines.get(end - 1), lines.get(end)) {
        if pdf_table_rows_compatible(anchor, previous, candidate, body_font_size) {
            rows.push(detected_pdf_table_row_from_line(candidate));
            end += 1;
            continue;
        }

        if is_pdf_table_continuation_line(anchor, previous, candidate, body_font_size) {
            if let Some(row) = rows.last_mut() {
                for segment in &candidate.segments {
                    if let Some(column_index) =
                        pdf_table_segment_column(anchor, segment, body_font_size)
                    {
                        if let Some(cell) = row.get_mut(column_index) {
                            if !cell.is_empty() {
                                cell.push('\n');
                            }
                            cell.push_str(&segment.text);
                        }
                    }
                }
            }
            end += 1;
            continue;
        }

        break;
    }

    if rows.len() >= 2 {
        Some(PdfDetectedTableRun { end, rows })
    } else {
        None
    }
}

/// Converts detected table rows into a reader table content block and appends it.
pub(super) fn push_pdf_table_block(blocks: &mut Vec<ReaderContentBlock>, detected_rows: &[Vec<String>]) {
    let rows = detected_rows
        .iter()
        .enumerate()
        .map(|(row_index, row)| {
            let cells = row
                .iter()
                .map(|cell| ReaderTableCell {
                    text: cell.clone(),
                    is_header: row_index == 0,
                    spans: None,
                })
                .collect::<Vec<_>>();
            ReaderTableRow { cells }
        })
        .collect::<Vec<_>>();
    let table_text = detected_rows
        .iter()
        .map(|row| {
            row.iter()
                .map(String::as_str)
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

/// Converts a layout document into linear text and content blocks, handling paragraph
/// continuation across page boundaries and table detection.
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
        if let Some(table_run) = detect_pdf_table_run(&lines, index, body_font_size) {
            flush_active(
                &mut text,
                &mut blocks,
                &mut active_text,
                &mut active_role,
                &mut active_start,
            );
            push_pdf_table_block(&mut blocks, &table_run.rows);
            previous_line = lines.get(table_run.end - 1).cloned();
            index = table_run.end;
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

pub(super) fn pdf_notice_payload(
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

/// Extracts a reader import payload from a PDF file's raw bytes.
pub(super) fn extract_pdf_payload(
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
