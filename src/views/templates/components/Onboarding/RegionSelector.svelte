<script lang="ts">
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { REGION_OPTIONS, regionNameFor } from '@/utils/privacyPolicy.js';

	const CLDR_HOME_URL = 'https://cldr.unicode.org/';

	interface Props {
		selectedRegionCode?: string | null;
		onselect?: (regionCode: string) => void;
	}

	const { selectedRegionCode = null, onselect }: Props = $props();
	const selectedName = $derived(regionNameFor(selectedRegionCode));

	function handleChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value) {
			onselect?.(select.value);
		}
	}

	function handleCldrLinkClick(event: MouseEvent): void {
		event.preventDefault();
		openUrl(CLDR_HOME_URL).catch(() => {
			window.open(CLDR_HOME_URL, '_blank', 'noopener,noreferrer');
		});
	}
</script>

<div class="region-selector">
	<label class="region-selector__label" for="onboarding-region-select">Country or region</label>
	{#if selectedName}
		<p class="region-selector__selected">
			Selected: {selectedName}
		</p>
	{/if}
	<select
		id="onboarding-region-select"
		class="region-selector__select"
		value={selectedRegionCode ?? ''}
		onchange={handleChange}
	>
		<option value="" disabled>Select a country or region</option>
		{#each REGION_OPTIONS as region (region.code)}
			<option value={region.code}>{region.name}</option>
		{/each}
	</select>
	<p class="region-selector__attribution">
		Country and region names from
		<a href={CLDR_HOME_URL} onclick={handleCldrLinkClick}>Unicode CLDR</a>.
	</p>
</div>

<style>
	.region-selector {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.region-selector__label {
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.region-selector__selected,
	.region-selector__attribution {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}

	.region-selector__attribution a {
		color: var(--sy-color--blue-2);
		text-decoration: underline;
	}

	.region-selector__select {
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--medium);
		color: var(--sy-color--black);
		background-color: var(--sy-color--white);
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space--large);
		min-height: var(--sy-mobile-touch-target);
		box-shadow: var(--sy-inner-shadow);
	}
</style>
