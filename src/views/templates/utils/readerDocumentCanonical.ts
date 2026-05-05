import type { ReaderContentBlock, ReaderDocument } from '@/types/reader.js';
import type { ReaderTableExtension } from '@/types/reader.js';
import { extractReaderBlocksFromPlainText } from '@/utils/readerPlainTextImport.js';

export const CURRENT_CANONICAL_SCHEMA_VERSION = 1;

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

/**
 * Ensures a document has canonical blocks for the single reader pipeline.
 * Legacy rows with empty `blocks` but non-empty full linear `text` are upgraded as paragraphs.
 */
export function ensureReaderDocumentForRendering(document: ReaderDocument): ReaderDocument {
	const canonicalVersion = document.canonical_schema_version ?? CURRENT_CANONICAL_SCHEMA_VERSION;

	if (document.blocks.length > 0) {
		return {
			...document,
			canonical_schema_version: canonicalVersion,
		};
	}

	if (document.text?.trim()) {
		return {
			...document,
			canonical_schema_version: canonicalVersion,
			blocks: extractReaderBlocksFromPlainText(document.text),
		};
	}

	return {
		...document,
		canonical_schema_version: canonicalVersion,
	};
}

export function isTableBlock(block: ReaderContentBlock): boolean {
	return (
		block.kind === 'table' &&
		Boolean(block.extensions?.table) &&
		!participatesInLinearText(block)
	);
}

export function getTableExtension(block: ReaderContentBlock): ReaderTableExtension | undefined {
	return block.extensions?.table as ReaderTableExtension | undefined;
}

export function tableCellTokenKey(blockId: string, row: number, col: number): string {
	return `${blockId}::${row}::${col}`;
}
