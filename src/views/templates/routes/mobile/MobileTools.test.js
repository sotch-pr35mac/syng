import { beforeEach, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import MobileTools from '@/routes/mobile/MobileTools.svelte';
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
			hsk: 1,
			word_id: 1,
		},
	},
];

beforeEach(() => {
	resetToolsStoreForTest();
	toolsActiveTabStore.set('pinyinify');
	vi.mocked(invoke).mockReset();
});

it('renders with the default pinyinify tab', () => {
	const { getByRole, getByLabelText } = render(MobileTools);

	expect(getByRole('heading', { name: 'Pinyinify' })).toBeTruthy();
	expect(getByLabelText('Pinyinify input')).toBeTruthy();
});

it('switches tabs and persists the active tab state', async () => {
	const user = userEvent.setup();
	const { getByRole, unmount } = render(MobileTools);

	await user.click(getByRole('button', { name: 'Convert' }));
	expect(toolsActiveTabStore.value).toBe('converter');
	unmount();

	const { getByRole: getByRoleAfterRemount } = render(MobileTools);
	expect(getByRoleAfterRemount('heading', { name: 'Convert' })).toBeTruthy();
});

it('runs pinyinify and renders output', async () => {
	const user = userEvent.setup();
	vi.mocked(invoke).mockResolvedValueOnce(pinyinSegments);
	const { getByLabelText, getByRole, getByText } = render(MobileTools);

	await fireEvent.input(getByLabelText('Pinyinify input'), { target: { value: '你好' } });
	await user.click(getByRole('button', { name: /Process/ }));

	expect(invoke).toHaveBeenCalledWith('pinyinify', { text: '你好' });
	await waitFor(() => expect(getByText('nǐ hǎo')).toBeTruthy());
});
