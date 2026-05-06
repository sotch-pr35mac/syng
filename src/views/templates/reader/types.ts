export type ReaderFormat = 'text' | 'webpage' | 'epub' | 'pdf';

export type ReaderResourceKind = 'reflowable-document' | 'fixed-page' | 'asset' | 'navigation';

export type ReaderColorThemeId = 'automatic' | 'light' | 'sepia' | 'dark';

export interface ReaderPublicationMetadata {
	title: string;
	author?: string;
	language?: string;
	description?: string;
	sourceTitle?: string;
	sourceUrl?: string;
	coverHref?: string;
}

export interface ReaderPublicationSource {
	id: string;
	format: ReaderFormat;
	fileName?: string;
	mimeType?: string;
	importedAt: string;
	extractorVersion: number;
}

export interface ReaderResource {
	href: string;
	type: string;
	title?: string;
	kind: ReaderResourceKind;
	text?: string;
	html?: string;
	data?: ArrayBuffer;
	pageIndex?: number;
	properties?: Record<string, unknown>;
}

export interface ReaderReadingOrderItem {
	href: string;
	type: string;
	title?: string;
	duration?: number;
}

export interface ReaderCapabilities {
	reflowable: boolean;
	fixedLayout: boolean;
	hasTextLayer: boolean;
	supportsDictionaryLookup: boolean;
	supportsThemes: boolean;
	supportsPageCurl: boolean;
}

export interface ReaderPublication {
	id: string;
	format: ReaderFormat;
	metadata: ReaderPublicationMetadata;
	source: ReaderPublicationSource;
	readingOrder: ReaderReadingOrderItem[];
	resources: ReaderResource[];
	capabilities: ReaderCapabilities;
}

export interface ReaderTextSelector {
	resourceHref: string;
	start: number;
	end: number;
	exact: string;
	prefix: string;
	suffix: string;
}

export interface ReaderStructuralSelector {
	resourceHref: string;
	cssSelector?: string;
	elementId?: string;
	blockId?: string;
	blockOffset?: number;
}

export interface ReaderPdfSelector {
	resourceHref: string;
	pageIndex: number;
	charIndex?: number;
	text?: ReaderTextSelector;
}

export type ReaderLocator =
	| {
			type: 'reflowable';
			resourceHref: string;
			progression: number;
			text?: ReaderTextSelector;
			structural?: ReaderStructuralSelector;
			updatedAt: string;
	  }
	| {
			type: 'pdf';
			resourceHref: string;
			pageIndex: number;
			progression: number;
			text?: ReaderTextSelector;
			updatedAt: string;
	  };

export interface ReaderThemeSettings {
	view: 'paged' | 'scroll';
	colorTheme: ReaderColorThemeId;
	fontFamily: string;
	fontSizePercent: number;
	lineHeight: number;
	marginScale: number;
	columnCount: number;
	backgroundColor: string;
	textColor: string;
	linkColor: string;
	selectionBackgroundColor: string;
	selectionTextColor: string;
	writingMode: 'horizontal-tb' | 'vertical-rl';
	pdfZoom: number;
	reducedMotion: boolean;
}

export interface ReaderRenderContext {
	publication: ReaderPublication;
	resourceHref: string;
	settings: ReaderThemeSettings;
	viewport: {
		width: number;
		height: number;
	};
}

export interface ReaderLookupTarget {
	text: string;
	range?: Range;
	anchor: DOMRect;
	resourceHref: string;
	offset?: number;
}
