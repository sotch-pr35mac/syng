<script>
	import SyButton from '../SyButton/SyButton.svelte';
	import { SquareStack, Award } from 'lucide-svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} value - Required Value Prop
	 * @property {(data: {action: string, list: any}) => void} [onselection] - Selection callback
	 */

	/** @type {Props} */
	const { value, onselection = () => {} } = $props();

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

<div class="study-list-item">
	<span>
		{value}
	</span>
	<span class="study-list-item--actions">
		{#each actions as action (action.tooltip)}
			<SyButton
				center={true}
				onclick={action.action}
				size="large"
				classes={['sy-tooltip--container']}
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
	}
	.study-list-item--actions {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
	}
</style>
