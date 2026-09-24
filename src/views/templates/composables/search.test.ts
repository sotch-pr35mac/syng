import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { telemetry } from '@/utils/telemetry.js';
import type { SearchEntry } from '@/types/search.js';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('@/stores/bookmarks.svelte.js', () => ({ bookmarksStore: { lists: [] } }));

const words = [
	{ id: '1:watermelon', simplified: '西瓜', traditional: '西瓜' },
	{ id: '1:apple', simplified: '苹果', traditional: '蘋果' },
] as SearchEntry[];
let search: typeof import('@/composables/search.svelte.js').searchStore;
const events = (name: string) =>
	vi.mocked(telemetry.trackEvent).mock.calls.filter(([eventName]) => eventName === name);

beforeEach(async () => {
	vi.useFakeTimers();
	vi.resetModules();
	vi.mocked(telemetry.trackEvent).mockClear();
	vi.mocked(invoke).mockReset();
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'classify' ? 'EN' : words
	);
	search = (await import('@/composables/search.svelte.js')).searchStore;
});
afterEach(() => {
	search.cancelPendingTelemetry();
	vi.useRealTimers();
});

it('counts a typing burst once and ignores unchanged callbacks', async () => {
	search.doSearch('w');
	await vi.advanceTimersByTimeAsync(400);
	search.doSearch('water');
	await vi.advanceTimersByTimeAsync(799);
	expect(events('search.query')).toHaveLength(0);
	search.doSearch('water');
	await vi.advanceTimersByTimeAsync(1);
	expect(events('search.query')).toHaveLength(1);
	expect(events('search.query')[0][1]).toMatchObject({
		term_length: 5,
		search_language: 'EN',
		result_count: 2,
		trigger: 'pause',
		outcome: 'success',
	});
	search.doSearch(' water ');
	await vi.advanceTimersByTimeAsync(1000);
	expect(events('search.query')).toHaveLength(1);
	expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === 'query')).toHaveLength(2);
});

it('records quick selection before the timer and links subsequent selections to the same query', async () => {
	search.doSearch('watermelon');
	await vi.advanceTimersByTimeAsync(0);
	search.selectResult(1);
	search.selectResult(0);
	await vi.advanceTimersByTimeAsync(800);
	expect(events('search.query')).toHaveLength(1);
	expect(events('search.query')[0][1]).toMatchObject({ trigger: 'selection' });
	expect(events('dictionary.word_opened')).toHaveLength(2);
	expect(events('dictionary.word_opened')[0][1]).toMatchObject({
		source: 'search',
		interaction: 'result',
		result_position: 2,
		result_count: 2,
		query_id: (events('search.query')[0][1] as { query_id: string }).query_id,
	});
	expect(JSON.stringify(vi.mocked(telemetry.trackEvent).mock.calls)).not.toMatch(
		/watermelon|西瓜|1:apple/
	);
});

it('submits once, including repeated Enter, without waiting for the timer', async () => {
	search.doSearch('word');
	await vi.advanceTimersByTimeAsync(0);
	search.submitSearch();
	search.submitSearch();
	await vi.advanceTimersByTimeAsync(1000);
	expect(events('search.query')).toHaveLength(1);
	expect(events('search.query')[0][1]).toMatchObject({ trigger: 'submit' });
});

it('clearing cancels a pending event and allows the same text to be searched again', async () => {
	search.doSearch('word');
	search.doSearch('');
	await vi.advanceTimersByTimeAsync(1000);
	expect(events('search.query')).toHaveLength(0);
	expect(search.fullResults).toEqual([]);
	search.doSearch('word');
	await vi.advanceTimersByTimeAsync(800);
	expect(events('search.query')).toHaveLength(1);
});

it.each(['EN', 'PY', 'ZH'] as const)(
	'captures %s for automatic and manual requests',
	async (language) => {
		vi.mocked(invoke).mockImplementation(async (command) =>
			command === 'classify' ? language : []
		);
		search.doSearch(' 𠀀字 ');
		await vi.advanceTimersByTimeAsync(800);
		expect(events('search.query')[0][1]).toMatchObject({
			search_language: language,
			language_mode: 'auto',
			term_length: 2,
			result_count: 0,
		});
		search.doSearchWithLang('same', language);
		await vi.advanceTimersByTimeAsync(800);
		expect(events('search.query')[1][1]).toMatchObject({
			search_language: language,
			language_mode: 'manual',
		});
	}
);

it('never substitutes the previous language when classification is uncertain', async () => {
	vi.mocked(invoke).mockImplementation(async (command) => {
		if (command === 'classify') {
			throw new Error('uncertain');
		}
		return [];
	});
	search.doSearch('?!');
	await vi.advanceTimersByTimeAsync(800);
	expect(events('search.query')[0][1]).toMatchObject({
		search_language: null,
		result_count: 0,
		outcome: 'success',
	});
});

it('distinguishes failed queries from empty results', async () => {
	vi.mocked(invoke).mockImplementation(async (command) => {
		if (command === 'classify') {
			return 'EN';
		}
		throw new Error('lookup failed');
	});
	search.doSearch('word');
	await vi.advanceTimersByTimeAsync(800);
	expect(events('search.query')[0][1]).toMatchObject({ outcome: 'error', result_count: null });
});

it('ignores old responses, including automatic classification arriving after a manual switch', async () => {
	let resolveOldLanguage!: (value: string) => void;
	let resolveOldQuery!: (value: SearchEntry[]) => void;
	vi.mocked(invoke).mockImplementation((command) => {
		if (command === 'classify') {
			return new Promise((resolve) => {
				resolveOldLanguage = resolve;
			});
		}
		if (command === 'query') {
			return new Promise((resolve) => {
				resolveOldQuery = resolve;
			});
		}
		return Promise.resolve([words[1]]);
	});
	search.doSearch('old');
	search.doSearchWithLang('new', 'ZH');
	await vi.advanceTimersByTimeAsync(800);
	resolveOldLanguage('PY');
	resolveOldQuery([words[0]]);
	await vi.advanceTimersByTimeAsync(1000);
	expect(search.searchLang).toBe('ZH');
	expect(search.fullResults).toEqual([words[1]]);
	expect(events('search.query')).toHaveLength(1);
});

it('attributes clicks on still-displayed results to the older request', async () => {
	search.doSearch('old');
	await vi.advanceTimersByTimeAsync(0);
	vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
	search.doSearch('new');
	search.selectResult(0);
	expect(events('search.query')[0][1]).toMatchObject({ term_length: 3, trigger: 'selection' });
	expect(events('dictionary.word_opened')[0][1]).toMatchObject({
		query_id: (events('search.query')[0][1] as { query_id: string }).query_id,
	});
});

it('cancels pending telemetry on background and route exit without replaying on remount', async () => {
	const unmount = search.mount();
	search.doSearch('word');
	window.dispatchEvent(new Event('pagehide'));
	await vi.advanceTimersByTimeAsync(1000);
	expect(events('search.query')).toHaveLength(0);
	search.doSearch('another');
	unmount();
	await vi.advanceTimersByTimeAsync(1000);
	const unmountAgain = search.mount();
	await vi.advanceTimersByTimeAsync(1000);
	expect(events('search.query')).toHaveLength(0);
	unmountAgain();
});
