import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
import {
	createWalkthroughPreferences,
	type WalkthroughId,
	type WalkthroughStatus,
} from '@/types/walkthrough.js';
import WalkthroughSettings from '@/components/Walkthrough/WalkthroughSettings.svelte';
import Host from '@/components/Walkthrough/WalkthroughHost.svelte';

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), prepareGuide: vi.fn() }));
vi.mock('@/utils/device.js', () => ({ isMobile: () => false }));
vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: () => ({ waitForInit: async () => {}, get: mocks.get, set: mocks.set }),
}));
vi.mock('@/components/Walkthrough/walkthroughContent.js', () => ({
	GUIDE_LABELS: { app: 'App tour' },
	prepareGuide: mocks.prepareGuide,
}));

const guides: [WalkthroughId, string][] = [
	['app', 'App tour'],
	['dictionary', 'Dictionary'],
	['bookmarks', 'Bookmarks'],
	['reader-library', 'Importing and your library'],
	['reader-document', 'Reading a document'],
	['study', 'Choosing what to study'],
	['flashcards', 'Flashcards'],
	['quiz', 'Quizzes'],
];

beforeEach(async () => {
	tour.interrupt();
	mocks.get.mockReturnValue(createWalkthroughPreferences());
	await tour.load();
	tour.preferences.guides = {};
	mocks.set.mockClear();
	vi.spyOn(tour, 'start').mockResolvedValue();
	window.location.hash = '#/settings';
});

afterEach(() => {
	cleanup();
	tour.interrupt();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

it.each(['desktop', 'mobile'] as const)(
	'renders one ordinary setting with one launch action (%s)',
	(variant) => {
		render(WalkthroughSettings, { variant });
		const row = screen.getByRole('group', { name: 'Walkthrough' });
		expect(row.dataset.walkthroughTarget).toBe('settings-walkthroughs');
		expect(screen.queryByRole('heading')).toBeNull();
		expect(screen.getAllByRole('button')).toHaveLength(2);
		expect(row.querySelector('.sy-button-bar--container .sy-dropdown--container')).toBeTruthy();
		expect(
			screen.getAllByRole('button').every((button) => button.classList.contains('sy-button'))
		).toBe(true);
		expect(
			screen
				.getByRole('button', { name: 'Choose walkthrough: App tour' })
				.getAttribute('aria-expanded')
		).toBe('false');
		expect(screen.getByRole('button', { name: 'Start App tour' }).textContent).toBe('Start');
	}
);

it.each(guides)(
	'selects %s without launching and starts the chosen guide explicitly',
	async (guideId, label) => {
		render(WalkthroughSettings);
		const trigger = screen.getByRole('button', { name: 'Choose walkthrough: App tour' });
		await fireEvent.click(trigger);
		const menu = screen.getByRole('menu', { name: 'Walkthroughs' });
		expect(menu.parentElement).toBe(document.body);
		expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
		expect(
			screen.getAllByRole('menuitemradio').map((item) => item.textContent?.trim())
		).toEqual(guides.map(([_id, name]) => name));
		await fireEvent.click(screen.getByRole('menuitemradio', { name: label }));
		expect(tour.start).not.toHaveBeenCalled();
		expect(mocks.set).not.toHaveBeenCalled();
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		expect(trigger.getAttribute('aria-label')).toBe(`Choose walkthrough: ${label}`);
		await fireEvent.click(trigger);
		expect(
			screen.getByRole('menuitemradio', { name: label }).getAttribute('aria-checked')
		).toBe('true');
		expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: label }));
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		await fireEvent.click(screen.getByRole('button', { name: `Start ${label}` }));
		expect(tour.start).toHaveBeenCalledExactlyOnceWith(guideId, {}, false, 'settings');
	}
);

it.each([
	['completed', 'Replay', false],
	['skipped', 'Replay', false],
	['in-progress', 'Resume', true],
] as const)(
	'uses %s progress for the selected guide',
	async (status: WalkthroughStatus, label, resume) => {
		tour.preferences.guides.quiz = {
			status,
			stepId: 'answer',
			context: { listName: 'Saved list' },
		};
		render(WalkthroughSettings);
		await fireEvent.click(screen.getByRole('button', { name: 'Choose walkthrough: App tour' }));
		await fireEvent.click(screen.getByRole('menuitemradio', { name: 'Quizzes' }));
		const action = screen.getByRole('button', { name: `${label} Quizzes` });
		expect(action.textContent).toBe(label);
		await fireEvent.click(action);
		expect(tour.start).toHaveBeenCalledExactlyOnceWith('quiz', {}, resume, 'settings');
		await fireEvent.click(screen.getByRole('button', { name: 'Choose walkthrough: Quizzes' }));
		expect(Boolean(screen.queryByRole('menuitem', { name: 'Start over Quizzes' }))).toBe(
			resume
		);
	}
);

it('starts an interrupted guide over without changing progress on selection', async () => {
	tour.preferences.guides.app = { status: 'in-progress', stepId: 'settings', context: {} };
	render(WalkthroughSettings);
	await fireEvent.click(screen.getByRole('button', { name: 'Choose walkthrough: App tour' }));
	expect(screen.getByRole('separator')).toBeTruthy();
	await fireEvent.click(screen.getByRole('menuitem', { name: 'Start over App tour' }));
	expect(tour.start).toHaveBeenCalledExactlyOnceWith('app', {}, false, 'settings');
	expect(screen.queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Resume App tour' }));
});

it('supports keyboard opening, navigation, selection, dismissal, and logical tab order', async () => {
	const user = userEvent.setup();
	const previousControl = document.createElement('button');
	previousControl.textContent = 'Previous setting';
	document.body.append(previousControl);
	render(WalkthroughSettings);
	const trigger = screen.getByRole('button', { name: 'Choose walkthrough: App tour' });
	trigger.focus();
	await user.keyboard('{ArrowUp}');
	expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Quizzes' }));
	await user.keyboard('{ArrowDown}');
	expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'App tour' }));
	await user.keyboard('{End}{Home}b');
	expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Bookmarks' }));
	await user.keyboard('{Enter}');
	expect(document.activeElement).toBe(trigger);
	expect(tour.start).not.toHaveBeenCalled();
	await user.keyboard(' ');
	expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Bookmarks' }));
	await user.keyboard('{Escape}');
	expect(document.activeElement).toBe(trigger);
	expect(trigger.getAttribute('aria-expanded')).toBe('false');
	await user.keyboard('{ArrowDown}{Tab}');
	expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start Bookmarks' }));
	expect(screen.queryByRole('menu')).toBeNull();
	await user.tab({ shift: true });
	await user.keyboard('{Enter}');
	await user.tab({ shift: true });
	expect(document.activeElement).toBe(previousControl);
	expect(screen.queryByRole('menu')).toBeNull();
});

it('dismisses on outside interaction and removes its portal when unmounted', async () => {
	const view = render(WalkthroughSettings);
	const trigger = screen.getByRole('button', { name: 'Choose walkthrough: App tour' });
	await fireEvent.click(trigger);
	await fireEvent.click(document.body);
	expect(screen.queryByRole('menu')).toBeNull();
	await fireEvent.click(trigger);
	const outside = document.createElement('button');
	document.body.append(outside);
	outside.focus();
	await tick();
	expect(document.activeElement).toBe(outside);
	await fireEvent.click(outside);
	expect(screen.queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(outside);
	await fireEvent.click(trigger);
	view.unmount();
	expect(screen.queryByRole('menu')).toBeNull();
	await fireEvent.resize(window);
	expect(tour.start).not.toHaveBeenCalled();
});

it('defaults to App tour on remount and reacts to saved progress changes', async () => {
	const view = render(WalkthroughSettings);
	await fireEvent.click(screen.getByRole('button', { name: 'Choose walkthrough: App tour' }));
	await fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dictionary' }));
	tour.preferences.guides.dictionary = { status: 'completed', context: {} };
	await tick();
	expect(screen.getByRole('button', { name: 'Replay Dictionary' })).toBeTruthy();
	view.unmount();
	render(WalkthroughSettings);
	expect(screen.getByRole('button', { name: 'Start App tour' })).toBeTruthy();
});

it('keeps a long menu within a short phone viewport and repositions on resize', async () => {
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(480);
	vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(600);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
		this: HTMLElement
	) {
		return this.matches('[role="menu"]')
			? new DOMRect(0, 0, 304, 600)
			: new DOMRect(260, 400, 44, 44);
	});
	render(WalkthroughSettings, { variant: 'mobile' });
	await fireEvent.click(screen.getByRole('button', { name: 'Choose walkthrough: App tour' }));
	const menu = screen.getByRole('menu');
	expect(menu.style.left).toBe('12px');
	expect(menu.style.top).toBe('12px');
	expect(menu.style.maxWidth).toBe('296px');
	expect(menu.style.maxHeight).toBe('384px');
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);
	await fireEvent.resize(window);
	expect(menu.style.maxHeight).toBe('276px');
	expect(menu.style.top).toBe('12px');
});

it('lets the guide picker own focus and Escape while the active walkthrough is paused', async () => {
	vi.mocked(tour.start).mockRestore();
	mocks.prepareGuide.mockResolvedValue({
		context: {},
		steps: [
			{
				id: 'settings',
				title: 'Find a guide',
				body: 'Choose a guide in Settings.',
				target: 'settings-walkthroughs',
				route: '/settings',
			},
		],
	});
	render(WalkthroughSettings);
	const row = screen.getByRole('group', { name: 'Walkthrough' });
	vi.spyOn(row, 'getClientRects').mockReturnValue([
		new DOMRect(20, 20, 280, 44),
	] as unknown as DOMRectList);
	vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 280, 44));
	await tour.start('app');
	render(Host);
	await screen.findByRole('heading', { name: 'Find a guide' });
	const trigger = screen.getByRole('button', { name: 'Choose walkthrough: App tour' });
	await fireEvent.click(trigger);
	await vi.waitFor(() => expect(tour.phase).toBe('suspended'));
	expect(screen.queryByRole('dialog')).toBeNull();
	expect(screen.getByRole('button', { name: 'Resume' })).toHaveProperty('disabled', true);
	expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'App tour' }));
	await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
	expect(screen.queryByRole('menu')).toBeNull();
	expect(document.activeElement).toBe(trigger);
	expect(tour.phase).toBe('suspended');
	await vi.waitFor(() =>
		expect(screen.getByRole('button', { name: 'Resume' })).toHaveProperty('disabled', false)
	);
	await fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
	await vi.waitFor(() => expect(tour.phase).toBe('guiding'));
	expect(tour.step.id).toBe('settings');
});
