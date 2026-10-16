import { getPreferenceManager } from '@/utils/appServices.js';
import {
	createWalkthroughPreferences,
	WALKTHROUGH_IDS,
	WALKTHROUGH_VERSION,
	type WalkthroughId,
	type WalkthroughContext,
	type WalkthroughPreferences,
	type WalkthroughPreparation,
	type WalkthroughStep,
	type WalkthroughTargetId,
} from '@/types/walkthrough.js';

type Phase = 'idle' | 'invitation' | 'loading' | 'choosing' | 'guiding' | 'suspended' | 'error';
let preferences = $state<WalkthroughPreferences>(createWalkthroughPreferences());
let loaded = $state(false);
let phase = $state<Phase>('idle');
let guide = $state<WalkthroughId | null>(null);
let preparation = $state<WalkthroughPreparation>({ steps: [], context: {} });
let stepIndex = $state(0);
let requestVersion = 0;
let expectedRoute = '';
let errorMessage = $state('');
let exampleBusy = $state(false);
let blocked = $state(false);
let targetRevision = $state(0);
// DOM nodes must remain unproxied; revision announces registration changes to the host.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Registry changes explicitly update targetRevision.
const targets = new Map<WalkthroughTargetId, Set<HTMLElement>>();

function persist(): void {
	if (loaded) {
		getPreferenceManager().set('walkthrough', $state.snapshot(preferences));
	}
}

async function load(): Promise<void> {
	if (loaded) {
		return;
	}
	const manager = getPreferenceManager();
	await manager.waitForInit();
	const saved = manager.get('walkthrough') as WalkthroughPreferences | undefined;
	if (saved?.version === WALKTHROUGH_VERSION) {
		const clean = createWalkthroughPreferences();
		clean.invitation = ['eligible', 'shown', 'unavailable'].includes(saved.invitation)
			? saved.invitation
			: 'unavailable';
		for (const identifier of WALKTHROUGH_IDS) {
			const progress = saved.guides?.[identifier];
			if (progress && ['in-progress', 'skipped', 'completed'].includes(progress.status)) {
				clean.guides[identifier] = { ...progress, context: progress.context ?? {} };
			}
		}
		clean.examples = saved.examples ?? {};
		preferences = clean;
	}
	loaded = true;
}

function offer(): void {
	if (!loaded || blocked || phase !== 'idle' || preferences.invitation !== 'eligible') {
		return;
	}
	preferences.invitation = 'shown';
	persist();
	if (window.location.hash === '#/' || !window.location.hash) {
		phase = 'invitation';
	}
}

function saveProgress(status: 'in-progress' | 'skipped' | 'completed'): void {
	if (!guide) {
		return;
	}
	preferences.guides[guide] = {
		status,
		stepId: preparation.steps[stepIndex]?.id,
		context: { ...preparation.context },
	};
	persist();
}

function navigate(step: WalkthroughStep): void {
	expectedRoute = step.route;
	if (window.location.hash !== `#${step.route}`) {
		window.location.hash = `#${step.route}`;
	}
	saveProgress('in-progress');
}

async function start(
	identifier: WalkthroughId,
	context: WalkthroughContext = {},
	resume = false
): Promise<void> {
	const request = ++requestVersion;
	guide = identifier;
	phase = 'loading';
	preparation = { steps: [], context };
	stepIndex = 0;
	expectedRoute = window.location.hash.slice(1) || '/';
	errorMessage = '';
	try {
		await load();
		if (preferences.invitation === 'eligible') {
			preferences.invitation = 'shown';
			persist();
		}
		const content = await import('@/components/Walkthrough/walkthroughContent.js');
		if (request !== requestVersion) {
			return;
		}
		const saved = resume ? preferences.guides[identifier] : undefined;
		preparation = { steps: [], context: saved?.context ?? context };
		const prepared = await content.prepareGuide(
			identifier,
			preparation.context,
			() => request === requestVersion
		);
		if (request !== requestVersion) {
			return;
		}
		preparation = prepared;
		stepIndex = Math.max(
			0,
			prepared.steps.findIndex((step) => step.id === saved?.stepId)
		);
		if (prepared.choose) {
			phase = 'choosing';
			saveProgress('in-progress');
		} else if (prepared.steps.length) {
			phase = 'guiding';
			navigate(prepared.steps[stepIndex]);
		} else {
			throw new Error('There are no instructions available for this screen yet.');
		}
	} catch (error) {
		if (request !== requestVersion) {
			return;
		}
		errorMessage =
			error instanceof Error ? error.message : 'The guide could not open. Please try again.';
		phase = 'error';
	}
}

function close(status: 'skipped' | 'completed' | 'in-progress'): void {
	++requestVersion;
	saveProgress(status);
	phase = 'idle';
	expectedRoute = '';
	errorMessage = '';
}

function next(): void {
	if (stepIndex >= preparation.steps.length - 1) {
		const wasAppTour = guide === 'app';
		close('completed');
		if (wasAppTour) {
			window.location.hash = '#/';
		}
		return;
	}
	stepIndex += 1;
	navigate(preparation.steps[stepIndex]);
}

function back(): void {
	if (stepIndex > 0) {
		stepIndex -= 1;
		navigate(preparation.steps[stepIndex]);
	}
}

function routeChanged(): void {
	if (phase === 'invitation') {
		// Onboarding sets #/ immediately before making the shell ready. Its queued
		// hashchange must not dismiss the invitation just offered on that screen.
		if (window.location.hash && window.location.hash !== '#/') {
			close('in-progress');
		}
	} else if (
		phase !== 'idle' &&
		phase !== 'suspended' &&
		window.location.hash !== `#${expectedRoute}`
	) {
		close('in-progress');
	}
}

function registerTarget(identifier: WalkthroughTargetId, element: HTMLElement): () => void {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Registry changes explicitly update targetRevision.
	const elements = targets.get(identifier) ?? new Set<HTMLElement>();
	elements.add(element);
	targets.set(identifier, elements);
	targetRevision += 1;
	return () => {
		elements.delete(element);
		targetRevision += 1;
	};
}

function target(identifier: WalkthroughTargetId | undefined): HTMLElement | undefined {
	void targetRevision;
	if (!identifier) {
		return undefined;
	}
	const available = [...(targets.get(identifier) ?? [])].filter(
		(element) =>
			element.isConnected &&
			!element.closest('[data-walkthrough-secondary]') &&
			element.getClientRects().length > 0
	);
	return available.find((element) => !element.matches(':disabled')) ?? available[0];
}

async function addExample(kind: 'document' | 'list', freshCopy = false): Promise<void> {
	if (exampleBusy) {
		return;
	}
	exampleBusy = true;
	errorMessage = '';
	const request = requestVersion;
	try {
		const content = await import('@/components/Walkthrough/walkthroughContent.js');
		const context = await content.addExample(
			kind,
			preferences.examples,
			(examples) => {
				preferences.examples = examples;
				persist();
			},
			freshCopy
		);
		if (request !== requestVersion) {
			return;
		}
		if (phase === 'choosing' && guide) {
			await start(guide, context);
		} else if (guide) {
			const identifier = guide;
			const previousStep = preparation.steps[stepIndex]?.id;
			const updated = await content.prepareGuide(
				identifier,
				preparation.context,
				() => request === requestVersion
			);
			if (request !== requestVersion) {
				return;
			}
			preparation = updated;
			stepIndex = Math.max(
				0,
				updated.steps.findIndex((step) => step.id === previousStep)
			);
		}
	} catch (error) {
		if (request === requestVersion) {
			errorMessage =
				error instanceof Error
					? error.message
					: 'The example could not be added. Please try again.';
		}
	} finally {
		exampleBusy = false;
	}
}

export const walkthroughStore = {
	get phase() {
		return phase;
	},
	get guide() {
		return guide;
	},
	get visible() {
		return phase !== 'idle';
	},
	get blocked() {
		return blocked;
	},
	get quizSuspended() {
		return guide === 'quiz' && phase !== 'idle' && phase !== 'suspended';
	},
	get step() {
		return preparation.steps[stepIndex];
	},
	get stepIndex() {
		return stepIndex;
	},
	get stepCount() {
		return preparation.steps.length;
	},
	get preparation() {
		return preparation;
	},
	get preferences() {
		return preferences;
	},
	get error() {
		return errorMessage;
	},
	get exampleBusy() {
		return exampleBusy;
	},
	get loaded() {
		return loaded;
	},
	load,
	offer,
	start,
	next,
	back,
	target,
	registerTarget,
	routeChanged,
	addExample,
	skip: () => close('skipped'),
	interrupt: () => {
		if (phase !== 'idle') {
			close('in-progress');
		}
	},
	suspend: () => {
		if (phase === 'guiding') {
			phase = 'suspended';
			saveProgress('in-progress');
		}
	},
	resume: () => {
		if (guide) {
			void start(guide, {}, true);
		}
	},
	setBlocked: (value: boolean) => {
		blocked = value;
		if (value && phase !== 'idle') {
			close('in-progress');
		}
	},
	isOverview: (route: string) => phase === 'guiding' && expectedRoute === route,
	updateExamples: (examples: WalkthroughPreferences['examples']) => {
		preferences.examples = examples;
		persist();
	},
};
