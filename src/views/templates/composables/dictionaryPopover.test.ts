import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/utils/index.js', () => ({
	handleError: vi.fn(),
}));

const WORD = {
	word_id: 1,
	hash: 'ba',
	simplified: '把',
	traditional: '把',
	pinyin_marks: 'ba3',
	english: ['handle'],
	measure_words: [],
};

beforeEach(() => {
	vi.mocked(invoke).mockReset();
	vi.mocked(invoke).mockResolvedValue([WORD]);
});

it('stores an anchor when lookup is opened from a dictionary link detail', async () => {
	const popover = createDictionaryPopover();
	const anchor = new DOMRect(10, 20, 30, 40);

	await popover.lookup({ text: '把', anchor });

	expect(invoke).toHaveBeenCalledWith('query_by_chinese', { text: '把' });
	expect(popover.word).toEqual(WORD);
	expect(popover.anchor).toBe(anchor);
});

it('clears the anchor when the popover closes', async () => {
	const popover = createDictionaryPopover();
	const anchor = new DOMRect(10, 20, 30, 40);

	await popover.lookup({ text: '把', anchor });
	popover.close();

	expect(popover.anchor).toBeUndefined();
});

it('uses a lexical ID directly when a cross-reference provides one', async () => {
	const popover = createDictionaryPopover();
	vi.mocked(invoke).mockResolvedValueOnce(WORD);

	await popover.lookup({ text: '把', lexicalId: '1:abc' });

	expect(invoke).toHaveBeenCalledWith('query_by_id', { id: '1:abc' });
	expect(popover.word).toEqual(WORD);
});

it('shows every Chinese match when a classifier reference has no lexical ID', async () => {
	const popover = createDictionaryPopover();
	const alternateReading = { ...WORD, hash: 'ba-alternate' };
	vi.mocked(invoke).mockResolvedValueOnce([WORD, alternateReading]);

	await popover.lookup({ text: '把' });

	expect(invoke).toHaveBeenCalledWith('query_by_chinese', { text: '把' });
	expect(popover.results).toEqual([WORD, alternateReading]);
});
