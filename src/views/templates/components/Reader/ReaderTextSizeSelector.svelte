<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';

	type Props = {
		fontSizePercent: number;
		canDecrease?: boolean;
		canIncrease?: boolean;
		onchange?: (_direction: 'increase' | 'decrease') => void;
	};

	const { fontSizePercent, canDecrease = true, canIncrease = true, onchange }: Props = $props();
</script>

<SyButtonBar size="large" role="group" aria-label="Reader font size">
	<SyButton
		grouped={true}
		center={true}
		disabled={!canDecrease}
		aria-label="Decrease reader font size"
		onclick={() => onchange?.('decrease')}
	>
		<Minus size="16" />
		<span>A</span>
	</SyButton>
	<SyButton
		grouped={true}
		center={true}
		disabled={true}
		disableHoverActions={true}
		classes={['reader-text-size-selector__value']}
		aria-hidden="true"
	>
		{fontSizePercent}%
	</SyButton>
	<SyButton
		grouped={true}
		center={true}
		disabled={!canIncrease}
		aria-label="Increase reader font size"
		onclick={() => onchange?.('increase')}
	>
		<Plus size="16" />
		<span>A</span>
	</SyButton>
</SyButtonBar>
<span class="sy-sr-only" role="status" aria-live="polite" aria-atomic="true"
	>Reader font size: {fontSizePercent}%</span
>

<style>
	:global(.reader-text-size-selector__value) {
		min-width: 4rem;
		color: var(--sy-color--black);
	}
</style>
