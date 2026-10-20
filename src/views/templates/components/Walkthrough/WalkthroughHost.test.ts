import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
import Host from '@/components/Walkthrough/WalkthroughHost.svelte';
import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';
import WalkthroughReset from '@/components/Walkthrough/WalkthroughReset.svelte';
import DropdownHarness from '@/components/SyDropdown/DropdownHarness.test.svelte';
import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	set: vi.fn(),
	prepareGuide: vi.fn(),
	hasSuitableContent: vi.fn(),
	addExample: vi.fn(),
}));
vi.mock('@/utils/device.js', () => ({ isMobile: () => false }));
vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: () => ({ waitForInit: async () => {}, get: mocks.get, set: mocks.set }),
}));
vi.mock('@/components/Walkthrough/walkthroughContent.js', () => ({
	GUIDE_LABELS: { dictionary: 'Dictionary', 'reader-document': 'Reading a document' },
	prepareGuide: mocks.prepareGuide,
	hasSuitableContent: mocks.hasSuitableContent,
	addExample: mocks.addExample,
}));

const steps = [
	{
		id: 'search',
		title: 'Look up a word',
		body: 'Enter Chinese or pinyin.',
		target: 'search-field',
		route: '/',
	},
	{
		id: 'save',
		title: 'Save a word',
		body: 'Save useful vocabulary.',
		target: 'dictionary-save',
		route: '/',
	},
];

beforeEach(async () => {
	tour.interrupt();
	mocks.get.mockReturnValue(createWalkthroughPreferences());
	mocks.set.mockClear();
	mocks.prepareGuide.mockReset().mockResolvedValue({ steps, context: {} });
	mocks.hasSuitableContent.mockReset().mockResolvedValue(true);
	mocks.addExample.mockReset().mockResolvedValue({});
	await tour.load();
	Object.assign(tour.preferences, createWalkthroughPreferences(), { featureInvitations: {} });
	window.location.hash = '#/';
});

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it('connects instructions to a real control, supports keyboard focus, and restores focus on exit', async () => {
	const launcher = document.createElement('button');
	launcher.textContent = 'Learn how Search works';
	const input = document.createElement('input');
	input.setAttribute('aria-describedby', 'existing-description');
	document.body.append(launcher, input);
	vi.spyOn(input, 'getClientRects').mockReturnValue([
		new DOMRect(50, 50, 200, 44),
	] as unknown as DOMRectList);
	vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 50, 200, 44));
	const unregister = tour.registerTarget('search-field', input);
	launcher.focus();
	await tour.start('dictionary');
	const view = render(Host);
	const heading = await screen.findByRole('heading', { name: 'Look up a word' });
	await tick();
	expect(document.activeElement).toBe(heading);
	expect(input.getAttribute('aria-describedby')).toBe(
		'existing-description walkthrough-description'
	);
	expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('false');
	await fireEvent.keyDown(heading, { key: 'F6' });
	expect(document.activeElement).toBe(input);
	await fireEvent.keyDown(input, { key: 'F6' });
	expect(document.activeElement).toBe(heading);
	await fireEvent.keyDown(heading, { key: 'Escape' });
	expect(tour.visible).toBe(false);
	view.unmount();
	expect(input.getAttribute('aria-describedby')).toBe('existing-description');
	expect(document.activeElement).toBe(launcher);
	unregister();
});

it('keeps Next and Skip available when a target cannot be found', async () => {
	vi.useFakeTimers();
	await tour.start('dictionary');
	render(Host);
	await vi.advanceTimersByTimeAsync(5000);
	expect(
		screen.getByText('This control isn’t available right now. You can continue or retry.')
	).toBeTruthy();
	await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
	expect(tour.step.id).toBe('save');
	await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
	expect(tour.step.id).toBe('search');
	await fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
	expect(tour.preferences.guides.dictionary.status).toBe('skipped');
});

it('keeps progress between Back and Next, with a smaller Skip action on its own row', async () => {
	const input = document.createElement('input');
	document.body.append(input);
	vi.spyOn(input, 'getClientRects').mockReturnValue([
		new DOMRect(20, 20, 200, 44),
	] as unknown as DOMRectList);
	const unregister = tour.registerTarget('search-field', input);
	await tour.start('dictionary');
	render(Host);
	const next = screen.getByRole('button', { name: 'Next' });
	const skip = screen.getByRole('button', { name: 'Skip tour' });
	const progress = screen.getByText('1 of 2');
	expect(next.classList.contains('sy-button--large')).toBe(true);
	expect(skip.classList.contains('sy-button--small')).toBe(true);
	const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;
	expect(back.disabled).toBe(true);
	expect(progress.previousElementSibling).toBe(back);
	expect(skip.parentElement).not.toBe(progress.parentElement);
	expect(progress.nextElementSibling).toBe(next);
	expect(progress.getAttribute('aria-live')).toBe('polite');
	expect(screen.queryByRole('button', { name: 'Focus highlighted control' })).toBeNull();
	await fireEvent.click(next);
	expect(back.disabled).toBe(false);
	expect(screen.getByText('2 of 2').nextElementSibling).toBe(
		screen.getByRole('button', { name: 'Finish tour' })
	);
	await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
	expect(screen.getByText('1 of 2')).toBeTruthy();
	unregister();
});

it('lets an application dialog own Escape and resumes only after that dialog closes', async () => {
	await tour.start('dictionary');
	render(Host);
	const modal = document.createElement('div');
	modal.className = 'sy-modal--active';
	document.body.append(modal);
	const resume = await screen.findByRole('button', { name: 'Resume' });
	expect((resume as HTMLButtonElement).disabled).toBe(true);
	await fireEvent.keyDown(modal, { key: 'Escape' });
	expect(tour.phase).toBe('suspended');
	modal.remove();
	await vi.waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false));
	await fireEvent.click(resume);
	expect(await screen.findByRole('heading', { name: 'Look up a word' })).toBeTruthy();
});

it.each([false, true])(
	'yields to an import dropdown at phone width and resumes the same step (fixed: %s)',
	async (fixed) => {
		vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(480);
		mocks.prepareGuide.mockResolvedValue({
			steps: [
				steps[0],
				{
					...steps[1],
					id: 'import',
					title: 'Import a document',
					target: 'reader-import',
					route: '/read',
				},
			],
			context: {},
		});
		const onselection = vi.fn();
		const dropdown = render(DropdownHarness, {
			fixed,
			label: 'Import',
			values: [{ id: 'clipboard', text: 'Clipboard', component: SimpleTextDropdownItem }],
			onselection,
		});
		const trigger = screen.getByRole('button', { name: 'Import' });
		vi.spyOn(trigger, 'getClientRects').mockReturnValue([
			new DOMRect(240, 20, 64, 44),
		] as unknown as DOMRectList);
		vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(240, 20, 64, 44));
		const unregister = tour.registerTarget('reader-import', trigger);
		await tour.start('reader-library');
		tour.next();
		render(Host);
		expect(await screen.findByRole('heading', { name: 'Import a document' })).toBeTruthy();

		await fireEvent.click(trigger);
		const resume = (await screen.findByRole('button', { name: 'Resume' })) as HTMLButtonElement;
		expect(tour.phase).toBe('suspended');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(dropdown.container.querySelector('.sy-dropdown--active')).not.toBeNull();
		expect(resume.disabled).toBe(true);
		const escape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true,
		});
		trigger.dispatchEvent(escape);
		expect(escape.defaultPrevented).toBe(true);
		expect(tour.phase).toBe('suspended');
		await tick();
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(trigger);
		await vi.waitFor(() => expect(resume.disabled).toBe(true));
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Clipboard' }));
		expect(onselection).toHaveBeenCalledExactlyOnceWith('clipboard');
		expect(dropdown.container.querySelector('.sy-dropdown--active')).toBeNull();
		await vi.waitFor(() => expect(resume.disabled).toBe(false));
		await fireEvent.click(resume);
		expect(await screen.findByRole('heading', { name: 'Import a document' })).toBeTruthy();
		expect(tour.step.id).toBe('import');
		expect(tour.stepIndex).toBe(1);
		unregister();
	}
);

it('fits the card inside a narrow viewport', async () => {
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(480);
	await tour.start('dictionary');
	render(Host);
	await tick();
	const card = screen.getByRole('dialog');
	expect(card.style.width).toBe('288px');
	expect(card.style.left).toBe('16px');
	expect(card.style.maxHeight).toBe('448px');
});

it.each(['document-one', 'document-two'])(
	'opens %s independently when document choices have identical titles',
	async (documentId) => {
		const choices = ['document-one', 'document-two'].map((identifier) => ({
			label: 'Syng Example — Learning',
			context: { documentId: identifier },
		}));
		mocks.prepareGuide
			.mockResolvedValueOnce({ steps: [], context: {}, choose: 'document', choices })
			.mockImplementation(async (_guide, context) => ({
				steps: [{ ...steps[0], route: `/read/document/${context.documentId}` }],
				context,
			}));
		await tour.start('reader-document');
		render(Host);
		const buttons = screen.getAllByRole('button', { name: 'Syng Example — Learning' });
		expect(buttons).toHaveLength(2);
		const selectedIndex = choices.findIndex(
			(choice) => choice.context.documentId === documentId
		);
		await fireEvent.click(buttons[selectedIndex]);
		await vi.waitFor(() => expect(window.location.hash).toBe(`#/read/document/${documentId}`));
		expect(tour.preparation.context).toEqual({ documentId });
	}
);

it.each(['list', 'document'] as const)(
	'offers %s samples only while the guide needs content',
	async (kind) => {
		mocks.prepareGuide.mockResolvedValue({
			steps: [{ ...steps[0], example: kind }],
			context: {},
		});
		mocks.hasSuitableContent.mockResolvedValue(false);
		await tour.start('study');
		render(Host);
		const label = kind === 'list' ? 'Add sample words' : 'Add sample document';
		const sample = await screen.findByRole('button', { name: label });
		expect(sample.classList.contains('sy-button--ghost')).toBe(true);
		expect(sample.classList.contains('sy-button--medium')).toBe(true);
		mocks.hasSuitableContent.mockResolvedValue(true);
		await fireEvent.click(sample);
		await vi.waitFor(() =>
			expect(mocks.addExample).toHaveBeenCalledWith(
				kind,
				expect.anything(),
				expect.any(Function),
				false,
				'study'
			)
		);
		await vi.waitFor(() => expect(tour.exampleBusy).toBe(false));
		expect(screen.queryByRole('button', { name: label })).toBeNull();
	}
);

it('ignores an outdated availability check after moving to a different sample step', async () => {
	let resolveList: (available: boolean) => void;
	mocks.hasSuitableContent.mockImplementation((kind) =>
		kind === 'list'
			? new Promise<boolean>((resolve) => {
					resolveList = resolve;
				})
			: Promise.resolve(true)
	);
	mocks.prepareGuide.mockResolvedValue({
		steps: [
			{ ...steps[0], example: 'list' },
			{ ...steps[1], example: 'document' },
		],
		context: {},
	});
	await tour.start('app');
	render(Host);
	await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
	resolveList(false);
	await tick();
	expect(screen.queryByRole('button', { name: 'Add sample document' })).toBeNull();
});

it('keeps sample creation available after a failed attempt', async () => {
	mocks.prepareGuide.mockResolvedValue({ steps: [], choose: 'list', choices: [], context: {} });
	mocks.addExample.mockRejectedValueOnce(new Error('Storage unavailable'));
	await tour.start('flashcards');
	render(Host);
	await fireEvent.click(screen.getByRole('button', { name: 'Add sample words' }));
	expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Storage unavailable');
	expect(
		(screen.getByRole('button', { name: 'Add sample words' }) as HTMLButtonElement).disabled
	).toBe(false);
});

it('hides only completed feature links, including during a later replay', async () => {
	render(WalkthroughHelp, { guide: 'dictionary', label: 'Learn how Search works' });
	render(WalkthroughHelp, { guide: 'study', label: 'Learn how Study works' });
	await fireEvent.click(screen.getByRole('button', { name: 'Learn how Search works' }));
	await vi.waitFor(() => expect(tour.phase).toBe('guiding'));
	tour.skip();
	await tick();
	expect(screen.getByRole('button', { name: 'Learn how Search works' })).toBeTruthy();
	await tour.start('dictionary');
	tour.next();
	tour.next();
	await tick();
	expect(screen.queryByRole('button', { name: 'Learn how Search works' })).toBeNull();
	expect(screen.getByRole('button', { name: 'Learn how Study works' })).toBeTruthy();
	await tour.start('dictionary');
	tour.interrupt();
	await tick();
	expect(screen.queryByRole('button', { name: 'Learn how Search works' })).toBeNull();
});

it('restores completed Search and Reader help links when feature tours are reset', async () => {
	tour.preferences.guides.dictionary = { status: 'completed', completed: true, context: {} };
	tour.preferences.guides['reader-library'] = {
		status: 'completed',
		completed: true,
		context: {},
	};
	render(WalkthroughHelp, { guide: 'dictionary', label: 'Learn how Search works' });
	render(WalkthroughHelp, { guide: 'reader-library', label: 'Learn how Reader works' });
	render(WalkthroughReset);
	expect(screen.queryByRole('button', { name: 'Learn how Search works' })).toBeNull();
	expect(screen.queryByRole('button', { name: 'Learn how Reader works' })).toBeNull();
	await fireEvent.click(screen.getByRole('button', { name: 'Reset feature tours' }));
	expect(await screen.findByRole('button', { name: 'Learn how Search works' })).toBeTruthy();
	expect(await screen.findByRole('button', { name: 'Learn how Reader works' })).toBeTruthy();
	await fireEvent.click(screen.getByRole('button', { name: 'Learn how Reader works' }));
	await vi.waitFor(() => expect(tour.phase).toBe('guiding'));
	expect(tour.guide).toBe('reader-library');
});

it('uses a full-window shade with only the highlighted control cut out near the upper-right corner', async () => {
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(640);
	const control = document.createElement('button');
	document.body.append(control);
	vi.spyOn(control, 'getClientRects').mockReturnValue([
		new DOMRect(280, 14, 30, 32),
	] as unknown as DOMRectList);
	vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(280, 14, 30, 32));
	const unregister = tour.registerTarget('search-field', control);
	await tour.start('dictionary');
	render(Host);
	const shade = document.querySelector('.walkthrough__shade');
	expect(shade?.getAttribute('width')).toBe('100%');
	expect(shade?.getAttribute('height')).toBe('100%');
	const cutout = shade?.querySelector('mask rect[fill="black"]');
	expect(cutout?.getAttribute('x')).toBe('274');
	expect(cutout?.getAttribute('y')).toBe('8');
	expect(cutout?.getAttribute('width')).toBe('38');
	expect(cutout?.getAttribute('height')).toBe('44');
	unregister();
});

it('does not put a dictionary link inside the guide when the page has no examples', async () => {
	mocks.prepareGuide.mockResolvedValue({
		steps: [
			{
				...steps[0],
				id: 'links',
				target: 'dictionary-examples',
				fallbackTarget: 'dictionary-link',
			},
		],
		context: {},
	});
	await tour.start('dictionary');
	render(Host);
	expect(screen.queryByTestId('dictionary-link')).toBeNull();
	expect(tour.phase).toBe('guiding');
});
