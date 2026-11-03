import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { overlayFocus } from '@/actions/overlayFocus.js';
import Flashcards from '@/routes/Study/Flashcards.svelte';
import MobileStudyFlashcards from '@/routes/mobile/Study/MobileStudyFlashcards.svelte';
import { bookmarksStore, type BookmarkWordEntry } from '@/stores/bookmarks.svelte.js';
import {
	flashcardsActiveIndexStore,
	flashcardsActiveListStore,
	flashcardsShowDetailsStore,
} from '@/stores/flashcards.svelte.js';
import { flashcardsRoute } from '@/composables/flashcards.svelte.js';

vi.mock('@tauri-apps/plugin-os', () => ({ platform: () => 'macos' }));
vi.mock('svelte-spa-router', () => ({
	router: {
		get location() {
			return window.location.hash.slice(1).split('?')[0];
		},
		get querystring() {
			return window.location.hash.split('?')[1] ?? '';
		},
	},
}));
vi.mock('@/utils/index.js', () => ({
	handleError: vi.fn(),
	telemetry: { trackEvent: vi.fn(() => Promise.resolve()) },
}));
vi.mock('@/stores/bookmarks.svelte.js', () => ({
	bookmarksStore: { getContent: vi.fn(), lists: ['Week 3'], initialized: true },
}));
vi.mock('@/components/DictionaryContent/DictionaryContent.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));
vi.mock('@/components/DictionaryPopover/DictionaryPopover.svelte', async () => ({
	default: (await import('@/components/__mocks__/RouteMock.svelte')).default,
}));

const words = Array.from({ length: 3 }, (_unused, index) => ({
	lexical_id: `1:word-${index}`,
	simplified: '词',
	traditional: '詞',
})) as BookmarkWordEntry[];

beforeEach(() => {
	vi.mocked(bookmarksStore.getContent).mockReset().mockResolvedValue(words);
	flashcardsActiveListStore.set(null);
	flashcardsActiveIndexStore.set(0);
	flashcardsShowDetailsStore.set(false);
	window.location.hash = '#/study/flashcards?list=Week%203';
});

afterEach(cleanup);

describe.each([
	{ name: 'desktop', component: Flashcards },
	{ name: 'mobile', component: MobileStudyFlashcards },
])('$name flashcard context', ({ component }) => {
	it('shows the list and current position through navigation and flipping', async () => {
		const user = userEvent.setup();
		const view = render(component);
		const status = await view.findByTestId('flashcard-status');
		expect(status.textContent.trim()).toBe('Week 3 · 1 of 3');
		expect((view.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
			true
		);

		await user.click(view.getByRole('button', { name: 'Next' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
		await user.click(view.getByRole('button', { name: 'Flip' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
		await user.click(view.getByRole('button', { name: 'Next' }));
		expect(status.textContent.trim()).toBe('Week 3 · 3 of 3 · Last card');
		expect((view.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		await user.click(view.getByRole('button', { name: 'Previous' }));
		expect(status.textContent.trim()).toBe('Week 3 · 2 of 3');
	});

	it('marks a single card as the last card', async () => {
		vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce(words.slice(0, 1));
		const view = render(component);
		expect((await view.findByTestId('flashcard-status')).textContent.trim()).toBe(
			'Week 3 · 1 of 1 · Last card'
		);
	});

	it('shows the restored position and list name instead of resetting the count', async () => {
		const listName = '词 & # 1 — A longer list name for the current study session';
		window.location.hash = `#/study/flashcards?list=${encodeURIComponent(listName)}`;
		flashcardsActiveListStore.set(listName);
		flashcardsActiveIndexStore.set(1);
		flashcardsShowDetailsStore.set(true);
		const view = render(component);
		expect((await view.findByTestId('flashcard-status')).textContent.trim()).toBe(
			`${listName} · 2 of 3`
		);
		expect(flashcardsRoute.showDetails).toBe(true);
	});

	it('hides status while loading and when the list is empty', async () => {
		let finishLoading: (contents: BookmarkWordEntry[]) => void;
		vi.mocked(bookmarksStore.getContent).mockReturnValueOnce(
			new Promise((resolve) => {
				finishLoading = resolve;
			})
		);
		const view = render(component);
		expect(flashcardsRoute.loading).toBe(true);
		expect(view.queryByTestId('flashcard-status')).toBeNull();
		finishLoading([]);
		await waitFor(() => expect(flashcardsRoute.loading).toBe(false));
		expect(view.queryByTestId('flashcard-status')).toBeNull();
	});

	it('hides status after a failed list load', async () => {
		vi.mocked(bookmarksStore.getContent).mockRejectedValueOnce(
			new Error('Storage unavailable')
		);
		const view = render(component);
		await view.findByText('Unable to load flashcards. Please try again.');
		expect(view.queryByTestId('flashcard-status')).toBeNull();
	});
});

function press(
	key: string,
	options: KeyboardEventInit = {},
	target: EventTarget = document.body
): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
		...options,
	});
	target.dispatchEvent(event);
	return event;
}

async function readyDesktop() {
	const view = render(Flashcards);
	await view.findByTestId('flashcard-status');
	return view;
}

describe('desktop flashcard shortcuts', () => {
	it('accepts the enclosing main landmark without accepting unrelated outside targets', async () => {
		const main = document.createElement('main');
		main.id = 'sy-main-content';
		main.tabIndex = -1;
		document.body.append(main);
		const view = render(Flashcards, { target: main });
		await view.findByTestId('flashcard-status');
		main.focus();
		expect(document.activeElement).toBe(main);
		expect(press(' ', {}, main).defaultPrevented).toBe(true);
		expect(flashcardsRoute.showDetails).toBe(true);
		press('ArrowRight', {}, main);
		expect(flashcardsRoute.activeIndex).toBe(1);
		expect(flashcardsRoute.showDetails).toBe(false);
		press('ArrowLeft', {}, main);
		expect(flashcardsRoute.activeIndex).toBe(0);
		const outside = document.createElement('button');
		main.append(outside);
		expect(press('ArrowRight', {}, outside).defaultPrevented).toBe(false);
		outside.remove();
		view.unmount();
		main.remove();
	});

	it('flips both ways, navigates with front reset, and consumes boundaries and repeats', async () => {
		await readyDesktop();
		expect(press('ArrowLeft').defaultPrevented).toBe(true);
		expect(flashcardsRoute.activeIndex).toBe(0);
		press(' ');
		expect(flashcardsRoute.showDetails).toBe(true);
		press(' ', { repeat: true });
		expect(flashcardsRoute.showDetails).toBe(true);
		press(' ');
		expect(flashcardsRoute.showDetails).toBe(false);
		press(' ');
		press('ArrowRight');
		expect(flashcardsRoute.activeIndex).toBe(1);
		expect(flashcardsRoute.showDetails).toBe(false);
		expect(press('ArrowRight', { repeat: true }).defaultPrevented).toBe(true);
		expect(flashcardsRoute.activeIndex).toBe(1);
		press('ArrowRight');
		press('ArrowRight');
		expect(flashcardsRoute.activeIndex).toBe(2);
		press('ArrowLeft');
		expect(flashcardsRoute.activeIndex).toBe(1);
	});

	it('preserves native Space on toolbar buttons while allowing arrows', async () => {
		const view = await readyDesktop();
		const next = view.getByRole('button', { name: 'Next' });
		next.focus();
		await userEvent.setup().keyboard(' ');
		expect(flashcardsRoute.activeIndex).toBe(1);
		expect(flashcardsRoute.showDetails).toBe(false);
		press('ArrowLeft', {}, next);
		expect(flashcardsRoute.activeIndex).toBe(0);
		view.getByRole('button', { name: 'Flip' }).focus();
		await userEvent.setup().keyboard(' ');
		expect(flashcardsRoute.showDetails).toBe(true);
	});

	it('accepts the neutral scroll surface but leaves new focusable descendants alone', async () => {
		const view = await readyDesktop();
		const content = view.container.querySelector<HTMLElement>('.flashcard--content')!;
		// Chromium can focus a scroll container even without an explicit tabindex.
		expect(press(' ', {}, content).defaultPrevented).toBe(true);
		expect(flashcardsRoute.showDetails).toBe(true);
		press('ArrowRight', {}, content);
		expect(flashcardsRoute.activeIndex).toBe(1);
		const customControl = document.createElement('div');
		customControl.tabIndex = -1;
		content.append(customControl);
		customControl.focus();
		for (const key of [' ', 'ArrowRight', 'ArrowLeft']) {
			expect(press(key, {}, customControl).defaultPrevented).toBe(false);
		}
		expect(flashcardsRoute.activeIndex).toBe(1);
		expect(flashcardsRoute.showDetails).toBe(false);
		customControl.remove();
	});

	it('applies shared guards to toolbar arrows and handles each press only once', async () => {
		const view = await readyDesktop();
		const flip = view.getByRole('button', { name: 'Flip' });
		flip.focus();
		press('ArrowRight', {}, flip);
		expect(flashcardsRoute.activeIndex).toBe(1);
		for (const options of [{ repeat: true }, { ctrlKey: true }, { isComposing: true }]) {
			press('ArrowRight', options, flip);
			expect(flashcardsRoute.activeIndex).toBe(1);
		}
		const popup = document.createElement('div');
		document.body.append(popup);
		const action = overlayFocus(popup, { initialFocus: 'none' });
		try {
			expect(press('ArrowRight', {}, flip).defaultPrevented).toBe(false);
			expect(flashcardsRoute.activeIndex).toBe(1);
		} finally {
			action && action.destroy?.();
			popup.remove();
		}
		press('ArrowLeft', {}, flip);
		expect(flashcardsRoute.activeIndex).toBe(0);
	});

	it('yields to text entry, controls, walkthroughs, modifiers, composition and handled events', async () => {
		const view = await readyDesktop();
		const container = view.container.querySelector('.flashcard--container');
		for (const markup of [
			'<input>',
			'<textarea></textarea>',
			'<select></select>',
			'<div contenteditable="true"><span>Text</span></div>',
			'<a href="#">Link</a>',
			'<button>Play audio</button>',
		]) {
			const wrapper = document.createElement('div');
			wrapper.innerHTML = markup;
			container.append(wrapper);
			for (const key of [' ', 'ArrowRight']) {
				expect(
					press(key, {}, wrapper.querySelector('span') ?? wrapper.firstElementChild)
						.defaultPrevented
				).toBe(false);
			}
			wrapper.remove();
		}
		const guide = document.createElement('div');
		guide.setAttribute('role', 'dialog');
		document.body.append(guide);
		expect(press('ArrowRight', {}, guide).defaultPrevented).toBe(false);
		guide.remove();
		for (const options of [
			{ ctrlKey: true },
			{ metaKey: true },
			{ altKey: true },
			{ shiftKey: true },
			{ isComposing: true },
			{ keyCode: 229 },
		]) {
			expect(press('ArrowRight', options).defaultPrevented).toBe(false);
		}
		const handled = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		});
		handled.preventDefault();
		document.body.dispatchEvent(handled);
		for (const key of ['ArrowUp', 'ArrowDown']) {
			expect(press(key).defaultPrevented).toBe(false);
		}
		expect(flashcardsRoute.activeIndex).toBe(0);
		expect(flashcardsRoute.showDetails).toBe(false);
	});

	it('pauses while an overlay is registered, even with focus on the page', async () => {
		await readyDesktop();
		const popup = document.createElement('div');
		document.body.append(popup);
		const action = overlayFocus(popup, { initialFocus: 'none' });
		try {
			expect(press('ArrowRight').defaultPrevented).toBe(false);
			expect(press(' ').defaultPrevented).toBe(false);
			expect(flashcardsRoute.activeIndex).toBe(0);
		} finally {
			action && action.destroy?.();
			popup.remove();
		}
		press('ArrowRight');
		expect(flashcardsRoute.activeIndex).toBe(1);
	});

	it('stops on route departure and removes its listener on unmount', async () => {
		const view = await readyDesktop();
		window.location.hash = '#/study';
		expect(press('ArrowRight').defaultPrevented).toBe(false);
		view.unmount();
		window.location.hash = '#/study/flashcards';
		expect(press('ArrowRight').defaultPrevented).toBe(false);
		expect(flashcardsRoute.activeIndex).toBe(0);
	});

	it('does not operate during loading, an empty list, or a failed load', async () => {
		let finishLoading: (words: BookmarkWordEntry[]) => void;
		vi.mocked(bookmarksStore.getContent).mockReturnValueOnce(
			new Promise((resolve) => {
				finishLoading = resolve;
			})
		);
		const view = render(Flashcards);
		expect(press(' ').defaultPrevented).toBe(false);
		finishLoading([]);
		await waitFor(() => expect(flashcardsRoute.loading).toBe(false));
		expect(press('ArrowRight').defaultPrevented).toBe(false);
		view.unmount();
		vi.mocked(bookmarksStore.getContent).mockRejectedValueOnce(new Error('Unavailable'));
		const failed = render(Flashcards);
		await failed.findByText('Unable to load flashcards. Please try again.');
		expect(press(' ').defaultPrevented).toBe(false);
	});

	it('flips a single-card list without navigating beyond it', async () => {
		vi.mocked(bookmarksStore.getContent).mockResolvedValueOnce(words.slice(0, 1));
		await readyDesktop();
		press('ArrowRight');
		press('ArrowLeft');
		press(' ');
		expect(flashcardsRoute.activeIndex).toBe(0);
		expect(flashcardsRoute.showDetails).toBe(true);
	});
});

it('does not add shortcuts to the mobile shell', async () => {
	const view = render(MobileStudyFlashcards);
	await view.findByTestId('flashcard-status');
	press('ArrowRight');
	press(' ');
	expect(flashcardsRoute.activeIndex).toBe(0);
	expect(flashcardsRoute.showDetails).toBe(false);
});
