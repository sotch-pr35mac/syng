<script lang="ts">
	import { ONBOARDING_STEPS } from '@/types/onboarding.js';

	interface Props {
		currentStepIndex: number;
	}

	const { currentStepIndex }: Props = $props();
	const stepCount = ONBOARDING_STEPS.length;
	const currentStepNumber = $derived(currentStepIndex + 1);
</script>

<div class="onboarding-progress" role="status" aria-label="Step {currentStepNumber} of {stepCount}">
	<span class="onboarding-progress__label">Step {currentStepNumber} of {stepCount}</span>
	<ol class="onboarding-progress__dots" aria-hidden="true">
		{#each ONBOARDING_STEPS as step, index (step.id)}
			<li
				class="onboarding-progress__dot"
				class:onboarding-progress__dot--current={index === currentStepIndex}
				class:onboarding-progress__dot--complete={index < currentStepIndex}
			></li>
		{/each}
	</ol>
</div>

<style>
	.onboarding-progress {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space);
	}

	.onboarding-progress__label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.onboarding-progress__dots {
		display: flex;
		gap: var(--sy-space--large);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.onboarding-progress__dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--sy-color--grey-1);
	}

	.onboarding-progress__dot--current,
	.onboarding-progress__dot--complete {
		background-color: var(--sy-color--blue-2);
	}
</style>
