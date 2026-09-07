<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import OnboardingProgress from '@/components/Onboarding/OnboardingProgress.svelte';
	import WelcomeStep from '@/components/Onboarding/WelcomeStep.svelte';
	import ChinesePreferencesStep from '@/components/Onboarding/ChinesePreferencesStep.svelte';
	import PrivacyStep from '@/components/Onboarding/PrivacyStep.svelte';
	import { onboardingStore } from '@/stores/onboarding.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { telemetry } from '@/utils/telemetry.js';
	import { handleError } from '@/utils/error.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const STEP_TRANSITION_MS = 250;
	const STEP_TRANSITION_X = 16;

	const { variant = 'desktop' }: Props = $props();

	onboardingStore.reset();

	let reduceMotion = $state(false);
	const transitionDuration = $derived(reduceMotion ? 0 : STEP_TRANSITION_MS);
	const primaryLabel = $derived(onboardingStore.isLastStep ? 'Get Started' : 'Continue');
	const primaryDisabled = $derived(onboardingStore.isLastStep && !onboardingStore.canContinue);

	onMount(() => {
		onboardingStore.reset();
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
		telemetry.trackEvent('onboarding.step_viewed', { step }).catch(() => {});
	});

	function handleBack(): void {
		onboardingStore.previousStep();
	}

	async function handlePrimaryAction(): Promise<void> {
		if (!onboardingStore.isLastStep) {
			onboardingStore.nextStep();
			return;
		}
		if (!onboardingStore.canContinue) {
			return;
		}

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
			handleError('Failed to record onboarding completion.', error, { silent: true });
		}
	}
</script>

<div
	class="onboarding-flow"
	class:onboarding-flow--desktop={variant === 'desktop'}
	class:onboarding-flow--mobile={variant === 'mobile'}
	data-testid="onboarding-flow"
>
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
					{:else}
						<PrivacyStep {variant} />
					{/if}
				</div>
			{/key}
		</div>
		<div class="onboarding-flow__actions">
			<div class="onboarding-flow__back">
				{#if !onboardingStore.isFirstStep}
					<SyButton style="ghost" onclick={handleBack}>Back</SyButton>
				{/if}
			</div>
			<OnboardingProgress currentStepIndex={onboardingStore.currentStepIndex} />
			<div class="onboarding-flow__primary">
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
			</div>
		</div>
	</div>
</div>

<style>
	.onboarding-flow {
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

	.onboarding-flow__card {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background-color: var(--sy-color--white);
	}

	.onboarding-flow--desktop .onboarding-flow__card {
		width: min(40rem, 100%);
		max-height: calc(100vh - (var(--sy-space--extra-large) * 2));
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-box-shadow);
		overflow: hidden;
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
		min-width: 5rem;
		justify-self: start;
	}

	.onboarding-flow__primary {
		justify-self: end;
	}

	:global(.onboarding-flow__continue.sy-button--filled) {
		background-color: var(--sy-color--blue-2);
		color: var(--sy-color--white);
	}

	:global(.onboarding-flow__continue.sy-button--filled:disabled) {
		background-color: var(--sy-color--grey-2);
		color: var(--sy-color--grey-5);
	}

	@media (prefers-reduced-motion: reduce) {
		.onboarding-flow__step {
			transform: none;
		}
	}
</style>
