<script lang="ts">
	import { onMount } from 'svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { fly } from 'svelte/transition';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import OnboardingProgress from '@/components/Onboarding/OnboardingProgress.svelte';
	import WelcomeStep from '@/components/Onboarding/WelcomeStep.svelte';
	import ChinesePreferencesStep from '@/components/Onboarding/ChinesePreferencesStep.svelte';
	import PrivacyStep from '@/components/Onboarding/PrivacyStep.svelte';
	import InterviewStep from '@/components/Onboarding/InterviewStep.svelte';
	import { onboardingStore } from '@/stores/onboarding.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { telemetry } from '@/utils/telemetry.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const STEP_TRANSITION_MS = 250;
	const STEP_TRANSITION_X = 16;

	const { variant = 'desktop' }: Props = $props();
	const canDragWindow = $derived(variant === 'desktop' && platform() === 'macos');

	onboardingStore.reset();

	let reduceMotion = $state(false);
	let submittingInterview = $state(false);
	const isInterview = $derived(onboardingStore.currentStepId === 'interview');
	const transitionDuration = $derived(reduceMotion ? 0 : STEP_TRANSITION_MS);
	const primaryLabel = $derived(onboardingStore.isLastStep ? 'Get Started' : 'Continue');
	const primaryDisabled = $derived(!onboardingStore.canContinue || submittingInterview);

	onMount(() => {
		if (onboardingStore.steps.length === 0) {
			void completeOnboarding();
		}
		telemetry.trackEvent('onboarding.started', {}).catch(() => {});

		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = motionQuery.matches;
		const handleMotionChange = () => {
			reduceMotion = motionQuery.matches;
		};
		motionQuery.addEventListener('change', handleMotionChange);
		return () => {
			motionQuery.removeEventListener('change', handleMotionChange);
		};
	});

	$effect(() => {
		const step = onboardingStore.currentStepId;
		if (step) {
			telemetry.trackEvent('onboarding.step_viewed', { step }).catch(() => {});
		}
	});

	function handleBack(): void {
		onboardingStore.previousStep();
	}

	async function handlePrimaryAction(): Promise<void> {
		if (!onboardingStore.canContinue || submittingInterview) {
			return;
		}
		if (!onboardingStore.isLastStep) {
			onboardingStore.nextStep();
			return;
		}
		await completeOnboarding();
	}

	async function completeOnboarding(): Promise<void> {
		// Set Search before completing so the shell remounts the router at `#/`,
		// not at a leftover hash, and not after awaiting telemetry.
		window.location.hash = '#/';
		privacySettingsStore.completeOnboarding();
		try {
			const prefs = await telemetry.getPrefs();
			if (prefs.enabled) {
				await telemetry.trackEvent('onboarding.completed', {
					child_privacy_mode: privacySettingsStore.childPrivacyMode,
				});
			}
		} catch (error) {
			// This is a telemetry failure, not an onboarding failure. handleError would
			// try to report it through the same telemetry system that just failed.
			console.error('Failed to record onboarding completion.', error);
		}
	}
</script>

<div
	class="onboarding-flow"
	class:onboarding-flow--desktop={variant === 'desktop'}
	class:onboarding-flow--mobile={variant === 'mobile'}
	class:onboarding-flow--draggable={canDragWindow}
	data-tauri-drag-region={canDragWindow ? true : undefined}
	data-testid="onboarding-flow"
>
	{#if canDragWindow}
		<div class="onboarding-flow__titlebar" data-tauri-drag-region aria-hidden="true"></div>
	{/if}
	<div class="onboarding-flow__card">
		<div class="onboarding-flow__body">
			{#key onboardingStore.currentStepId}
				<div
					class="onboarding-flow__step"
					in:fly={{ x: STEP_TRANSITION_X, duration: transitionDuration }}
				>
					{#if onboardingStore.currentStepId === 'welcome'}
						<WelcomeStep />
					{:else if onboardingStore.currentStepId === 'chinese_preferences'}
						<ChinesePreferencesStep {variant} />
					{:else if onboardingStore.currentStepId === 'privacy'}
						<PrivacyStep {variant} />
					{:else if isInterview}
						<InterviewStep
							{variant}
							bind:submitting={submittingInterview}
							oncomplete={completeOnboarding}
						/>
					{/if}
				</div>
			{/key}
		</div>
		<div
			class="onboarding-flow__actions"
			class:onboarding-flow__actions--interview={isInterview}
		>
			<div class="onboarding-flow__back">
				{#if !onboardingStore.isFirstStep}
					<SyButton style="ghost" disabled={submittingInterview} onclick={handleBack}
						>Back</SyButton
					>
				{/if}
				{#if isInterview}
					<SyButton
						style="ghost"
						disabled={submittingInterview}
						onclick={() => {
							void completeOnboarding();
						}}>Skip</SyButton
					>
				{/if}
			</div>
			<OnboardingProgress
				currentStepIndex={onboardingStore.currentStepIndex}
				steps={onboardingStore.steps}
			/>
			<div class="onboarding-flow__primary">
				{#if isInterview}
					<SyButton
						type="submit"
						form="interview-signup"
						classes={['interview-signup-button']}
						style="filled"
						color="blue"
						disabled={submittingInterview}
					>
						{submittingInterview ? 'Saving…' : 'Sign up and get started'}
					</SyButton>
				{:else}
					<SyButton
						style="filled"
						color="blue"
						classes={['onboarding-flow__continue']}
						disabled={primaryDisabled}
						onclick={() => {
							handlePrimaryAction().catch(() => {});
						}}
					>
						{primaryLabel}
					</SyButton>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.onboarding-flow {
		--sy-interview-accent: #2365b9;
		--sy-interview-error: #b22156;
		container-type: inline-size;
		container-name: onboarding;
		height: 100%;
		min-height: 100%;
		box-sizing: border-box;
	}

	.onboarding-flow--desktop {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: var(--sy-space--extra-large);
		background-color: var(--sy-color--grey-2);
	}

	.onboarding-flow--mobile {
		display: flex;
		flex-direction: column;
		background-color: var(--sy-color--white);
	}

	.onboarding-flow--draggable {
		padding-top: 40px;
	}

	.onboarding-flow__titlebar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 32px;
	}

	.onboarding-flow__card {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background-color: var(--sy-color--white);
	}

	.onboarding-flow--desktop .onboarding-flow__card {
		width: min(44rem, 100%);
		max-height: calc(100vh - (var(--sy-space--extra-large) * 2));
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-box-shadow);
		overflow: hidden;
	}

	.onboarding-flow--draggable .onboarding-flow__card {
		max-height: calc(100vh - 60px);
	}

	.onboarding-flow--mobile .onboarding-flow__card {
		flex: 1;
		height: 100%;
	}

	.onboarding-flow__body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sy-space--extra-large);
	}

	.onboarding-flow--mobile .onboarding-flow__body {
		padding-top: max(var(--sy-space--extra-large), env(safe-area-inset-top));
	}

	.onboarding-flow__step {
		min-height: 100%;
	}

	.onboarding-flow__actions {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large);
		border-top: var(--sy-border);
		flex-shrink: 0;
		background-color: var(--sy-color--white);
	}

	.onboarding-flow--mobile .onboarding-flow__actions {
		padding-bottom: max(var(--sy-space--extra-large), env(safe-area-inset-bottom));
		box-shadow: var(--sy-mobile-dock-shadow);
	}

	.onboarding-flow__back {
		display: flex;
		min-width: 5rem;
		justify-self: start;
	}

	.onboarding-flow__primary {
		justify-self: end;
	}

	.onboarding-flow__actions :global(.sy-button:focus-visible) {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 3px;
	}

	.onboarding-flow__actions--interview {
		--sy-color--blue-2: var(--sy-interview-accent);
		--sy-color--blue: var(--sy-interview-accent);
	}

	.onboarding-flow__actions--interview
		:global(.interview-signup-button.sy-button:not(:disabled)) {
		background-color: var(--sy-interview-accent);
		color: var(--sy-color--white);
	}

	@media (prefers-color-scheme: dark) {
		.onboarding-flow {
			--sy-interview-accent: #76aff9;
			--sy-interview-error: #ff8eaf;
		}
	}

	@container onboarding (max-width: 36rem) {
		.onboarding-flow__actions--interview {
			grid-template-columns: auto 1fr;
		}
		.onboarding-flow__actions--interview :global(.onboarding-progress) {
			grid-row: 1;
			grid-column: 1 / -1;
		}
		.onboarding-flow__actions--interview .onboarding-flow__back,
		.onboarding-flow__actions--interview .onboarding-flow__primary {
			grid-row: 2;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.onboarding-flow__step {
			transform: none;
		}
	}
</style>
