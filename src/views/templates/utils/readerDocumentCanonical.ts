import type { ReaderContentBlock, ReaderDocument, ReaderSchemaVersion } from '@/types/reader.js';
import type { ReaderTableExtension } from '@/types/reader.js';

export const CURRENT_CANONICAL_SCHEMA_VERSION = 1 as ReaderSchemaVersion;

function participatesInLinearText(block: ReaderContentBlock): boolean {
	return block.participates_in_linear_text !== false;
}

/**
 * Ensures a document has canonical blocks for the single reader pipeline.
 * First-version reader documents are expected to already contain canonical blocks.
 */
export function ensureReaderDocumentForRendering(document: ReaderDocument): ReaderDocument {
	const canonicalVersion = document.canonical_schema_version ?? CURRENT_CANONICAL_SCHEMA_VERSION;

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
	return block.extensions?.table;
}

export function tableCellTokenKey(blockId: string, row: number, col: number): string {
	return `${blockId}::${row}::${col}`;
}
