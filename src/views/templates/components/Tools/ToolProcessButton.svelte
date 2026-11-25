<script lang="ts">
	import { Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { TextConversionToolVariant } from '@/types/textConversionTool.js';

	const {
		variant = 'desktop',
		label = 'Process',
		disabled = false,
		onProcess,
	}: {
		variant?: TextConversionToolVariant;
		label?: string;
		disabled?: boolean;
		onProcess: () => void;
	} = $props();
</script>

<SyButton
	onclick={onProcess}
	size={variant === 'mobile' ? 'medium' : 'large'}
	center
	{disabled}
	classes={[
		'tool-process-button',
		...(variant === 'mobile' ? ['tool-process-button--mobile'] : []),
	]}
>
	<Play size="16" aria-hidden="true" />
	<span>{label}</span>
</SyButton>

<style>
	:global(button.sy-button.tool-process-button) {
		flex-shrink: 0;
		gap: var(--sy-space);
		margin-inline: auto 0;
	}
	:global(button.sy-button.tool-process-button--mobile) {
		width: min(100%, var(--sy-radio-group-max-width));
		gap: var(--sy-mobile-space--medium);
		margin-inline: 0;
	}
</style>
