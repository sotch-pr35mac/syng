import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { frequencyTool, frequencyBreakdown, frequencyLevels } from '@/composables/tools.svelte.js';
import { telemetry } from '@/utils/telemetry.js';
import type { WordFrequencyResult } from '@/types/tools.js';
vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(async () => {}) },
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const result: WordFrequencyResult = {
	chinese_characters: 4,
	unmatched_characters: 0,
	entries: [
		{
			text: '学习',
			count: 2,
			tones: [2, 2],
			hsk: {
				hsk_2015: ['Two'],
				proficiency_standard_2021: ['Six', 'Two'],
				hsk_exam_syllabus_2025: [],
			},
		},
	],
};
beforeEach(() => {
	vi.mocked(invoke).mockReset();
	vi.mocked(telemetry.trackEvent).mockClear();
	frequencyTool.setInput('');
	frequencyTool.state.result = null;
});
it('keeps all memberships while counting each form once in the earliest bucket', () => {
	expect(frequencyLevels(result.entries[0], 'proficiency_standard_2021')).toEqual(['2', '6']);
	const rows = frequencyBreakdown(result.entries, 'proficiency_standard_2021');
	expect(rows.find((row) => row.level === '2')).toEqual({
		level: '2',
		distinct: 1,
		occurrences: 2,
	});
	expect(rows.reduce((total, row) => total + row.occurrences, 0)).toBe(2);
	expect(frequencyLevels(result.entries[0], 'none')).toEqual([]);
	expect(frequencyBreakdown(result.entries, 'hsk_exam_syllabus_2025').at(-1)?.occurrences).toBe(
		2
	);
});
it('ignores a response after input changes and retains the last analyzed snapshot', async () => {
	frequencyTool.setInput('学习学习');
	vi.mocked(invoke).mockResolvedValueOnce(result);
	await frequencyTool.analyze();
	expect(frequencyTool.state.result).toEqual(result);
	let finish!: (value: WordFrequencyResult) => void;
	vi.mocked(invoke).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve as typeof finish;
			})
	);
	const pending = frequencyTool.analyze();
	frequencyTool.setInput('你好');
	finish({ ...result, entries: [] });
	await pending;
	expect(frequencyTool.state.result).toEqual(result);
	expect(frequencyTool.state.analyzedInput).toBe('学习学习');
	expect(frequencyTool.state.busy).toBe(false);
	expect(telemetry.trackEvent).toHaveBeenCalledExactlyOnceWith('tools.completed', {
		tool: 'frequency',
		mode: 'automatic',
		input_length: 4,
	});
});
it('reports failure without leaking input and allows retry', async () => {
	frequencyTool.setInput('学习学习');
	vi.mocked(invoke).mockRejectedValueOnce(new Error('sensitive input'));
	await frequencyTool.analyze();
	expect(frequencyTool.state.error).toBe('Analysis failed. Please try again.');
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	vi.mocked(invoke).mockResolvedValueOnce(result);
	await frequencyTool.analyze();
	expect(frequencyTool.state.error).toBe('');
});

it('does not count empty input and keeps successful output when telemetry fails', async () => {
	await frequencyTool.analyze();
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	frequencyTool.setInput(' 学习🙂 ');
	vi.mocked(invoke).mockResolvedValueOnce(result);
	vi.mocked(telemetry.trackEvent).mockRejectedValueOnce(new Error('offline'));
	await frequencyTool.analyze();
	expect(frequencyTool.state.result).toEqual(result);
	expect(frequencyTool.state.error).toBe('');
	expect(telemetry.trackEvent).toHaveBeenCalledExactlyOnceWith('tools.completed', {
		tool: 'frequency',
		mode: 'automatic',
		input_length: 3,
	});
});
