export type {
	ReaderCapabilities,
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

export interface ReaderContentBlock {
	id: string;
	kind: 'heading' | 'paragraph' | string;
	text: string;
	start_offset: number;
	end_offset: number;
}

export interface ReaderImportPayload {
	title: string;
	file_name: string;
	source_type: 'plain_text' | string;
	mime_type: string;
	extractor_version: number;
	text: string;
	blocks: ReaderContentBlock[];
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

export interface ReaderToken {
	text: string;
	start: number;
	end: number;
}
