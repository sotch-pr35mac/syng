import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import Search from '@/routes/Search.svelte';
import MobileSearch from '@/routes/mobile/MobileSearch.svelte';
import WalkthroughHost from '@/components/Walkthrough/WalkthroughHost.svelte';
import { searchStore } from '@/composables/search.svelte.js';
import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
import { mobileSearchSnapStore } from '@/stores/mobileSearch.svelte.js';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import { mockBookmarkManager, mockPreferenceManager } from '@test/utils/unitTestUtils.js';
import { setBookmarkManagerForTest, setPreferenceManagerForTest } from '@/utils/appServices.js';
import type { SearchEntry } from '@/types/search.js';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('@/utils/device.js', () => ({
	isMobileLayout: () => device.mobile,
	isMobile: () => device.mobile,
	isIPad: () => false,
	isAndroid: () => false,
}));
vi.mock('@/utils/telemetry.js', () => ({ telemetry: { trackEvent: async () => {} } }));

const word = {
	id: '1:learning',
	simplified: '学习',
	traditional: '學習',
	pinyin: { marks: 'xué xí', numbers: 'xue2 xi2', tones: [2, 2] },
	measure_words: [],
	alternative_pronunciations: [],
	english: [
		{
			gloss: { value: 'learn' },
			examples: [
				{
					value: {
						simplified: '学习中文。',
						traditional: '學習中文。',
						english: 'Learn Chinese.',
					},
				},
			],
			commentary: [],
			qualifiers: [],
			lexical_kinds: [],
			parts_of_speech: [],
			alternative_pronunciations: [],
			measure_words: [],
		},
	],
} as SearchEntry;

let popupBounds: DOMRect;

beforeEach(async () => {
	setPreferenceManagerForTest({
		...mockPreferenceManager({ walkthrough: createWalkthroughPreferences() }),
		waitForInit: async () => {},
	} as never);
	setBookmarkManagerForTest(mockBookmarkManager({ words: [], lists: ['Bookmarks'] }) as never);
	await tour.load();
	tour.interrupt();
	searchStore.doSearch('');
	searchStore.setActiveWord(undefined);
	searchStore.closePopoverDictionary();
	mobileSearchSnapStore.set('collapsed');
	window.location.hash = '#/';
	vi.mocked(invoke).mockImplementation(async (command) =>
		command === 'tokenize_reader_text' ? ['学习', '中文', '。'] : [word]
	);
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
		new DOMRect(40, 100, 240, 60),
	] as unknown as DOMRectList);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: HTMLElement
	) {
		if (
			this.matches('.sy-popover, .sy-snap-sheet[data-walkthrough-target="dictionary-popup"]')
		) {
			return popupBounds;
		}
		return this.matches('.dictionary-popover__body')
			? new DOMRect(310, 240, 400, 340)
			: new DOMRect(40, 100, 240, 60);
	});
});

afterEach(() => {
	cleanup();
	tour.interrupt();
	searchStore.cancelPendingTelemetry();
	vi.restoreAllMocks();
});

describe.each([
	{ layout: 'desktop', component: Search, mobile: false },
	{ layout: 'mobile', component: MobileSearch, mobile: true },
])('$layout dictionary walkthrough', ({ component, mobile }) => {
	it('scrolls to real examples, keeps their anchor, and highlights the open popup', async () => {
		device.mobile = mobile;
		popupBounds = mobile
			? new DOMRect(0, 340, window.innerWidth, 650)
			: new DOMRect(300, 200, 420, 380);
		render(component);
		await tour.start('dictionary');
		render(WalkthroughHost);
		const examples = document.querySelector<HTMLElement>(
			'[data-walkthrough-target="dictionary-examples"]'
		);
		const scrollIntoView = vi.fn();
		examples.scrollIntoView = scrollIntoView;
		while (tour.step.id !== 'links') {
			tour.next();
		}
		await waitFor(() =>
			expect(scrollIntoView).toHaveBeenCalledWith(
				expect.objectContaining({ block: 'center' })
			)
		);
		const link = (await screen.findAllByTestId('example-dictionary-link'))[0];
		expect(document.querySelector('.walkthrough__card').contains(link)).toBe(false);
		await fireEvent.click(link);
		await screen.findByRole('heading', { name: 'Explore the popup dictionary' });
		await waitFor(() => {
			expect(tour.phase).toBe('guiding');
			const popup = tour.target('dictionary-popup');
			expect(popup?.matches(mobile ? '.sy-snap-sheet' : '.sy-popover')).toBe(true);
			expect(popup?.getAttribute('aria-describedby')).toContain('walkthrough-description');
			const spotlight = document.querySelector<HTMLElement>('.walkthrough__spotlight');
			expect(spotlight?.style.left).toBe(mobile ? '0px' : '290px');
			expect(spotlight?.style.top).toBe(mobile ? '330px' : '190px');
			expect(spotlight?.style.width).toBe(mobile ? `${window.innerWidth}px` : '440px');
			expect(spotlight?.style.height).toBe(
				mobile ? `${window.innerHeight - 330}px` : '400px'
			);
		});
		const popup = tour.target('dictionary-popup');
		expect(
			popup.contains(
				screen.getByRole('button', { name: mobile ? 'Close' : 'Close dictionary' })
			)
		).toBe(true);
		if (mobile) {
			expect(popup.querySelector('.sy-snap-sheet__handle')).not.toBeNull();
		}
		// CSS transforms change visual bounds without notifying ResizeObserver.
		popupBounds = mobile
			? new DOMRect(0, 300, window.innerWidth, 650)
			: new DOMRect(280, 180, 460, 420);
		await fireEvent(
			popup,
			new Event(mobile ? 'transitionend' : 'animationend', { bubbles: true })
		);
		await waitFor(() => {
			const spotlight = document.querySelector<HTMLElement>('.walkthrough__spotlight');
			expect(spotlight?.style.top).toBe(mobile ? '290px' : '170px');
			expect(spotlight?.style.width).toBe(mobile ? `${window.innerWidth}px` : '480px');
			expect(spotlight?.style.height).toBe(
				mobile ? `${window.innerHeight - 290}px` : '440px'
			);
		});
		expect(link.isConnected).toBe(true);
		expect(searchStore.popoverAnchor).toEqual(link.getBoundingClientRect());
		await fireEvent.click(
			screen.getByRole('button', { name: mobile ? 'Close' : 'Close dictionary' })
		);
		await waitFor(() => expect(searchStore.popoverWord).toBeUndefined());
		expect(tour.step.id).toBe('links');
		await fireEvent.click(link);
		await screen.findByRole('heading', { name: 'Explore the popup dictionary' });
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await waitFor(() => expect(searchStore.popoverWord).toBeUndefined());
		expect(tour.phase).toBe('guiding');
		expect(tour.step.id).toBe('save');
	});
});
