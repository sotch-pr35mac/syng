import { beforeEach, expect, it, vi } from 'vitest';
import { createWalkthroughPreferences, type WalkthroughPreferences } from '@/types/walkthrough.js';

const content = vi.hoisted(() => ({ prepareGuide: vi.fn(), addExample: vi.fn() }));
vi.mock('@/components/Walkthrough/walkthroughContent.js', () => content);

let saved: WalkthroughPreferences;
let store: typeof import('@/stores/walkthrough.svelte.js').walkthroughStore;
const steps = [
	{ id: 'search', title: 'Look up a word', body: 'Search', target: 'search-field', route: '/' },
	{ id: 'save', title: 'Save a word', body: 'Save', target: 'dictionary-save', route: '/' },
	{ id: 'study', title: 'Practice', body: 'Study', target: 'study-lists', route: '/study' },
];

beforeEach(async () => {
	vi.resetModules();
	saved = createWalkthroughPreferences(true);
	const { setPreferenceManagerForTest } = await import('@/utils/appServices.js');
	setPreferenceManagerForTest({
		waitForInit: vi.fn().mockResolvedValue(undefined),
		get: vi.fn(() => saved),
		set: vi.fn((_key, value) => {
			saved = value;
		}),
	} as never);
	store = (await import('@/stores/walkthrough.svelte.js')).walkthroughStore;
	content.prepareGuide
		.mockReset()
		.mockImplementation(async (_guide, context) => ({ steps, context }));
	content.addExample.mockReset();
	window.location.hash = '#/';
});

it('consumes a new-install invitation once and does not reoffer after skipping', async () => {
	await store.load();
	store.offer();
	expect(store.phase).toBe('invitation');
	expect(saved.invitation).toBe('shown');
	store.skip();
	store.offer();
	expect(store.phase).toBe('idle');
});

it('keeps the invitation through the onboarding handoff to Search, then respects navigation', async () => {
	await store.load();
	store.offer();
	store.routeChanged();
	expect(store.phase).toBe('invitation');
	window.location.hash = '#/read';
	store.routeChanged();
	expect(store.visible).toBe(false);
	store.offer();
	expect(store.visible).toBe(false);
});

it('does not invite existing profiles or interrupt another destination', async () => {
	saved = createWalkthroughPreferences();
	await store.load();
	store.offer();
	expect(store.visible).toBe(false);
});

it('waits until blocking UI clears before offering the invitation', async () => {
	await store.load();
	store.setBlocked(true);
	store.offer();
	expect(saved.invitation).toBe('eligible');
	store.setBlocked(false);
	store.offer();
	expect(store.phase).toBe('invitation');
});

it('persists steps, supports Back and finishes the app tour at Search', async () => {
	await store.start('app');
	store.next();
	expect(saved.guides.app.stepId).toBe('save');
	store.back();
	expect(store.step.id).toBe('search');
	store.next();
	store.next();
	expect(window.location.hash).toBe('#/study');
	store.next();
	expect(saved.guides.app.status).toBe('completed');
	expect(window.location.hash).toBe('#/');
	expect(store.visible).toBe(false);
});

it('keeps progress on unrelated navigation and resumes only when requested', async () => {
	await store.start('app');
	store.next();
	window.location.hash = '#/read';
	store.routeChanged();
	expect(store.visible).toBe(false);
	expect(saved.guides.app.status).toBe('in-progress');
	await store.start('app', {}, true);
	expect(store.step.id).toBe('save');
});

it('does not resurrect a guide when preparation finishes after Skip', async () => {
	let finish: (value: unknown) => void;
	content.prepareGuide.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	const pending = store.start('dictionary');
	await vi.waitFor(() => expect(content.prepareGuide).toHaveBeenCalled());
	store.skip();
	finish({ steps, context: {} });
	await pending;
	expect(store.visible).toBe(false);
	expect(saved.guides.dictionary.status).toBe('skipped');
});

it('does not redirect after the user navigates away while a guide is preparing', async () => {
	let finish: (value: unknown) => void;
	content.prepareGuide.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	const pending = store.start('dictionary');
	await vi.waitFor(() => expect(content.prepareGuide).toHaveBeenCalled());
	window.location.hash = '#/read';
	store.routeChanged();
	finish({ steps, context: {} });
	await pending;
	expect(window.location.hash).toBe('#/read');
	expect(store.visible).toBe(false);
	expect(saved.guides.dictionary.status).toBe('in-progress');
});

it('returns to content selection when a resumed guide loses its document', async () => {
	saved.guides['reader-document'] = {
		status: 'in-progress',
		stepId: 'pages',
		context: { documentId: 'deleted' },
	};
	content.prepareGuide.mockResolvedValue({
		steps: [],
		context: {},
		choose: 'document',
		choices: [],
	});
	await store.start('reader-document', {}, true);
	expect(content.prepareGuide).toHaveBeenCalledWith(
		'reader-document',
		{ documentId: 'deleted' },
		expect.any(Function)
	);
	expect(store.phase).toBe('choosing');
});

it('suspends quiz timing only while instructions are visible', async () => {
	await store.start('quiz', { listName: 'Vocabulary' });
	expect(store.quizSuspended).toBe(true);
	store.suspend();
	expect(store.quizSuspended).toBe(false);
	store.skip();
	expect(store.quizSuspended).toBe(false);
});

it('allows only one example creation at a time and keeps saved examples after Skip', async () => {
	await store.start('study');
	let finish: () => void;
	content.addExample.mockImplementation(async (_kind, examples, remember) => {
		await new Promise<void>((resolve) => {
			finish = resolve;
		});
		remember({ ...examples, listName: 'Example' });
		return { listName: 'Example' };
	});
	const pending = store.addExample('list');
	await vi.waitFor(() => expect(content.addExample).toHaveBeenCalledTimes(1));
	await store.addExample('list');
	store.skip();
	finish();
	await pending;
	expect(content.addExample).toHaveBeenCalledTimes(1);
	expect(saved.examples.listName).toBe('Example');
	expect(store.visible).toBe(false);
});
