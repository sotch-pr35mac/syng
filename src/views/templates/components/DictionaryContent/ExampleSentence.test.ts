import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import ExampleSentence from '@/components/DictionaryContent/ExampleSentence.svelte';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import { setPreferenceManagerForTest } from '@/utils/appServices.js';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

beforeEach(async () => {
	const preferences = {
		characterSet: 'both',
		colorCharactersByTone: true,
		colorPinyinByTone: false,
	};
	setPreferenceManagerForTest(mockPreferenceManager(preferences) as never);
	await dictionaryDisplaySettingsStore.loadSettings();
	vi.mocked(invoke).mockReset();
});

it('tokenizes Chinese words while leaving punctuation as ordinary text', async () => {
	vi.mocked(invoke).mockResolvedValue(['今天', '下雨', '。']);
	const onEvent = vi.fn();
	const { container, findAllByTestId } = render(ExampleSentence, {
		value: { simplified: '今天下雨。', traditional: '今天下雨。', english: 'It rains today.' },
		onevent: onEvent,
	});

	const links = await findAllByTestId('example-dictionary-link');
	expect(links).toHaveLength(2);
	expect(container.querySelectorAll('button')).toHaveLength(2);
	expect(container.textContent).toContain('It rains today.');
	expect(container.textContent).toContain('。');

	await fireEvent.click(links[0]);
	expect(onEvent).toHaveBeenCalledWith({ text: '今天', anchor: expect.any(Object) });
});

it('renders both labeled forms and their optional translation', async () => {
	vi.mocked(invoke).mockImplementation((_command, argumentsObject) => {
		const tokenizationArguments = argumentsObject as { text: string };
		return Promise.resolve([tokenizationArguments.text.slice(0, -1), '。']);
	});
	const { container, findAllByTestId, getAllByTestId, getByText } = render(ExampleSentence, {
		value: { simplified: '你好。', traditional: '您好。', english: 'Hello.' },
	});

	expect(getAllByTestId('character-set-label-simplified')).toHaveLength(1);
	expect(getAllByTestId('character-set-label-traditional')).toHaveLength(1);
	expect(getByText('Hello.')).toBeTruthy();
	await waitFor(async () => {
		expect(await findAllByTestId('example-dictionary-link')).toHaveLength(2);
	});
	expect(container.textContent).toContain('你好。');
	expect(container.textContent).toContain('您好。');
});

it('falls back to the available script when the preferred form is missing', async () => {
	dictionaryDisplaySettingsStore.setCharacterSet('simplified');
	vi.mocked(invoke).mockResolvedValue(['傳統', '。']);
	const { container, findAllByTestId, getByTestId, queryByTestId } = render(ExampleSentence, {
		value: { simplified: null, traditional: '傳統。', english: null },
	});

	expect(getByTestId('character-set-label-traditional')).toBeTruthy();
	expect(queryByTestId('character-set-label-simplified')).toBeNull();
	expect(await findAllByTestId('example-dictionary-link')).toHaveLength(1);
	expect(container.textContent).toContain('傳統。');
});

it('keeps the sentence visible when tokenization fails', async () => {
	vi.mocked(invoke).mockRejectedValue(new Error('tokenizer unavailable'));
	const { container } = render(ExampleSentence, {
		value: { simplified: '你好。', traditional: '你好。', english: null },
	});

	await waitFor(() => expect(container.textContent).toContain('你好。'));
	expect(container.querySelectorAll('button')).toHaveLength(0);
});
