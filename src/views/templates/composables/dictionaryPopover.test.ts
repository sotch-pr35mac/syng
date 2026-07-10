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
