import type { SearchLang } from '@/types/search.js';

export type WordOpeningSource = 'search' | 'bookmarks' | 'reader' | 'flashcards' | 'quiz';
export type QueryTrigger = 'pause' | 'selection' | 'submit';

export interface SearchQueryTelemetry {
	query_id: string;
	term_length: number;
	search_language: SearchLang | null;
	language_mode: 'auto' | 'manual';
	result_count: number | null;
	outcome: 'success' | 'error';
	trigger: QueryTrigger;
}

export interface WordOpeningTelemetry {
	source: WordOpeningSource;
	interaction: 'result' | 'list' | 'link' | 'token' | 'popover_result' | 'history';
	result_position?: number;
	result_count?: number;
	query_id?: string;
	search_language?: SearchLang | null;
}

/** Payload contracts for the events whose measurements require shared context. */
export interface TelemetryPayloads {
	'search.query': SearchQueryTelemetry;
	'dictionary.word_opened': WordOpeningTelemetry;
	'reader.reading_activity': { next_count: number; previous_count: number };
	'flashcards.started': { word_count: number };
	'flashcards.session_ended': { viewed_count: number; revealed_count: number };
	'quiz.abandoned': { answered_count: number };
	'tools.completed': { tool: string; mode: string; input_length: number };
	'tools.copied': { tool: string };
}
