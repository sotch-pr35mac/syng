import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import ReaderClipboardImportModal from '@/components/Reader/ReaderClipboardImportModal.svelte';
import ReaderDocumentImportModal from '@/components/Reader/ReaderDocumentImportModal.svelte';
import { handleError } from '@/utils/error.js';
import type { ReaderImportResult } from '@/types/reader.js';

vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it.each(['clipboard', 'file'] as const)(
	'preserves %s input after failure, releases busy state, and closes only on successful retry',
	async (source) => {
		const onclose = vi.fn();
		const onimport = vi.fn<() => Promise<ReaderImportResult>>();
		onimport.mockResolvedValueOnce({
			status: 'error',
			message: 'Could not save the document.',
		});
		onimport.mockResolvedValueOnce({ status: 'success' });
		const rendered =
			source === 'clipboard'
				? render(ReaderClipboardImportModal, { visible: true, onclose, onimport })
				: render(ReaderDocumentImportModal, {
						visible: true,
						initialTitle: 'Original title',
						onclose,
						onimport,
					});
		const { baseElement, getByRole, getByText } = rendered;
		if (source === 'clipboard') {
			await fireEvent.input(getByRole('textbox', { name: 'Text' }), {
				target: { value: '你好\nA pasted passage.' },
			});
		}
		const titleInput = baseElement.querySelector('input[id$="-title"]') as HTMLInputElement;
		await fireEvent.input(titleInput, { target: { value: 'My edited title' } });
		await fireEvent.click(getByRole('button', { name: 'Use Blue document color' }));
		await fireEvent.click(getByRole('button', { name: 'Import' }));

		await waitFor(() => expect(getByText('Could not save the document.')).toBeTruthy());
		expect(onclose).not.toHaveBeenCalled();
		expect(titleInput.value).toBe('My edited title');
		expect(
			getByRole('button', { name: 'Use Blue document color' }).getAttribute('aria-pressed')
		).toBe('true');
		expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false);
		if (source === 'clipboard') {
			expect((getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement).value).toBe(
				'你好\nA pasted passage.'
			);
		}

		await fireEvent.click(getByRole('button', { name: 'Import' }));
		await waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
		expect(onimport.mock.calls[1]).toEqual(onimport.mock.calls[0]);
	}
);

it('keeps clipboard input retryable after an unexpected rejection without a global alert', async () => {
	const failure = new Error('Unexpected storage rejection');
	const onimport = vi.fn().mockRejectedValueOnce(failure);
	const onclose = vi.fn();
	const { getByRole, getByText } = render(ReaderClipboardImportModal, {
		visible: true,
		onimport,
		onclose,
	});
	await fireEvent.input(getByRole('textbox', { name: 'Text' }), {
		target: { value: 'Keep this text' },
	});
	await fireEvent.click(getByRole('button', { name: 'Import' }));
	await waitFor(() =>
		expect(getByText('There was an error importing the reader document.')).toBeTruthy()
	);
	expect(onclose).not.toHaveBeenCalled();
	expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false);
	expect(handleError).toHaveBeenCalledWith(expect.any(String), failure, { silent: true });
});

it('discards clipboard input on explicit Cancel', async () => {
	const onclose = vi.fn();
	const { getByRole } = render(ReaderClipboardImportModal, { visible: true, onclose });
	await fireEvent.input(getByRole('textbox', { name: 'Text' }), {
		target: { value: 'Discard this text' },
	});
	await fireEvent.click(getByRole('button', { name: 'Cancel' }));
	expect(onclose).toHaveBeenCalledTimes(1);
	expect((getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement).value).toBe('');
	expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true);
});
