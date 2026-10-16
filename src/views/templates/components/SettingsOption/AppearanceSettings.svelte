<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { appearanceStore } from '@/stores/appearance.svelte.js';

	const {
		variant = 'desktop',
		showLabel = true,
	}: { variant?: 'desktop' | 'mobile'; showLabel?: boolean } = $props();
	const settingId = $props.id();
</script>

<div class="appearance-settings" class:appearance-settings--mobile={variant === 'mobile'}>
	{#if showLabel}
		<label for={`${settingId}-contrast`}>Increase Contrast</label>
	{/if}
	<SyToggle
		id={`${settingId}-contrast`}
		accessibleLabel="Increase Contrast"
		checked={appearanceStore.increaseContrast}
		onchange={(checked) => appearanceStore.setIncreaseContrast(checked)}
	/>
</div>

<style>
	.appearance-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sy-space--large);
		color: var(--sy-appearance-switch--text);
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
	}
	.appearance-settings > label {
		flex: 1 1 14rem;
		min-width: 0;
		font-weight: var(--sy-font-weight--bold);
		cursor: pointer;
	}
	.appearance-settings--mobile {
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
