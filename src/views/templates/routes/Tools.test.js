import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import Tools from '@/routes/Tools.svelte';
import { resetToolsStoreForTest } from '@/composables/tools.svelte.js';
import { toolsActiveTabStore } from '@/stores/tools.svelte.js';

const THIRD_TONE = 3;

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('@/components/__mocks__/FeatherIcon.svelte')).default;
	return {
		ChevronDown: mockIcon,
		ChevronRight: mockIcon,
		Copy: mockIcon,
		Info: mockIcon,
		Play: mockIcon,
		X: mockIcon,
	};
});

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: () => 'macos',
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
	toolsActiveTabStore.set('pinyinify');
	vi.mocked(invoke).mockReset();
});

it('renders the default pinyinify tool', () => {
	const { getByRole, getByLabelText } = render(Tools);

	expect(getByRole('heading', { name: 'Extras' })).toBeTruthy();
	expect(getByRole('heading', { name: 'Pinyinify' })).toBeTruthy();
	expect(getByLabelText('Pinyinify input')).toBeTruthy();
});

it('switches tools and runs conversion', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce({
		text: '繁體字',
		direction: 'to_traditional',
		detected_script: 'simplified',
	});
	const { getByRole, getByLabelText, getByText } = render(Tools);

	await user.click(getByRole('tab', { name: 'Convert' }));
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

	await user.click(getByRole('tab', { name: 'Convert' }));
	await fireEvent.input(getByLabelText('Converter input'), { target: { value: '繁體字' } });
	await user.click(getByRole('button', { name: /Process/ }));

	await waitFor(() => expect(getByText('Automatic: Traditional -> Simplified')).toBeTruthy());
});

it('renders pinyinify output from the native command', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce(pinyinSegments);
	const { getByLabelText, getByRole, getByText } = render(Tools);

	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));

	await waitFor(() => expect(getByText('nǐ hǎo')).toBeTruthy());
});

it('navigates tabs by keyboard and exposes selected conversion options', async () => {
	const user = userEvent.setup();
	const { getByRole } = render(Tools);
	getByRole('tab', { name: 'Pinyinify' }).focus();
	await user.keyboard('{ArrowRight}');
	expect(document.activeElement).toBe(getByRole('tab', { name: 'Convert', selected: true }));
	expect(getByRole('tabpanel', { name: 'Convert' })).toBeTruthy();
	const traditional = getByRole('button', { name: 'To Traditional', pressed: false });
	await user.click(traditional);
	expect(getByRole('button', { name: 'To Traditional', pressed: true })).toBe(traditional);
	const collapse = getByRole('button', { name: 'Collapse Convert input', expanded: true });
	await user.click(collapse);
	expect(getByRole('button', { name: 'Expand Convert input', expanded: false })).toBeTruthy();
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
	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));
	expect(getByRole('status').textContent).toContain('Processing');
	finish(pinyinSegments);
	await waitFor(() => expect(getByRole('status').textContent).toContain('Output ready'));
	expect(getByRole('region', { name: 'Pinyinify output' }).getAttribute('aria-live')).toBeNull();
	expect(getByRole('button', { name: 'Copy pinyinify output' })).toBeTruthy();
});
