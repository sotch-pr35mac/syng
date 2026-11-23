<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { SquareStack, Award } from 'lucide-svelte';
	import {
		getStudyEligibility,
		type StudyAction,
		type StudyListSummary,
	} from '@/composables/study.js';

	const {
		value,
		variant = 'default',
		onselection = () => {},
	} = $props<{
		value: StudyListSummary;
		variant?: 'default' | 'mobile';
		onselection?: (data: { action: StudyAction; list: string }) => void;
	}>();
	const eligibility = $derived(getStudyEligibility(value.wordCount));
	function handleSelection(action: StudyAction): void {
		if (eligibility[action]) {
			onselection({ action, list: value.name });
		}
	}
	const actions = $derived([
		{
			icon: SquareStack,
			label: 'Flashcards',
			action: () => handleSelection('flashcards'),
			guideTarget: 'study-flashcards' as const,
			tooltip: `Flashcards for ${value.name}`,
			disabled: !eligibility.flashcards,
		},
		{
			icon: Award,
			label: 'Quiz',
			action: () => handleSelection('quiz'),
			guideTarget: 'study-quiz' as const,
			tooltip: `Start quiz for ${value.name}`,
			disabled: !eligibility.quiz,
		},
	]);
</script>

<div class="study-list-item" class:study-list-item--mobile={variant === 'mobile'}>
	<div class="study-list-item__details">
		<span class="study-list-item__name">{value.name}</span>
		<span class="study-list-item__count"
			>{value.wordCount} saved {value.wordCount === 1 ? 'word' : 'words'}</span
		>
		{#if eligibility.message}<small class="study-list-item__requirement"
				>{eligibility.message}</small
			>{/if}
	</div>
	<div class="study-list-item__actions">
		{#each actions as action (action.tooltip)}
			<SyButton
				guideTarget={action.guideTarget}
				aria-label={action.tooltip}
				center={true}
				onclick={action.action}
				disabled={action.disabled}
				disableHoverActions={action.disabled}
				size="medium"
				classes={['study-list-item__action', 'sy-tooltip--container']}
			>
				<action.icon size="18" />
				<span>{action.label}</span>
				<div class="sy-tooltip--body sy-tooltip--body-bottom">
					<p>{action.tooltip}</p>
				</div>
			</SyButton>
		{/each}
	</div>
</div>

<style>
	.study-list-item {
		padding: var(--sy-space--extra-large);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
	}
	.study-list-item--mobile {
		align-items: stretch;
		flex-direction: column;
		padding: var(--sy-mobile-space--large);
		gap: var(--sy-mobile-space--large);
		box-sizing: border-box;
	}
	.study-list-item__details {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: var(--sy-space);
		overflow-wrap: anywhere;
	}
	.study-list-item__name {
		font: var(--sy-type--local-title-mobile);
		color: var(--sy-color--black);
	}
	.study-list-item__count,
	.study-list-item__requirement {
		font: var(--sy-type--supporting);
		color: var(--sy-text--secondary);
	}
	.study-list-item__requirement {
		color: var(--sy-text--secondary);
	}
	.study-list-item__actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--sy-space--large);
		flex-shrink: 0;
	}
	:global(.study-list-item__action) {
		margin: 0;
		min-width: 116px;
		min-height: 40px;
		gap: var(--sy-space--large);
	}
	:global(.study-list-item__action:disabled) {
		background-color: var(--sy-surface--well);
		color: var(--sy-text--secondary);
		box-shadow: none;
	}
	.study-list-item--mobile .study-list-item__actions {
		width: 100%;
	}
	.study-list-item--mobile :global(.study-list-item__action) {
		flex: 1;
		min-width: 0;
	}
	@media (max-width: 640px) {
		.study-list-item:not(.study-list-item--mobile) {
			align-items: stretch;
			flex-direction: column;
		}
		.study-list-item:not(.study-list-item--mobile) .study-list-item__actions {
			width: 100%;
		}
		.study-list-item:not(.study-list-item--mobile) :global(.study-list-item__action) {
			flex: 1;
			min-width: 0;
		}
	}
</style>
