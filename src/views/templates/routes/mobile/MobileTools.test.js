import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import MobileTools from '@/routes/mobile/MobileTools.svelte';
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

it('starts on the toolbox', () => {
	const { getByRole, queryByLabelText } = render(MobileTools);
	expect(getByRole('region', { name: 'Extras tools' })).toBeTruthy();
	expect(queryByLabelText('Pinyinify input')).toBeNull();
});

it('opens a tool and restores it after leaving Extras', async () => {
	const user = userEvent.setup();
	const { getByRole, unmount } = render(MobileTools);

	await user.click(getByRole('button', { name: 'Convert', exact: true }));
	expect(toolsSelectionStore.value).toBe('converter');
	unmount();

	const { getByRole: getByRoleAfterRemount } = render(MobileTools);
	expect(getByRoleAfterRemount('heading', { name: 'Convert' })).toBeTruthy();
});

it('runs pinyinify and renders output', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce(pinyinSegments);
	const { getByLabelText, getByRole, getByText } = render(MobileTools);
	await user.click(getByRole('button', { name: 'Pinyinify', exact: true }));

	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));

	expect(invoke).toHaveBeenCalledWith('pinyinify', { text: '你好' });
	await waitFor(() => expect(getByText('nǐ hǎo')).toBeTruthy());
});
