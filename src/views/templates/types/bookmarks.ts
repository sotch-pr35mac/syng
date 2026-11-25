export const BOOKMARK_LIST_MEMBERSHIP_OPERATIONS = {
	ADDED: 'added',
	REMOVED: 'removed',
} as const;

export type BookmarkListMembershipOperation =
	(typeof BOOKMARK_LIST_MEMBERSHIP_OPERATIONS)[keyof typeof BOOKMARK_LIST_MEMBERSHIP_OPERATIONS];

/** Successful bookmark list-membership mutation reported by dictionary content. */
export type BookmarkListMembershipEvent = {
	listName: string;
	lexicalId: string;
	operation: BookmarkListMembershipOperation;
};

export type BookmarkListSummary = { name: string; wordCount: number };

/** Transient import preview; exported definitions never become stored notes. */
export interface PlecoRow {
	line: number;
	original: string;
	category: string;
	headword: string;
	pronunciation: string;
	definition: string;
	candidates: import('./dictionary.js').LexicalUnit[];
	selected: string | null;
	reason: string | null;
}
export interface PlecoPreview {
	source_format: 'text' | 'xml';
	file_name: string;
	rows: PlecoRow[];
}
/** IDs are reserved once per attempt and retained when retrying a partial import. */
export interface ImportedList {
	id: string;
	name: string;
	lexicalIds: string[];
}

/** Metadata only; packaged lexical IDs are loaded when the learner selects a list. */
export interface HskListSummary {
	id: string;
	standard: Exclude<import('./dictionaryDisplay.js').HskVariant, 'none'>;
	level: import('./hsk.js').HskLevel;
	word_count: number;
}

/** Normalized Syng archive returned by the native version-aware reader. */
export interface SyngListArchive {
	meta: { version: 'V4'; name: string };
	entries: { lexical_id: string; notes?: string }[];
	recovery_report?: string;
}
export type ListImportPreview =
	{ format: 'syng'; archive: SyngListArchive } | { format: 'pleco'; preview: PlecoPreview };
