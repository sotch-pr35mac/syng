<script lang="ts">
	import { onMount } from 'svelte';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { handleError } from '@/utils/error.js';
	import { loadRegionOptions } from '@/utils/regions.js';
	import type { RegionOption } from '@/types/privacy.js';

	const ISO_3166_URL = 'https://www.iso.org/iso-3166-country-codes.html';

	interface Props {
		selectedRegionCode?: string | null;
		onselect?: (regionCode: string) => void;
	}

	const { selectedRegionCode = null, onselect }: Props = $props();
	let regions = $state<readonly RegionOption[]>([]);
	let loading = $state(true);
	let loadFailed = $state(false);

	async function loadRegions(): Promise<void> {
		loading = true;
		loadFailed = false;
		try {
			regions = await loadRegionOptions();
		} catch (error) {
			loadFailed = true;
			handleError('Failed to load country and region options.', error, { silent: true });
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadRegions().catch(() => {});
	});

	function handleChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value) {
			onselect?.(select.value);
		}
	}

	function handleIsoLinkClick(event: MouseEvent): void {
		event.preventDefault();
		openUrl(ISO_3166_URL).catch(() => {
			window.open(ISO_3166_URL, '_blank', 'noopener,noreferrer');
		});
	}
</script>

<div class="region-selector">
	<label class="region-selector__label" for="onboarding-region-select">Country or region</label>
	<select
		id="onboarding-region-select"
		class="region-selector__select"
		value={selectedRegionCode ?? ''}
		onchange={handleChange}
		disabled={loading || loadFailed}
	>
		<option value="" disabled>
			{loading
				? 'Loading countries and regions…'
				: loadFailed
					? 'Countries and regions unavailable'
					: 'Select a country or region'}
		</option>
		{#each regions as region (region.code)}
			<option value={region.code}>{region.name}</option>
		{/each}
	</select>
	{#if loadFailed}
		<button class="region-selector__retry" type="button" onclick={() => loadRegions()}
			>Retry</button
		>
	{/if}
	<p class="region-selector__attribution">
		Country and region codes from
		<a href={ISO_3166_URL} onclick={handleIsoLinkClick}>ISO 3166</a>.
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

	.region-selector__attribution {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}

	.region-selector__attribution a {
		color: var(--sy-color--blue-2);
		text-decoration: underline;
	}

	.region-selector__retry {
		align-self: flex-start;
		font: inherit;
		color: var(--sy-color--blue-2);
		background: none;
		border: 0;
		padding: 0;
		text-decoration: underline;
		cursor: pointer;
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
