import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { createWalkthroughPreferences } from '@/types/walkthrough.js';
import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
import Host from '@/components/Walkthrough/WalkthroughHost.svelte';
import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), prepareGuide: vi.fn() }));
vi.mock('@/utils/device.js', () => ({ isMobile: () => false }));
vi.mock('@/utils/appServices.js', () => ({
	getPreferenceManager: () => ({ waitForInit: async () => {}, get: mocks.get, set: mocks.set }),
}));
vi.mock('@/components/Walkthrough/walkthroughContent.js', () => ({
	GUIDE_LABELS: { dictionary: 'Dictionary', 'reader-document': 'Reading a document' },
	prepareGuide: mocks.prepareGuide,
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
	launcher.textContent = 'Show me how';
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
		const dropdown = render(SyDropdown, {
			fixed,
			children: createRawSnippet<[boolean]>(() => ({ render: () => '<span>Import</span>' })),
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
		expect(escape.defaultPrevented).toBe(false);
		expect(tour.phase).toBe('suspended');

		await fireEvent.click(screen.getByRole('button', { name: 'Clipboard' }));
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
