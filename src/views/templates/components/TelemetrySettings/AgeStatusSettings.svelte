<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { updateAgeStatus } from '@/composables/settings.js';
	import { handleError } from '@/utils/error.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const { variant = 'desktop' }: Props = $props();
	let updatingAgeStatus = $state(false);

	async function handleAgeStatus(isBelowApplicableAge: boolean): Promise<void> {
		updatingAgeStatus = true;
		try {
			await updateAgeStatus(isBelowApplicableAge);
		} catch (error) {
			handleError('Failed to update age-based privacy settings.', error, { silent: true });
		} finally {
			updatingAgeStatus = false;
		}
	}
</script>

<section
	class="age-status"
	class:age-status--mobile={variant === 'mobile'}
	aria-labelledby="age-status-heading"
>
	<header class="age-status__header">
		<h2 id="age-status-heading">Age Status</h2>
		<p class="age-status__copy">
			Additional restrictions apply based on the age information provided during setup.
		</p>
	</header>
	<fieldset class="age-status__question">
		<legend>Update Age Status</legend>
		<p class="age-status__prompt">
			Are you now at least the minimum digital consent age in your country or region?
		</p>
		<div class="age-status__actions">
			<SyButton
				style="filled"
				color="blue"
				aria-pressed="true"
				classes={['age-status__button']}
				disabled={updatingAgeStatus}
				onclick={() => handleAgeStatus(true)}
			>
				No
			</SyButton>
			<SyButton
				style="filled"
				aria-pressed="false"
				classes={['age-status__button']}
				disabled={updatingAgeStatus}
				onclick={() => handleAgeStatus(false)}
			>
				Yes
			</SyButton>
		</div>
	</fieldset>
</section>

<style>
	.age-status {
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-space--extra-large) + var(--sy-space--large));
	}

	.age-status__header {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.age-status h2 {
		margin: 0;
		font-size: var(--sy-font-size--heading);
		font-weight: var(--sy-font-weight--bold);
	}

	.age-status__copy {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.age-status__question {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.age-status__question legend {
		padding: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.age-status__prompt {
		margin: var(--sy-space--large) 0 0;
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
	}

	.age-status__actions {
		display: flex;
		gap: var(--sy-space--large);
		margin-top: calc(var(--sy-space--extra-large) + var(--sy-space--large));
	}

	:global(.age-status__button.sy-button--filled) {
		min-width: 5rem;
		margin: 0;
	}

	.age-status--mobile h2 {
		font-size: var(--sy-font-size--mobile-heading);
	}

	.age-status--mobile .age-status__question legend,
	.age-status--mobile .age-status__copy,
	.age-status--mobile .age-status__prompt {
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
