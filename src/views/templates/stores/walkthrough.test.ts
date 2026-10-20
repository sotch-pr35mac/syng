import { beforeEach, expect, it, vi } from 'vitest';
import {
	createWalkthroughPreferences,
	WALKTHROUGH_IDS,
	type WalkthroughPreferences,
} from '@/types/walkthrough.js';

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
	expect(store.exampleAdded).toBeNull();
});

it('confirms a saved sample after the chooser opens its guide, until the next step', async () => {
	content.prepareGuide.mockResolvedValueOnce({
		steps: [],
		choose: 'document',
		choices: [],
		context: {},
	});
	content.addExample.mockResolvedValue({ documentId: 'sample-document' });
	await store.start('reader-document');
	await store.addExample('document');
	expect(store.phase).toBe('guiding');
	expect(store.preparation.context.documentId).toBe('sample-document');
	expect(store.exampleAdded).toBe('document');
	store.next();
	expect(store.exampleAdded).toBeNull();
});

it('does not restore a sample confirmation if the reopened guide is skipped while loading', async () => {
	content.prepareGuide.mockResolvedValueOnce({
		steps: [],
		choose: 'list',
		choices: [],
		context: {},
	});
	await store.start('flashcards');
	let finish: (value: unknown) => void;
	content.prepareGuide.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	content.addExample.mockResolvedValue({ listName: 'Sample' });
	const pending = store.addExample('list');
	await vi.waitFor(() => expect(content.prepareGuide).toHaveBeenCalledTimes(2));
	store.skip();
	finish({ steps, context: { listName: 'Sample' } });
	await pending;
	expect(store.phase).toBe('idle');
	expect(store.exampleAdded).toBeNull();
});

it('remembers completed guides through interrupted replays and across restarts', async () => {
	saved.guides.dictionary = { status: 'completed', context: {} };
	await store.load();
	expect(store.hasCompleted('dictionary')).toBe(true);
	expect(store.hasCompleted('study')).toBe(false);
	await store.start('dictionary');
	store.skip();
	expect(saved.guides.dictionary.status).toBe('skipped');
	expect(saved.guides.dictionary.completed).toBe(true);
	vi.resetModules();
	const { setPreferenceManagerForTest } = await import('@/utils/appServices.js');
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: () => saved,
		set: vi.fn(),
	} as never);
	store = (await import('@/stores/walkthrough.svelte.js')).walkthroughStore;
	await store.load();
	expect(store.hasCompleted('dictionary')).toBe(true);
});

it('offers each practice guide once, pauses quiz timing, and persists a declined invitation', async () => {
	await store.load();
	window.location.hash = '#/study/quiz?list=Vocabulary';
	store.offerFeature('quiz', { listName: 'Vocabulary' });
	expect(store.phase).toBe('feature-invitation');
	expect(store.quizSuspended).toBe(true);
	store.routeChanged();
	expect(store.phase).toBe('feature-invitation');
	store.skip();
	expect(store.quizSuspended).toBe(false);
	expect(saved.featureInvitations.quiz).toBe(true);
	expect(saved.guides.quiz).toBeUndefined();
	store.offerFeature('quiz', { listName: 'Vocabulary' });
	expect(store.visible).toBe(false);
	store.offerFeature('flashcards', { listName: 'Vocabulary' });
	expect(store.phase).toBe('feature-invitation');
	window.location.hash = '#/study';
	store.routeChanged();
	expect(store.visible).toBe(false);
	vi.resetModules();
	const { setPreferenceManagerForTest } = await import('@/utils/appServices.js');
	setPreferenceManagerForTest({
		waitForInit: async () => {},
		get: () => saved,
		set: vi.fn(),
	} as never);
	store = (await import('@/stores/walkthrough.svelte.js')).walkthroughStore;
	await store.load();
	store.offerFeature('quiz', { listName: 'Vocabulary' });
	expect(store.visible).toBe(false);
});

it('defers practice invitations while blocked or guiding and does not offer previously tried guides', async () => {
	await store.load();
	store.setBlocked(true);
	store.offerFeature('flashcards', { listName: 'Vocabulary' });
	expect(saved.featureInvitations?.flashcards).not.toBe(true);
	store.setBlocked(false);
	await store.start('study');
	store.offerFeature('flashcards', { listName: 'Vocabulary' });
	expect(store.guide).toBe('study');
	expect(saved.featureInvitations?.flashcards).not.toBe(true);
	store.skip();
	await store.start('flashcards', { listName: 'Vocabulary' });
	store.skip();
	store.offerFeature('flashcards', { listName: 'Vocabulary' });
	expect(store.visible).toBe(false);
});

it('resets all feature tours while keeping app tour history and sample content', async () => {
	saved.invitation = 'shown';
	saved.examples = { listName: 'My sample', documentId: 'my-document' };
	for (const identifier of WALKTHROUGH_IDS) {
		saved.guides[identifier] = { status: 'completed', completed: true, context: {} };
	}
	saved.guides.quiz = { status: 'in-progress', context: { listName: 'Vocabulary' } };
	saved.featureInvitations = { flashcards: true, quiz: true };
	saved.featureInvitations['reader-document'] = true;
	await store.resetFeatureTours();
	expect(saved.invitation).toBe('shown');
	expect(saved.examples).toEqual({ listName: 'My sample', documentId: 'my-document' });
	expect(saved.guides).toEqual({
		app: { status: 'completed', completed: true, context: {} },
	});
	for (const identifier of WALKTHROUGH_IDS) {
		expect(store.hasCompleted(identifier)).toBe(identifier === 'app');
	}
	store.offerFeature('flashcards', { listName: 'Vocabulary' });
	expect(store.phase).toBe('feature-invitation');
	store.skip();
	store.offerFeature('quiz', { listName: 'Vocabulary' });
	expect(store.phase).toBe('feature-invitation');
	store.skip();
	store.offerFeature('reader-document', { documentId: 'my-document' });
	expect(store.phase).toBe('feature-invitation');
});

it.each(WALKTHROUGH_IDS.filter((identifier) => identifier !== 'app'))(
	'does not let pending %s preparation restore progress after a reset',
	async (identifier) => {
		let finish: (value: unknown) => void;
		content.prepareGuide.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const pending = store.start(identifier, { listName: 'Vocabulary' });
		await vi.waitFor(() => expect(content.prepareGuide).toHaveBeenCalled());
		await store.resetFeatureTours();
		finish({ steps, context: { listName: 'Vocabulary' } });
		await pending;
		expect(store.visible).toBe(false);
		expect(store.quizSuspended).toBe(false);
		expect(saved.guides[identifier]).toBeUndefined();
	}
);
