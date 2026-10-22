/**
 * Owns the walkthrough lifecycle: invitations, preparation/choices, guiding, pause, and exit.
 * Preferences persist progress and sample IDs; phase, DOM targets, and pending requests are
 * session state. Each new launch or cancellation invalidates older requestVersion tokens.
 * Requested sample writes may finish after cancellation, but stale work must not navigate,
 * select content, or restore a guide. Telemetry retains the originating launch's context.
 */
import { getPreferenceManager } from '@/utils/appServices.js';
import { telemetry } from '@/utils/telemetry.js';
import type {
	WalkthroughEntry,
	WalkthroughEvent,
	WalkthroughSource,
	WalkthroughTelemetry,
} from '@/types/telemetry.js';
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
	type FeatureWalkthroughId,
} from '@/types/walkthrough.js';

type Phase =
	| 'idle'
	| 'invitation'
	| 'feature-invitation'
	| 'loading'
	| 'choosing'
	| 'guiding'
	| 'suspended'
	| 'error';
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
let exampleAdded = $state<'document' | 'list' | null>(null);
let blocked = $state(false);
let targetRevision = $state(0);
let source: WalkthroughSource = 'direct';
let presentedStep = '';
// DOM nodes must remain unproxied; revision announces registration changes to the host.
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Registry changes explicitly update targetRevision.
const targets = new Map<WalkthroughTargetId, Set<HTMLElement>>();

/** Capture stable guide/step attribution without including user content or route parameters. */
function eventContext(): WalkthroughTelemetry {
	const step = phase === 'invitation' ? undefined : preparation.steps[stepIndex];
	return {
		guide: phase === 'invitation' ? 'app' : guide!,
		source,
		...(step
			? { step: step.id, step_number: stepIndex + 1, step_count: preparation.steps.length }
			: {}),
	};
}

/** Telemetry failures must never interrupt a guide or a requested data save. */
function track(
	event: WalkthroughEvent,
	details: Partial<WalkthroughTelemetry> = {},
	context = eventContext()
): void {
	telemetry.trackEvent(`walkthrough.${event}`, { ...context, ...details }).catch(() => {});
}

/** Called by the rendered card, not by route preparation or geometry updates. */
function markStepPresented(view: 'instructions' | 'dictionary-popup' = 'instructions'): void {
	if (phase !== 'guiding' || !preparation.steps[stepIndex]) {
		return;
	}
	const key = `${requestVersion}:${stepIndex}:${view}`;
	if (key !== presentedStep) {
		presentedStep = key;
		track('step_viewed', { view });
	}
}

/** Save only serializable preferences; runtime state and DOM nodes remain session-local. */
function persist(): void {
	if (loaded) {
		getPreferenceManager().set('walkthrough', $state.snapshot(preferences));
	}
}

/** Load once and sanitize known progress fields; unknown schema versions use safe defaults. */
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
		clean.featureInvitations = {
			'reader-document': saved.featureInvitations?.['reader-document'] === true,
			flashcards: saved.featureInvitations?.flashcards === true,
			quiz: saved.featureInvitations?.quiz === true,
		};
		preferences = clean;
	}
	loaded = true;
}

/** Consume the fresh-install invitation once, without redirecting an unrelated launch route. */
function offer(): void {
	if (!loaded || blocked || phase !== 'idle' || preferences.invitation !== 'eligible') {
		return;
	}
	preferences.invitation = 'shown';
	persist();
	if (window.location.hash === '#/' || !window.location.hash) {
		guide = null;
		phase = 'invitation';
		source = 'invitation';
		track('invitation_shown');
	}
}

/** Offer a feature on first use unless it has already been offered or tried. */
function offerFeature(identifier: FeatureWalkthroughId, context: WalkthroughContext): void {
	if (
		!loaded ||
		blocked ||
		phase !== 'idle' ||
		preferences.guides[identifier] ||
		preferences.featureInvitations?.[identifier]
	) {
		return;
	}
	preferences.featureInvitations = { ...preferences.featureInvitations, [identifier]: true };
	guide = identifier;
	preparation = { steps: [], context };
	stepIndex = 0;
	expectedRoute = window.location.hash.slice(1) || '/';
	phase = 'feature-invitation';
	source = 'invitation';
	track('invitation_shown');
	persist();
}

/** Retain completion history even when a later replay is interrupted or skipped. */
function hasCompleted(identifier: WalkthroughId): boolean {
	const progress = preferences.guides[identifier];
	return progress?.completed === true || progress?.status === 'completed';
}

/** Developer reset: clear feature progress/invitations while preserving samples and the app tour. */
async function resetFeatureTours(): Promise<void> {
	await load();
	exampleAdded = null;
	if (guide && guide !== 'app') {
		// Cancel any pending preparation before clearing progress so it cannot restore it.
		++requestVersion;
		phase = 'idle';
		guide = null;
		preparation = { steps: [], context: {} };
		stepIndex = 0;
		expectedRoute = '';
		errorMessage = '';
	}
	for (const identifier of WALKTHROUGH_IDS) {
		if (identifier !== 'app') {
			delete preferences.guides[identifier];
		}
	}
	preferences.featureInvitations = {};
	persist();
}

/** Persist the resumable step/context without treating a declined invitation as a tried guide. */
function saveProgress(status: 'in-progress' | 'skipped' | 'completed'): void {
	if (!guide || phase === 'feature-invitation') {
		return;
	}
	preferences.guides[guide] = {
		status,
		completed: status === 'completed' || hasCompleted(guide),
		stepId: preparation.steps[stepIndex]?.id,
		context: { ...preparation.context },
	};
	persist();
}

/** Record the expected route before navigation so our own hashchange does not close the tour. */
function navigate(step: WalkthroughStep): void {
	expectedRoute = step.route;
	if (window.location.hash !== `#${step.route}`) {
		window.location.hash = `#${step.route}`;
	}
	saveProgress('in-progress');
}

/** Prepare content under a cancellation token; choices/retries/resumes preserve the launch source. */
async function start(
	identifier: WalkthroughId,
	context: WalkthroughContext = {},
	resume = false,
	entry: WalkthroughEntry = 'direct'
): Promise<void> {
	const invitation =
		(entry === 'direct' || entry === 'invitation') &&
		((phase === 'invitation' && identifier === 'app') ||
			(phase === 'feature-invitation' && identifier === guide));
	const continuation = ['choice', 'example', 'retry', 'resume'].includes(entry);
	if (!continuation && !invitation && phase !== 'idle') {
		close('in-progress', 'replaced');
	}
	if (invitation) {
		track('invitation_accepted');
	}
	if (!continuation) {
		source = invitation ? 'invitation' : (entry as WalkthroughSource);
	} else if (entry === 'choice') {
		track('content_selected', { content_kind: preparation.choose });
	} else if (entry === 'retry') {
		track('retried');
	}
	const request = ++requestVersion;
	exampleAdded = null;
	guide = identifier;
	phase = 'loading';
	preparation = { steps: [], context };
	stepIndex = 0;
	expectedRoute = window.location.hash.slice(1) || '/';
	errorMessage = '';
	if (entry === 'help') {
		track('help_clicked');
	}
	try {
		await load();
		if (request !== requestVersion) {
			return;
		}
		if (!resume && !continuation) {
			const previous = preferences.guides[identifier];
			track('started', {
				mode: !previous ? 'new' : previous.status === 'in-progress' ? 'restart' : 'replay',
			});
		}
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
			track('chooser_viewed', {
				content_kind: prepared.choose,
				choice_count: prepared.choices?.length ?? 0,
			});
		} else if (prepared.steps.length) {
			phase = 'guiding';
			navigate(prepared.steps[stepIndex]);
		} else {
			throw new Error('There are no instructions available for this screen yet.');
		}
		if (resume && entry !== 'retry') {
			track('resumed');
		}
	} catch (error) {
		if (request !== requestVersion) {
			return;
		}
		errorMessage =
			error instanceof Error ? error.message : 'The guide could not open. Please try again.';
		phase = 'error';
		track('failed', { operation: 'prepare' });
	}
}

/** Invalidate pending work before hiding the guide; keep progress according to the exit reason. */
function close(
	status: 'skipped' | 'completed' | 'in-progress',
	reason: WalkthroughTelemetry['reason'] = 'dismissed'
): void {
	if (phase === 'idle') {
		return;
	}
	if (phase === 'invitation' || phase === 'feature-invitation') {
		track('invitation_dismissed', { reason });
	} else {
		track(
			status === 'in-progress' ? 'interrupted' : status,
			status === 'completed' ? {} : { reason }
		);
	}
	++requestVersion;
	exampleAdded = null;
	saveProgress(status);
	phase = 'idle';
	expectedRoute = '';
	errorMessage = '';
}

/** Advance the guide or complete it; the app overview returns to Search when finished. */
function next(): void {
	if (phase !== 'guiding') {
		return;
	}
	track('next');
	exampleAdded = null;
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

/** Return to the previous instruction without changing completion history. */
function back(): void {
	exampleAdded = null;
	if (phase === 'guiding' && stepIndex > 0) {
		track('back');
		stepIndex -= 1;
		navigate(preparation.steps[stepIndex]);
	}
}

/** Treat navigation outside the expected step as interruption, retaining a resumable position. */
function routeChanged(): void {
	if (phase === 'invitation') {
		// Onboarding sets #/ immediately before making the shell ready. Its queued
		// hashchange must not dismiss the invitation just offered on that screen.
		if (window.location.hash && window.location.hash !== '#/') {
			close('in-progress', 'navigation');
		}
	} else if (
		phase !== 'idle' &&
		phase !== 'suspended' &&
		window.location.hash !== `#${expectedRoute}`
	) {
		close('in-progress', 'navigation');
	}
}

/** Register mounted controls and notify the host when responsive layouts replace them. */
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

/** Choose a visible main-surface target, excluding duplicates inside secondary popovers. */
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

/** Serialize sample requests; save data after cancellation but guard selection and guide updates. */
async function addExample(kind: 'document' | 'list', freshCopy = false): Promise<void> {
	if (exampleBusy) {
		return;
	}
	exampleBusy = true;
	exampleAdded = null;
	errorMessage = '';
	let request = requestVersion;
	const exampleGuide = guide;
	const exampleContext = eventContext();
	const details = { content_kind: kind, fresh_copy: freshCopy };
	track('example_requested', details, exampleContext);
	let added = false;
	try {
		const content = await import('@/components/Walkthrough/walkthroughContent.js');
		const context = await content.addExample(
			kind,
			preferences.examples,
			(examples) => {
				preferences.examples = examples;
				persist();
			},
			freshCopy,
			exampleGuide,
			() => request === requestVersion
		);
		added = true;
		// The sample may have saved after the tour closed. Attribute it to the original request.
		track('example_added', details, exampleContext);
		if (request !== requestVersion) {
			return;
		}
		if (phase === 'choosing' && guide) {
			const openingGuide = start(guide, context, false, 'example');
			// Follow the request created by our own start, while still rejecting
			// completions after Skip or a different guide takes over.
			request = requestVersion;
			await openingGuide;
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
		if (request === requestVersion) {
			exampleAdded = kind;
		}
	} catch (error) {
		track('failed', { ...details, operation: added ? 'prepare' : 'example' }, exampleContext);
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
	get exampleAdded() {
		return exampleAdded;
	},
	get loaded() {
		return loaded;
	},
	load,
	offer,
	offerFeature,
	resetFeatureTours,
	hasCompleted,
	start,
	next,
	back,
	target,
	registerTarget,
	routeChanged,
	addExample,
	markStepPresented,
	skip: () => close('skipped'),
	interrupt: () => {
		if (phase !== 'idle') {
			close('in-progress', 'unmount');
		}
	},
	// Yield to a secondary overlay; resuming prepares the saved step against current content.
	suspend: () => {
		if (phase === 'feature-invitation') {
			close('skipped', 'overlay');
			return;
		}
		if (phase === 'guiding') {
			track('paused', { reason: 'overlay' });
			phase = 'suspended';
			saveProgress('in-progress');
		}
	},
	resume: () => {
		if (guide && phase === 'suspended') {
			void start(guide, {}, true, 'resume');
		}
	},
	setBlocked: (value: boolean) => {
		blocked = value;
		if (value && phase !== 'idle') {
			close('in-progress', 'blocked');
		}
	},
	isOverview: (route: string) => phase === 'guiding' && expectedRoute === route,
	updateExamples: (examples: WalkthroughPreferences['examples']) => {
		preferences.examples = examples;
		persist();
	},
};
