import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import Tools from '@/routes/Tools.svelte';
import { resetToolsStoreForTest } from '@/composables/tools.svelte.js';
import { toolsSelectionStore } from '@/stores/tools.svelte.js';

const THIRD_TONE = 3;

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		ChevronDown: mockIcon,
		ChevronLeft: mockIcon,
		ChevronUp: mockIcon,
		Copy: mockIcon,
		Info: mockIcon,
		Play: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
}));

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(async () => {}) },
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

const pinyinSegments = [
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
			hsk: { hsk_2015: ['One'], proficiency_standard_2021: [], hsk_exam_syllabus_2025: [] },
			word_id: 1,
		},
	},
];

beforeEach(() => {
	resetToolsStoreForTest();
	toolsSelectionStore.set(null);
	vi.mocked(invoke).mockReset();
});

it('starts on the toolbox without a selected tool', () => {
	const { getByRole, queryByLabelText } = render(Tools);
	expect(getByRole('heading', { name: 'Extras' })).toBeTruthy();
	expect(getByRole('region', { name: 'Extras tools' })).toBeTruthy();
	expect(queryByLabelText('Pinyinify input')).toBeNull();
});

it('switches tools and runs conversion', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce({
		text: '繁體字',
		direction: 'to_traditional',
		detected_script: 'simplified',
	});
	const { getByRole, getByLabelText, getByText } = render(Tools);

	await user.click(getByRole('button', { name: 'Convert', exact: true }));
	await fireEvent.input(getByLabelText('Converter input'), { target: { value: '繁体字' } });
	await user.click(getByRole('button', { name: 'To Traditional' }));
	await user.click(getByRole('button', { name: /Process/ }));

	expect(invoke).toHaveBeenCalledWith('convert_characters', {
		text: '繁体字',
		direction: 'to_traditional',
	});
	await waitFor(() => expect(getByText('繁體字')).toBeTruthy());
});

it('shows automatic conversion decisions', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce({
		text: '繁体字',
		direction: 'to_simplified',
		detected_script: 'traditional',
	});
	const { getByRole, getByLabelText, getByText } = render(Tools);

	await user.click(getByRole('button', { name: 'Convert', exact: true }));
	await fireEvent.input(getByLabelText('Converter input'), { target: { value: '繁體字' } });
	await user.click(getByRole('button', { name: /Process/ }));

	await waitFor(() => expect(getByText('Automatic: Traditional -> Simplified')).toBeTruthy());
});

it('renders pinyinify output from the native command', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce(pinyinSegments);
	const { getByLabelText, getByRole, getByText } = render(Tools);
	await user.click(getByRole('button', { name: 'Pinyinify', exact: true }));

	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));

	await waitFor(() => expect(getByText('nǐ hǎo')).toBeTruthy());
});

it('opens tools by keyboard, restores focus, and preserves input and controls', async () => {
	const user = userEvent.setup();
	const { getByRole, getByLabelText } = render(Tools);
	getByRole('button', { name: 'Pinyinify', exact: true }).focus();
	await user.keyboard('{Tab}{Enter}');
	expect(document.activeElement).toBe(getByRole('heading', { name: 'Convert' }));
	await user.click(getByRole('button', { name: 'To Traditional', pressed: false }));
	await fireEvent.input(getByLabelText('Converter input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: 'Collapse Convert input', expanded: true }));
	await user.click(getByRole('button', { name: 'All tools' }));
	expect(document.activeElement).toBe(getByRole('button', { name: 'Convert', exact: true }));
	await user.keyboard('{Enter}');
	await user.click(getByRole('button', { name: 'Expand Convert input', expanded: false }));
	expect(getByRole('button', { name: 'To Traditional', pressed: true })).toBeTruthy();
	expect(getByLabelText('Converter input').value).toBe('你好');
});

it('announces processing and completion without making all output a live region', async () => {
	let finish;
	vi.mocked(invoke).mockReturnValueOnce(
		new Promise((resolve) => {
			finish = resolve;
		})
	);
	const user = userEvent.setup();
	const { getByRole, getByLabelText } = render(Tools);
	await user.click(getByRole('button', { name: 'Pinyinify', exact: true }));
	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));
	expect(getByRole('status').textContent).toContain('Processing');
	await user.click(getByRole('button', { name: 'All tools' }));
	finish(pinyinSegments);
	await user.click(getByRole('button', { name: 'Pinyinify', exact: true }));
	await waitFor(() => expect(getByRole('status').textContent).toContain('Output ready'));
	expect(getByRole('region', { name: 'Pinyinify output' }).getAttribute('aria-live')).toBeNull();
	expect(getByRole('button', { name: 'Copy pinyinify output' })).toBeTruthy();
});
