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
			action: () => handleSelection('flashcards'),
			tooltip: `Flashcards for ${value.name}`,
			disabled: !eligibility.flashcards,
		},
		{
			icon: Award,
			action: () => handleSelection('quiz'),
			tooltip: `Start quiz for ${value.name}`,
			disabled: !eligibility.quiz,
		},
	]);
</script>

<div class="study-list-item" class:study-list-item--mobile={variant === 'mobile'}>
	<span class="study-list-item--name">
		{value.name}
		{#if eligibility.message}<small class="study-list-item--requirement"
				>{eligibility.message}</small
			>{/if}
	</span>
	<span class="study-list-item--actions">
		{#each actions as action (action.tooltip)}
			<SyButton
				center={true}
				onclick={action.action}
				disabled={action.disabled}
				size={variant === 'mobile' ? 'small' : 'large'}
				style={variant === 'mobile' ? 'ghost' : 'filled'}
				classes={[
					'sy-tooltip--container',
					variant === 'mobile' ? 'study-list-item--action-mobile' : '',
				]}
			>
				<action.icon size="18" />
				<div class="sy-tooltip--body sy-tooltip--body-bottom">
					<p>
						{action.tooltip}
					</p>
				</div>
			</SyButton>
		{/each}
	</span>
</div>

<style>
	.study-list-item--requirement {
		display: block;
		margin-top: var(--sy-space);
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--small);
	}
	.study-list-item {
		padding: var(--sy-space--large);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
	}
	.study-list-item--mobile {
		min-height: var(--sy-mobile-list-item-min-height);
		padding: calc(var(--sy-mobile-space--extra-small) * 5) var(--sy-mobile-space--medium)
			calc(var(--sy-mobile-space--extra-small) * 5) var(--sy-mobile-space--large);
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		border: var(--sy-mobile-surface-border);
		box-sizing: border-box;
	}
	.study-list-item--name {
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--sy-font-family);
		color: var(--sy-color--black);
	}
	.study-list-item--mobile .study-list-item--name {
		font-size: var(--sy-font-size--mobile-large);
	}
	.study-list-item--actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
		flex-shrink: 0;
	}
	:global(.study-list-item--action-mobile) {
		margin: 0;
		color: var(--sy-color--grey-6);
	}
</style>
