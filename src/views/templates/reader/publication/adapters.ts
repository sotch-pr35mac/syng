import type {
	ReaderCapabilities,
	ReaderFormat,
	ReaderPublication,
	ReaderPublicationMetadata,
	ReaderPublicationSource,
} from '@/reader/types.js';

export interface ReaderAdapterInput {
	id: string;
	title?: string;
	fileName?: string;
	mimeType?: string;
	sourceUrl?: string;
	importedAt?: string;
	text?: string;
	html?: string;
	data?: ArrayBuffer | Uint8Array;
}

export interface ReaderFormatAdapter {
	format: ReaderFormat;
	canOpen(_input: ReaderAdapterInput): boolean;
	open(_input: ReaderAdapterInput): Promise<ReaderPublication>;
}

export function createPublicationSource(
	input: ReaderAdapterInput,
	format: ReaderFormat,
	extractorVersion = 1
): ReaderPublicationSource {
	return {
		id: input.id,
		format,
		fileName: input.fileName,
		mimeType: input.mimeType,
		importedAt: input.importedAt ?? new Date().toISOString(),
		extractorVersion,
	};
}

export function createDefaultCapabilities(
	overrides: Partial<ReaderCapabilities> = {}
): ReaderCapabilities {
	return {
		reflowable: false,
		fixedLayout: false,
		hasTextLayer: false,
		supportsDictionaryLookup: false,
		supportsThemes: false,
		supportsPageCurl: true,
		...overrides,
	};
}

export function createDefaultMetadata(input: ReaderAdapterInput): ReaderPublicationMetadata {
	return {
		title: input.title ?? input.fileName ?? 'Untitled',
		sourceUrl: input.sourceUrl,
	};
}

export function normalizeText(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}
