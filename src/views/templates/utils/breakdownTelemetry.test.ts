import { beforeEach, expect, it, vi } from 'vitest';
import { telemetry } from '@/utils/telemetry.js';
import { breakdownSource, createBreakdownTelemetry } from '@/utils/breakdownTelemetry.js';
import type { BreakdownInteraction, BreakdownTelemetryContext } from '@/types/telemetry.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
beforeEach(() => vi.mocked(telemetry.trackEvent).mockClear());
const context: BreakdownTelemetryContext = {
	surface: 'sidebar',
	source: 'search',
	character_count: 2,
};
it('keeps one lifecycle pair through responsive updates and closes at most once', () => {
	const visit = createBreakdownTelemetry();
	visit.open(context);
	visit.open({ ...context, surface: 'entry' });
	visit.open(context);
	visit.close('back');
	visit.close('navigation');
	expect(
		vi
			.mocked(telemetry.trackEvent)
			.mock.calls.filter(([name]) => name === 'dictionary.breakdown_opened')
	).toEqual([['dictionary.breakdown_opened', context]]);
	expect(telemetry.trackEvent).toHaveBeenCalledWith('dictionary.breakdown_closed', {
		...context,
		reason: 'back',
	});
	expect(telemetry.trackEvent).toHaveBeenCalledTimes(2);
});
it('records intentional interactions while limiting hover previews per component', () => {
	const visit = createBreakdownTelemetry();
	visit.open(context);
	const preview: BreakdownInteraction = {
		action: 'component_previewed',
		script: 'simplified',
		character_position: 1,
		component_position: 1,
		input: 'glyph',
	};
	visit.interact(preview);
	visit.interact(preview);
	visit.interact({ ...preview, input: 'control' });
	visit.interact({ action: 'component_selected', component_position: 1 });
	visit.interact({ action: 'character_lookup' });
	visit.interact({ action: 'entry_changed' });
	visit.interact(preview);
	expect(
		vi
			.mocked(telemetry.trackEvent)
			.mock.calls.filter(
				([, value]) => 'action' in value && value.action === 'component_previewed'
			)
	).toHaveLength(2);
	visit.close('dismissed');
	visit.interact(preview);
	expect(telemetry.trackEvent).toHaveBeenCalledTimes(7);
});
it('only sends allowlisted metadata and maps routes without private IDs', () => {
	const visit = createBreakdownTelemetry();
	visit.open({ ...context, word: '清水', lexicalId: 'private-id' } as BreakdownTelemetryContext);
	visit.interact({
		action: 'character_lookup',
		character: '清',
		description: 'private prose',
	} as BreakdownInteraction);
	visit.close('navigation');
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toMatch(
		/清|private|description|lexicalId/
	);
	expect(breakdownSource('#/read/document/private-document')).toBe('reader');
	expect(breakdownSource('#/bookmarks/private-list')).toBe('bookmarks');
});
