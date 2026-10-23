<script lang="ts">
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { contrastStore } from '@/stores/contrast.svelte.js';

	const {
		variant = 'desktop',
		showLabel = true,
		source = 'settings',
	}: {
		variant?: 'desktop' | 'mobile';
		showLabel?: boolean;
		source?: 'settings' | 'whats_new';
	} = $props();
	const settingId = $props.id();
</script>

<div
	class="increase-contrast-settings"
	class:increase-contrast-settings--mobile={variant === 'mobile'}
>
	{#if showLabel}
		<label for={`${settingId}-contrast`}>Increase Contrast</label>
	{/if}
	<SyToggle
		id={`${settingId}-contrast`}
		accessibleLabel="Increase Contrast"
		checked={contrastStore.increaseContrast}
		onchange={(checked) => contrastStore.setIncreaseContrast(checked, source)}
	/>
</div>

<style>
	.increase-contrast-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sy-space--large);
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
	}
	.increase-contrast-settings > label {
		flex: 1 1 14rem;
		min-width: 0;
		font-weight: var(--sy-font-weight--bold);
		cursor: pointer;
	}
	.increase-contrast-settings--mobile {
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
