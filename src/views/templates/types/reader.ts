export type {
	ReaderCapabilities,
	ReaderColorThemeId,
	ReaderFormat,
	ReaderLocator as NormalizedReaderLocator,
	ReaderLookupTarget,
	ReaderPublication,
	ReaderPublicationMetadata,
	ReaderPublicationSource,
	ReaderReadingOrderItem,
	ReaderRenderContext,
	ReaderResource,
	ReaderResourceKind,
	ReaderThemeSettings,
} from '@/reader/types.js';

/**
 * String indices in `ReaderContentBlock.text` and global `ReaderDocument.text`
 * use JavaScript string indexing (UTF-16 code units), matching `String.length`
 * and `String.prototype.slice` used by pagination.
 */
export type ReaderTextAlign = 'start' | 'end' | 'center' | 'justify';
export type ReaderSchemaVersion = number;
export type ReaderExtractorVersion = number;

export type ReaderInlineSpanStyle =
	| 'strong'
	| 'emphasis'
	| 'underline'
	| 'strikethrough'
	| 'code'
	| 'subscript'
	| 'superscript'
	| 'mark'
	| string;

export interface ReaderInlineSpan {
	start: number;
	end: number;
	style: ReaderInlineSpanStyle;
}

export interface ReaderTableCell {
	text: string;
	is_header?: boolean;
	spans?: ReaderInlineSpan[];
}

export interface ReaderTableRow {
	cells: ReaderTableCell[];
}

export interface ReaderTableExtension {
	rows: ReaderTableRow[];
}

export interface ReaderImageExtension {
	asset_id: string;
	mime_type: string;
	width?: number;
	height?: number;
	/** Data URL or absolute http(s) URL for display when Pouch assets are absent. */
	inline_src?: string;
}

export interface ReaderListItemExtension {
	list_id: string;
	nesting_depth: number;
	list_style: 'ordered' | 'bullet';
	ordinal?: number;
}

export interface ReaderBlockStyleExtension {
	text_indent?: string;
	text_align?: ReaderTextAlign;
	small_text?: boolean;
	note?: boolean;
	boxed?: boolean;
	poem?: boolean;
	centered?: boolean;
	vertical_writing_mode?: boolean;
}

/** Per-block metadata (tables, images, list structure, importer hints). */
export type ReaderBlockExtensions = {
	table?: ReaderTableExtension;
	image?: ReaderImageExtension;
	list_item?: ReaderListItemExtension;
	block_style?: ReaderBlockStyleExtension;
} & Record<string, unknown>;

export interface ReaderContentBlock {
	id: string;
	/**
	 * Structural role: paragraph, heading, table, image, list_item, blockquote,
	 * code_block, thematic_break, aside, document_title, etc.
	 */
	kind: string;
	text: string;
	/**
	 * Offsets into global `document.text` when participatesInLinearText is true.
	 * Omitted for Option-B blocks (table, image) that do not participate in the linear stream.
	 */
	start_offset?: number;
	end_offset?: number;
	/**
	 * When false, block text is not a slice of document.text (e.g. tables: cell text lives under extensions.table).
	 * Default true for backwards compatibility.
	 */
	participates_in_linear_text?: boolean;
	heading_level?: 1 | 2 | 3 | 4 | 5 | 6;
	text_align?: ReaderTextAlign;
	spans?: ReaderInlineSpan[];
	extensions?: ReaderBlockExtensions;
}

/** Binary payload stored as a PouchDB attachment under `assets/<asset_id>`. */
export interface ReaderAssetAttachmentInput {
	asset_id: string;
	mime_type: string;
	data: Blob | Uint8Array;
}

export interface ReaderImportPayload {
	/** Defaults to 1 when missing (legacy documents). */
	canonical_schema_version?: ReaderSchemaVersion;
	title: string;
	file_name: string;
	source_type: 'plain_text' | string;
	mime_type: string;
	extractor_version: ReaderExtractorVersion;
	text: string;
	blocks: ReaderContentBlock[];
	color?: string;
	source_url?: string;
	source_html?: string;
	source_data?: ArrayBuffer | Uint8Array | number[];
	/** Hex sha256 of source_data when present; for re-import integrity. */
	source_sha256?: string;
	source_byte_length?: number;
	import_app_version?: string;
	/** Not stored on the document row; written as attachments via ReaderDocumentManager. */
	asset_attachments?: ReaderAssetAttachmentInput[];
}

export interface ReaderTextPosition {
	start: number;
	end: number;
}

export interface ReaderTextQuote {
	exact: string;
	prefix: string;
	suffix: string;
}

export interface ReaderLocator {
	resource_href: string;
	position: number;
	total_progression: number;
	page_index: number;
	text_position: ReaderTextPosition;
	text_quote: ReaderTextQuote;
	updated_at: string;
	/** Logical anchor; offsets are UTF-16 code units within that block's text (or cell). */
	block_id?: string;
	offset_in_block?: number;
	table_row?: number;
	table_col?: number;
}

export interface ReaderDocument extends ReaderImportPayload {
	_id: string;
	_rev?: string;
	imported_at: string;
	updated_at: string;
	reading_order: Array<{
		href: string;
		type: string;
		title: string;
	}>;
	progress: ReaderLocator;
}

/**
 * Token offsets are relative to the block `text` string (UTF-16 code units).
 * `block_id` identifies the source block; `table_cell` when set means offsets are relative to that cell's text.
 */
export interface ReaderToken {
	text: string;
	start: number;
	end: number;
	block_id?: string;
	table_cell?: {
		row: number;
		col: number;
	};
}
