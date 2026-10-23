import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Library from '@/routes/Reader/Library.svelte';
import Document from '@/routes/Reader/Document.svelte';
import MobileReader from '@/routes/mobile/Reader/MobileReader.svelte';
import MobileReaderDocument from '@/routes/mobile/Reader/MobileReaderDocument.svelte';
import WalkthroughHost from '@/components/Walkthrough/WalkthroughHost.svelte';
import { readerRoute } from '@/composables/reader.svelte.js';
import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import {
	setBookmarkManagerForTest,
	setPreferenceManagerForTest,
	setReaderDocumentManagerForTest,
} from '@/utils/appServices.js';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => ['你好', '世界']) }));
vi.mock('@/utils/telemetry.js', () => ({ telemetry: { trackEvent: async () => {} } }));

const document = {
	_id: 'reader-1',
	canonical_schema_version: 1,
	title: 'Story',
	file_name: 'story.txt',
	source_type: 'plain_text',
	mime_type: 'text/plain',
	extractor_version: 1,
	color: '#ffffff',
	text: '你好世界',
	blocks: [
		{ id: 'block-1', kind: 'paragraph', text: '你好世界', start_offset: 0, end_offset: 4 },
	],
	imported_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z',
	reading_order: [{ href: 'text', type: 'text/plain', title: 'Story' }],
	progress: {
		resource_href: 'text',
		position: 0,
		total_progression: 0,
		page_index: 0,
		text_position: { start: 0, end: 0 },
		text_quote: { exact: '', prefix: '', suffix: '' },
		updated_at: '2026-01-01T00:00:00.000Z',
	},
};
let documents: (typeof document)[];

beforeEach(async () => {
	documents = [document];
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener() {},
		removeEventListener() {},
	}));
	vi.spyOn(readerRoute, 'setPageLayout').mockResolvedValue(undefined);
	setPreferenceManagerForTest({
		...mockPreferenceManager({ walkthrough: createWalkthroughPreferences() }),
		waitForInit: async () => {},
	} as never);
	setBookmarkManagerForTest(mockBookmarkManager({ words: [], lists: ['Bookmarks'] }) as never);
	setReaderDocumentManagerForTest({
		waitForInit: async () => {},
		getDocuments: async () => documents,
		getDocument: async () => document,
		updateProgress: async () => document,
		getSourceHtml: async () => undefined,
	} as never);
	await tour.load();
	Object.assign(tour.preferences, createWalkthroughPreferences(), { featureInvitations: {} });
});

afterEach(() => {
	cleanup();
	tour.interrupt();
	readerRoute.backToLibrary();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe.each([
	{
		layout: 'desktop library',
		renderRoute: () => render(Library),
	},
	{
		layout: 'mobile library',
		renderRoute: () => render(MobileReader),
	},
])('$layout help', ({ renderRoute }) => {
	it.each([false, true])(
		'keeps help in the empty state without an automatic invitation (populated: %s)',
		async (populated) => {
			documents = populated ? [document] : [];
			await readerRoute.refresh();
			window.location.hash = '#/read';
			renderRoute();
			if (populated) {
				await screen.findByText('Story');
			} else {
				await screen.findByRole('button', { name: 'Learn how Reader works' });
			}
			await tick();
			expect(tour.visible).toBe(false);
			if (populated) {
				expect(screen.queryByRole('button', { name: 'Learn how Reader works' })).toBeNull();
			} else {
				await fireEvent.click(
					screen.getByRole('button', { name: 'Learn how Reader works' })
				);
				await waitFor(() => expect(tour.phase).toBe('guiding'));
				expect(tour.guide).toBe('reader-library');
			}
		}
	);
});

describe.each([
	{
		layout: 'desktop document',
		renderRoute: () => render(Document, { params: { id: 'reader-1' } }),
		guide: 'reader-document' as const,
	},
	{
		layout: 'mobile document',
		renderRoute: () => render(MobileReaderDocument, { params: { id: 'reader-1' } }),
		guide: 'reader-document' as const,
	},
])('$layout invitation', ({ renderRoute, guide }) => {
	it.each(['accept', 'decline'])(
		'remembers %s and offers the guide for the current Reader screen',
		async (choice) => {
			window.location.hash = '#/read/document/reader-1';
			const view = renderRoute();
			await waitFor(() => expect(tour.phase).toBe('feature-invitation'));
			expect(tour.guide).toBe(guide);
			const host = render(WalkthroughHost);
			await fireEvent.click(
				screen.getByRole('button', { name: choice === 'accept' ? 'Start tour' : 'Not now' })
			);
			if (choice === 'accept') {
				await waitFor(() => expect(tour.phase).toBe('guiding'));
				expect(tour.preparation.context).toEqual({ documentId: 'reader-1' });
				tour.skip();
			}
			expect(tour.preferences.featureInvitations[guide]).toBe(true);
			host.unmount();
			view.unmount();
			renderRoute();
			await tick();
			expect(tour.visible).toBe(false);
		}
	);

	it('does not interrupt a user who has already completed this guide', async () => {
		tour.preferences.guides[guide] = { status: 'completed', completed: true, context: {} };
		window.location.hash = '#/read/document/reader-1';
		renderRoute();
		await screen.findByText('Story');
		await tick();
		expect(tour.visible).toBe(false);
	});
});
