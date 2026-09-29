import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import ReaderWebpageImportModal from '@/components/Reader/ReaderWebpageImportModal.svelte';
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
	resetNetworkStatusForTest();
	setNavigatorOnline(true);
});

it('explains disabled webpage controls while offline and includes the touch fallback', () => {
	prepareOfflineStatus();
	const { container, getByRole, getByText } = render(ReaderWebpageImportModal, {
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
		container.querySelector('.reader-webpage-import__offline-status')?.textContent
	).toContain('You are offline. Connect to the internet to fetch a preview before importing.');
});

it('keeps a locally prepared preview importable after connectivity drops', async () => {
	prepareOnlineStatus();
	const { container, getByRole } = render(ReaderWebpageImportModal, { visible: true });
	const urlInput = container.querySelector('#reader-webpage-import-url');

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
		container.textContent?.includes(
			'You are offline. Fetch a preview while online before importing.'
		)
	).toBe(false);
	expect(
		container.querySelector('.reader-webpage-import__offline-status')?.textContent
	).toContain('You are offline. Connect to the internet to fetch a preview before importing.');
});
