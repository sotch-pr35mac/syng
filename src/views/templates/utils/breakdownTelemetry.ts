import { telemetry } from '@/utils/telemetry.js';
import type {
	BreakdownCloseReason,
	BreakdownInteraction,
	BreakdownTelemetryContext,
} from '@/types/telemetry.js';

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
		open(value: BreakdownTelemetryContext) {
			const first = !active;
			active = context(value);
			if (first) {
				void telemetry.trackEvent('dictionary.breakdown_opened', active).catch(() => {});
			}
		},
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
