import { beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import {
	resetToolsStoreForTest,
	segmentsToCharacterText,
	segmentsToPinyinText,
	toolsStore,
} from '@/composables/tools.svelte.js';

const THIRD_TONE = 3;

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

const segments = [
	{ source: 'Hello', word_data: null },
	{
		source: '你好',
		word_data: {
			traditional: '你好',
			simplified: '你好',
			pinyin_marks: 'nǐ hǎo',
			pinyin_numbers: 'ni3 hao3',
			tone_marks: [THIRD_TONE, THIRD_TONE],
			english: ['hello'],
			hash: 1,
			hsk: 1,
			word_id: 1,
		},
	},
	{ source: 'world', word_data: null },
];

beforeEach(() => {
	resetToolsStoreForTest();
	vi.mocked(invoke).mockReset();
});

it('runs pinyinify and stores the returned segments', async () => {
	vi.mocked(invoke).mockResolvedValueOnce(segments);
	toolsStore.setPinyinifyInput('Hello你好world');

	toolsStore.doPinyinify();

	expect(invoke).toHaveBeenCalledWith('pinyinify', { text: 'Hello你好world' });
	await waitFor(() => expect(toolsStore.pinyinifyResult).toEqual(segments));
});

it('runs character conversion with the selected direction', async () => {
	vi.mocked(invoke).mockResolvedValueOnce({
		text: '繁體字',
		direction: 'to_traditional',
		detected_script: 'simplified',
	});
	toolsStore.setConverterInput('繁体字');
	toolsStore.setConverterDirection('to_traditional');

	toolsStore.doConvert();

	expect(invoke).toHaveBeenCalledWith('convert_characters', {
		text: '繁体字',
		direction: 'to_traditional',
	});
	await waitFor(() => expect(toolsStore.converterResult).toBe('繁體字'));
});

it('runs automatic character conversion and stores the decision', async () => {
	vi.mocked(invoke).mockResolvedValueOnce({
		text: '繁体字',
		direction: 'to_simplified',
		detected_script: 'traditional',
	});
	toolsStore.setConverterInput('繁體字');

	toolsStore.doConvert();

	expect(invoke).toHaveBeenCalledWith('convert_characters', {
		text: '繁體字',
		direction: 'automatic',
	});
	await waitFor(() =>
		expect(toolsStore.converterDecision).toBe('Automatic: Traditional -> Simplified')
	);
});

it('colorizes raw pinyin automatically with native pinyin tokens', async () => {
	const rawPinyinSegments = [{ source: 'ni3 hao3', word_data: null }];
	const rawPinyinTokens = [
		{ text: 'ni3', tone: THIRD_TONE },
		{ text: ' ', tone: null },
		{ text: 'hao3', tone: THIRD_TONE },
	];
	vi.mocked(invoke)
		.mockResolvedValueOnce(rawPinyinSegments)
		.mockResolvedValueOnce(rawPinyinTokens);
	toolsStore.setColorizeInput('ni3 hao3');

	toolsStore.doColorize();

	expect(invoke).toHaveBeenNthCalledWith(1, 'pinyinify', { text: 'ni3 hao3' });
	await waitFor(() =>
		expect(invoke).toHaveBeenNthCalledWith(2, 'tokenize_pinyin', { text: 'ni3 hao3' })
	);
	await waitFor(() => expect(toolsStore.colorizeTokens).toEqual(rawPinyinTokens));
	expect(toolsStore.colorizeDecision).toBe('Automatic: pinyin');
});

it('runs automatic pinyin prettify and stores the decision', async () => {
	vi.mocked(invoke).mockResolvedValueOnce({
		text: 'nǐ hǎo',
		direction: 'to_marks',
		detected_style: 'numbers',
	});
	toolsStore.setPrettifyInput('ni3 hao3');

	toolsStore.doPrettify();

	expect(invoke).toHaveBeenCalledWith('prettify_pinyin', {
		text: 'ni3 hao3',
		direction: 'automatic',
	});
	await waitFor(() =>
		expect(toolsStore.prettifyDecision).toBe('Automatic: tone numbers -> tone marks')
	);
});

it('formats segment results for copy output', () => {
	expect(segmentsToPinyinText(segments)).toBe('Hellonǐ hǎoworld');
	expect(segmentsToCharacterText(segments, 'simplified')).toBe('Hello你好world');
});
