<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { updateAgeStatus } from '@/composables/settings.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { privacyPolicyFor } from '@/utils/privacyPolicy.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const { variant = 'desktop' }: Props = $props();
	const policy = $derived(privacyPolicyFor(privacySettingsStore.regionCode));
	const showAgeQuestion = $derived(policy.ageThreshold !== null);
</script>

<section
	class="age-status"
	class:age-status--mobile={variant === 'mobile'}
	aria-labelledby="age-status-heading"
>
	<h2 id="age-status-heading">Age status</h2>
	<p class="age-status__copy">
		Additional privacy protections apply based on the age information provided during setup.
	</p>
	{#if showAgeQuestion}
		<fieldset class="age-status__question">
			<legend>Update age status</legend>
			<p>Are you below the applicable age for this region?</p>
			<div class="age-status__actions">
				<SyButton style="filled" onclick={() => updateAgeStatus(true)}>Yes</SyButton>
				<SyButton style="filled" onclick={() => updateAgeStatus(false)}>No</SyButton>
			</div>
		</fieldset>
	{/if}
</section>

<style>
	.age-status {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding-bottom: var(--sy-space--extra-large);
		border-bottom: var(--sy-border);
	}

	.age-status h2 {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.age-status__copy,
	.age-status__question p {
		margin: 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.age-status__question {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.age-status__question legend {
		padding: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.age-status__actions {
		display: flex;
		gap: var(--sy-space--large);
	}

	.age-status--mobile h2,
	.age-status--mobile .age-status__question legend {
		font-size: var(--sy-font-size--mobile-medium);
	}

	.age-status--mobile .age-status__copy,
	.age-status--mobile .age-status__question p {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
