/**
 * Visit lifecycle state for one DictionaryContent instance. Owns open/close pairing
 * and hover deduplication across nested views and responsive layout changes.
 * The central telemetry utility still owns consent, transport, and delivery.
 */
import { telemetry } from '@/utils/telemetry.js';
import type {
	BreakdownCloseReason,
	BreakdownInteraction,
	BreakdownTelemetryContext,
} from '@/types/telemetry.js';

/** Reduce a route to an allowlisted source without recording route text or dictionary content. */
export function breakdownSource(route: string): BreakdownTelemetryContext['source'] {
	const path = route.replace(/^#/, '');
	if (!path || path === '/') {
		return 'search';
	}
	if (path.startsWith('/bookmarks')) {
		return 'bookmarks';
	}
	if (path.startsWith('/read')) {
		return 'reader';
	}
	if (path.includes('flashcard')) {
		return 'flashcards';
	}
	if (path.includes('quiz')) {
		return 'quiz';
	}
	return 'other';
}

/** One open/close pair per visit, including nested entries and responsive layout changes. */
export function createBreakdownTelemetry() {
	let active: BreakdownTelemetryContext | undefined;
	const previews = new Set<string>();
	function context(value: BreakdownTelemetryContext): BreakdownTelemetryContext {
		// Explicit allowlist prevents word objects/route strings from entering an event.
		return {
			surface: value.surface,
			source: value.source,
			character_count: value.character_count,
		};
	}
	return {
		/** Start a visit or refresh its presentation context without emitting another open. */
		open(value: BreakdownTelemetryContext) {
			const first = !active;
			active = context(value);
			if (first) {
				void telemetry.trackEvent('dictionary.breakdown_opened', active).catch(() => {});
			}
		},
		/** Finish an active visit once and release its preview deduplication state. */
		close(reason: BreakdownCloseReason) {
			if (!active) {
				return;
			}
			void telemetry
				.trackEvent('dictionary.breakdown_closed', { ...active, reason })
				.catch(() => {});
			active = undefined;
			previews.clear();
		},
		/** Record allowlisted interaction metadata; repeated previews count once per selection. */
		interact(value: BreakdownInteraction) {
			if (!active) {
				return;
			}
			if (value.action === 'entry_changed' || value.action === 'nested_breakdown_opened') {
				previews.clear();
			}
			if (value.action === 'component_previewed') {
				const key = `${value.script}:${value.character_position}:${value.component_position}`;
				if (previews.has(key)) {
					return;
				}
				previews.add(key);
			}
			const detail: BreakdownInteraction = { action: value.action };
			if (value.character_position !== undefined) {
				detail.character_position = value.character_position;
			}
			if (value.component_position !== undefined) {
				detail.component_position = value.component_position;
			}
			if (value.script !== undefined) {
				detail.script = value.script;
			}
			if (value.input !== undefined) {
				detail.input = value.input;
			}
			void telemetry
				.trackEvent('dictionary.breakdown_interacted', { ...active, ...detail })
				.catch(() => {});
		},
	};
}
