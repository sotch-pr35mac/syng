import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import ReaderWebpageImportModal from '@/components/Reader/ReaderWebpageImportModal.svelte';
import type { ReaderImportPayload, ReaderImportResult } from '@/types/reader.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import { LARGE_HTML_IMPORT_ERROR_CODE, READER_DOCUMENT_COLORS } from '@/utils/readerDocument.js';
import {
	initializeNetworkStatus,
	resetNetworkStatusForTest,
} from '@/utils/networkStatus.svelte.js';

const mocks = vi.hoisted(() => ({
	ask: vi.fn(),
	invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: mocks.ask }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));

function setNavigatorOnline(online: boolean): void {
	Object.defineProperty(window.navigator, 'onLine', {
		configurable: true,
		value: online,
	});
}

function prepareOnlineStatus(): void {
	setNavigatorOnline(true);
	initializeNetworkStatus();
}

function prepareOfflineStatus(): void {
	setNavigatorOnline(false);
	initializeNetworkStatus();
}

beforeEach(() => {
	resetNetworkStatusForTest();
	mocks.ask.mockReset();
	mocks.invoke.mockReset();
	mocks.invoke.mockResolvedValue({
		title: 'Prepared article',
		text: 'A locally prepared webpage preview.',
		file_name: 'prepared-article.html',
		source_type: 'webpage',
		mime_type: 'text/html',
		extractor_version: 1,
		canonical_schema_version: 1,
		blocks: [],
		color: '#ffffff',
	});
});

afterEach(() => {
	cleanup();
	resetNetworkStatusForTest();
	setNavigatorOnline(true);
});

it('preserves webpage details and a prepared preview after a failed save, including offline retry', async () => {
	prepareOnlineStatus();
	const onclose = vi.fn();
	const onimport = vi.fn<() => Promise<ReaderImportResult>>();
	onimport.mockResolvedValueOnce({ status: 'error', message: 'Could not save this webpage.' });
	onimport.mockResolvedValueOnce({ status: 'success' });
	const { baseElement, getByRole, getByText } = render(ReaderWebpageImportModal, {
		visible: true,
		onclose,
		onimport,
	});
	const urlInput = baseElement.querySelector('#reader-webpage-import-url') as HTMLInputElement;
	const titleInput = baseElement.querySelector(
		'#reader-webpage-import-title'
	) as HTMLInputElement;
	await fireEvent.input(urlInput, { target: { value: 'https://example.com/article' } });
	await fireEvent.click(getByRole('button', { name: 'Fetch Preview' }));
	await waitFor(() => expect(getByText('A locally prepared webpage preview.')).toBeTruthy());
	await fireEvent.input(titleInput, { target: { value: 'My article' } });
	const selectedColor = READER_DOCUMENT_COLORS[1];
	await fireEvent.click(getByRole('button', { name: 'Use Blue document color' }));
	await fireEvent.click(getByRole('button', { name: 'Import' }));

	await waitFor(() =>
		expect(getByRole('alert').textContent).toContain('Could not save this webpage.')
	);
	expect(onclose).not.toHaveBeenCalled();
	expect(urlInput.value).toBe('https://example.com/article');
	expect(titleInput.value).toBe('My article');
	expect(getByText('A locally prepared webpage preview.')).toBeTruthy();
	expect(
		getByRole('button', { name: 'Use Blue document color' }).getAttribute('aria-pressed')
	).toBe('true');
	setNavigatorOnline(false);
	window.dispatchEvent(new Event('offline'));
	await fireEvent.click(getByRole('button', { name: 'Import' }));
	await waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
	expect(onimport.mock.calls[1]).toEqual(onimport.mock.calls[0]);
	expect(onimport).toHaveBeenLastCalledWith(
		'My article',
		'https://example.com/article',
		selectedColor,
		expect.objectContaining({ title: 'Prepared article' })
	);
	expect(
		mocks.invoke.mock.calls.filter(
			([command]) => command === NATIVE_COMMANDS.READER.PREPARE_IMPORT
		)
	).toHaveLength(1);
});

it('preserves the form after a cancelled import and allows retry', async () => {
	prepareOnlineStatus();
	const onclose = vi.fn();
	const onimport = vi.fn().mockResolvedValue({ status: 'cancelled' });
	const { baseElement, getByRole } = render(ReaderWebpageImportModal, {
		visible: true,
		onclose,
		onimport,
	});
	const urlInput = baseElement.querySelector('#reader-webpage-import-url') as HTMLInputElement;
	await fireEvent.input(urlInput, { target: { value: 'https://example.com/large' } });
	await fireEvent.click(getByRole('button', { name: 'Import' }));
	await waitFor(() => expect(getByRole('button', { name: 'Import' })).toBeTruthy());
	expect(onimport).toHaveBeenCalledTimes(1);
	expect(onclose).not.toHaveBeenCalled();
	expect(urlInput.value).toBe('https://example.com/large');
	expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false);
});

it('keeps a valid preview and entered details when a refreshed large-page preview is declined', async () => {
	prepareOnlineStatus();
	const { baseElement, getByRole, getByText } = render(ReaderWebpageImportModal, {
		visible: true,
	});
	const urlInput = baseElement.querySelector('#reader-webpage-import-url') as HTMLInputElement;
	await fireEvent.input(urlInput, { target: { value: 'https://example.com/large' } });
	await fireEvent.click(getByRole('button', { name: 'Fetch Preview' }));
	await waitFor(() => expect(getByText('A locally prepared webpage preview.')).toBeTruthy());
	mocks.invoke.mockRejectedValueOnce(
		JSON.stringify({ code: LARGE_HTML_IMPORT_ERROR_CODE, receivedBytes: 2097152 })
	);
	mocks.ask.mockResolvedValueOnce(false);
	await fireEvent.click(getByRole('button', { name: 'Fetch Preview' }));
	await waitFor(() => expect(mocks.ask).toHaveBeenCalledTimes(1));
	expect(urlInput.value).toBe('https://example.com/large');
	expect(getByText('A locally prepared webpage preview.')).toBeTruthy();
	await waitFor(() =>
		expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false)
	);
});

it('discards a pending preview when the user cancels the form', async () => {
	prepareOnlineStatus();
	let resolvePreview: (payload: ReaderImportPayload) => void;
	const payload = await mocks.invoke();
	mocks.invoke.mockImplementationOnce(
		() => new Promise<ReaderImportPayload>((resolve) => (resolvePreview = resolve))
	);
	const onclose = vi.fn();
	const { baseElement, getByRole, queryByText } = render(ReaderWebpageImportModal, {
		visible: true,
		onclose,
	});
	const urlInput = baseElement.querySelector('#reader-webpage-import-url') as HTMLInputElement;
	await fireEvent.input(urlInput, { target: { value: 'https://example.com/article' } });
	await fireEvent.click(getByRole('button', { name: 'Fetch Preview' }));
	await fireEvent.click(getByRole('button', { name: 'Cancel' }));
	resolvePreview(payload);
	await waitFor(() => expect(getByRole('button', { name: 'Fetch Preview' })).toBeTruthy());
	expect(onclose).toHaveBeenCalledTimes(1);
	expect(urlInput.value).toBe('');
	expect(queryByText('A locally prepared webpage preview.')).toBeNull();
	expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true);
});

it('explains disabled webpage controls while offline and includes the touch fallback', () => {
	prepareOfflineStatus();
	const { baseElement, getByRole, getByText } = render(ReaderWebpageImportModal, {
		visible: true,
	});
	const fetchButton = getByRole('button', { name: 'Fetch Preview' });
	const importButton = getByRole('button', { name: 'Import' });
	const fetchTooltip = getByText('You are offline. Connect to the internet to fetch a preview.');
	const importTooltip = getByText(
		'You are offline. Fetch a preview while online before importing.'
	);

	expect(fetchButton.hasAttribute('disabled')).toBe(true);
	expect(importButton.hasAttribute('disabled')).toBe(true);
	expect(fetchTooltip.closest('.sy-tooltip--body-top')).toBeTruthy();
	expect(importTooltip.closest('.sy-tooltip--body-top')).toBeTruthy();
	expect(
		baseElement.querySelector('.reader-webpage-import__offline-status')?.textContent
	).toContain('You are offline. Connect to the internet to fetch a preview before importing.');
});

it('keeps a locally prepared preview importable after connectivity drops', async () => {
	prepareOnlineStatus();
	const { baseElement, getByRole } = render(ReaderWebpageImportModal, { visible: true });
	const urlInput = baseElement.querySelector('#reader-webpage-import-url');

	if (!(urlInput instanceof HTMLInputElement)) {
		throw new Error('Expected webpage URL input.');
	}

	await fireEvent.input(urlInput, { target: { value: 'https://example.com/article' } });
	await fireEvent.click(getByRole('button', { name: 'Fetch Preview' }));

	await waitFor(() =>
		expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false)
	);

	setNavigatorOnline(false);
	window.dispatchEvent(new Event('offline'));

	await waitFor(() =>
		expect(getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(false)
	);
	expect(
		baseElement.textContent?.includes(
			'You are offline. Fetch a preview while online before importing.'
		)
	).toBe(false);
	expect(
		baseElement.querySelector('.reader-webpage-import__offline-status')?.textContent
	).toContain('You are offline. Connect to the internet to fetch a preview before importing.');
});
