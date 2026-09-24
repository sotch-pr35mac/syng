import { beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import {
	resetToolsStoreForTest,
	segmentsToCharacterText,
	segmentsToPinyinText,
	toolsStore,
} from '@/composables/tools.svelte.js';
import type { PinyinSegment } from '@/types/tools.js';
import { telemetry } from '@/utils/telemetry.js';
import { toolsRoute } from '@/composables/toolsRoute.svelte.js';
import { toolsActiveTabStore } from '@/stores/tools.svelte.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));

const THIRD_TONE = 3;

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/utils/error.js', () => ({
	handleError: vi.fn(),
}));

const segments: PinyinSegment[] = [
	{ source: 'Hello', lexical_unit: null },
	{
		source: '你好',
		lexical_unit: {
			id: '1:0000000000000000000000000000000000000000000000000000000000000000',
			traditional: '你好',
			simplified: '你好',
			pinyin: { marks: 'nǐ hǎo', numbers: 'ni3hao3', tones: [THIRD_TONE, THIRD_TONE] },
			commonness: 0,
			alternative_pronunciations: [],
			english: [],
			measure_words: [],
			hsk: { hsk_2015: ['One'], proficiency_standard_2021: [], hsk_exam_syllabus_2025: [] },
		},
	},
	{ source: 'world', lexical_unit: null },
];

beforeEach(() => {
	vi.mocked(telemetry.trackEvent).mockClear();
	resetToolsStoreForTest();
	vi.mocked(invoke).mockReset();
});

it('captures operation inputs before asynchronous completion and excludes input text', async () => {
	let finish!: (value: unknown) => void;
	vi.mocked(invoke).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	toolsStore.setConverterInput('你好');
	toolsStore.setConverterDirection('to_traditional');
	toolsStore.doConvert();
	toolsStore.setConverterInput('private replacement');
	toolsStore.setConverterDirection('to_simplified');
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	finish({ text: '你好', direction: 'to_traditional', detected_script: 'simplified' });
	await waitFor(() =>
		expect(telemetry.trackEvent).toHaveBeenCalledExactlyOnceWith('tools.completed', {
			tool: 'converter',
			mode: 'to_traditional',
			input_length: 2,
		})
	);
});

it('does not record failed operations or failed copies as successful', async () => {
	vi.mocked(invoke).mockRejectedValueOnce(new Error('failed'));
	toolsStore.setPinyinifyInput('你好');
	toolsStore.doPinyinify();
	await Promise.resolve();
	await Promise.resolve();
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
	});
	await toolsRoute.copyText('private result');
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
	toolsActiveTabStore.set('pinyinify');
	await toolsRoute.copyText('private result');
	expect(telemetry.trackEvent).toHaveBeenCalledExactlyOnceWith('tools.copied', {
		tool: 'pinyinify',
	});
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
	const rawPinyinSegments = [{ source: 'ni3 hao3', lexical_unit: null }];
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
