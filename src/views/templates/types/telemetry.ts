import type { SearchLang } from '@/types/search.js';
import type { WalkthroughId } from '@/types/walkthrough.js';

export type WalkthroughSource = 'help' | 'settings' | 'invitation' | 'direct';
export type WalkthroughEntry = WalkthroughSource | 'choice' | 'example' | 'retry' | 'resume';
export type WalkthroughEvent =
	| 'invitation_shown'
	| 'invitation_accepted'
	| 'invitation_dismissed'
	| 'help_clicked'
	| 'started'
	| 'step_viewed'
	| 'next'
	| 'back'
	| 'paused'
	| 'resumed'
	| 'skipped'
	| 'completed'
	| 'interrupted'
	| 'chooser_viewed'
	| 'content_selected'
	| 'retried'
	| 'failed'
	| 'example_requested'
	| 'example_added';

/** Static guide/step identifiers only. Never include saved context, titles, or list/document IDs. */
export interface WalkthroughTelemetry {
	guide: WalkthroughId;
	source: WalkthroughSource;
	step?: string;
	step_number?: number;
	step_count?: number;
	mode?: 'new' | 'replay' | 'restart';
	reason?: 'navigation' | 'blocked' | 'unmount' | 'dismissed' | 'overlay' | 'replaced';
	content_kind?: 'document' | 'list';
	choice_count?: number;
	fresh_copy?: boolean;
	operation?: 'prepare' | 'example';
	view?: 'instructions' | 'dictionary-popup';
}

export interface WhatsNewTelemetry {
	from_version: string | null;
	to_version: string;
	source: 'update' | 'settings' | 'direct';
	content_presented?: boolean;
	section?: 'improvements' | 'cumulative' | 'earlier';
	expanded?: boolean;
	target_section?: string;
	target_setting?: string;
}

export type WordOpeningSource = 'search' | 'bookmarks' | 'reader' | 'flashcards' | 'quiz';
export type QueryTrigger = 'pause' | 'selection' | 'submit';

export type BreakdownSurface = 'sidebar' | 'entry' | 'popup' | 'mobile_screen' | 'study';
export interface BreakdownTelemetryContext {
	surface: BreakdownSurface;
	source: WordOpeningSource | 'other';
	character_count: number;
}
/** Positions and static UI identifiers only; never character text or dictionary IDs. */
export interface BreakdownInteraction {
	action:
		| 'character_lookup'
		| 'component_lookup'
		| 'radical_lookup'
		| 'description_lookup'
		| 'character_changed'
		| 'script_changed'
		| 'component_selected'
		| 'component_deselected'
		| 'component_previewed'
		| 'entry_changed'
		| 'nested_breakdown_opened'
		| 'retry';
	character_position?: number;
	component_position?: number;
	script?: 'simplified' | 'traditional';
	input?: 'glyph' | 'control' | 'keyboard';
}
export type BreakdownCloseReason = 'back' | 'dismissed' | 'navigation';

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
export interface TelemetryPayloads
	extends
		Record<`walkthrough.${WalkthroughEvent}`, WalkthroughTelemetry>,
		Record<
			| 'whats_new.viewed'
			| 'whats_new.continued'
			| 'whats_new.disclosure_changed'
			| 'whats_new.action',
			WhatsNewTelemetry
		> {
	'search.query': SearchQueryTelemetry;
	'dictionary.word_opened': WordOpeningTelemetry;
	'dictionary.breakdown_opened': BreakdownTelemetryContext;
	'dictionary.breakdown_closed': BreakdownTelemetryContext & { reason: BreakdownCloseReason };
	'dictionary.breakdown_interacted': BreakdownTelemetryContext & BreakdownInteraction;
	'reader.reading_activity': { next_count: number; previous_count: number };
	'flashcards.started': { word_count: number; source: 'bookmarks' | 'study' };
	'quiz.started': { word_count: number; source: 'bookmarks' | 'study' };
	'flashcards.session_ended': { viewed_count: number; revealed_count: number };
	'quiz.abandoned': { answered_count: number };
	'tools.completed': { tool: string; mode: string; input_length: number };
	'tools.copied': { tool: string };
}
