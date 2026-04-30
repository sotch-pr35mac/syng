<script>
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { SquareStack, Award } from 'lucide-svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} value - Required Value Prop
	 * @property {'default' | 'mobile'} [variant] - Visual variant
	 * @property {(data: {action: string, list: any}) => void} [onselection] - Selection callback
	 */

	/** @type {Props} */
	const { value, variant = 'default', onselection = () => {} } = $props();

	const handleSelection = (actionType) => {
		if (value) {
			onselection({
				action: actionType,
				list: value,
			});
		}
	};

	const actions = $derived([
		{
			icon: SquareStack,
			action: () => handleSelection('flashcards'),
			tooltip: `Flashcards for ${value}`,
		},
		{
			icon: Award,
			action: () => handleSelection('quiz'),
			tooltip: `Start quiz for ${value}`,
		},
	]);
</script>

<div class="study-list-item" class:study-list-item--mobile={variant === 'mobile'}>
	<span class="study-list-item--name">
		{value}
	</span>
	<span class="study-list-item--actions">
		{#each actions as action (action.tooltip)}
			<SyButton
				center={true}
				onclick={action.action}
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
