<script lang="ts">
	import SyTab from '../../components/SyTab/SyTab.svelte';
	import ToneColorPicker from '../../components/SettingsOption/ToneColorPicker.svelte';
	import TelemetrySettings from '../../components/TelemetrySettings/TelemetrySettings.svelte';
	import { settingsActiveTabStore } from '../../stores/settings.svelte.js';
	import { updateToneColorsPreference } from '../../composables/settings.js';

	type SettingsTab = 'general' | 'telemetry';

	let activeTab = $state(settingsActiveTabStore.value as SettingsTab);

	function setActiveTab(tab: SettingsTab): void {
		activeTab = tab;
		settingsActiveTabStore.set(tab);
	}
</script>

<div class="mobile-settings">
	<header class="mobile-settings__header">
		<div class="mobile-settings__tabs" aria-label="Settings sections">
			<SyTab
				variant="mobile"
				active={activeTab === 'general'}
				onclick={() => setActiveTab('general')}
			>
				General
			</SyTab>
			<SyTab
				variant="mobile"
				active={activeTab === 'telemetry'}
				onclick={() => setActiveTab('telemetry')}
			>
				Telemetry
			</SyTab>
		</div>
	</header>

	<div class="mobile-settings__content">
		{#if activeTab === 'general'}
			<section class="mobile-settings__section" aria-labelledby="tone-colors-heading">
				<h2 id="tone-colors-heading">Tone Colors</h2>
				<ToneColorPicker variant="mobile" onchange={updateToneColorsPreference} />
			</section>
		{:else}
			<TelemetrySettings variant="mobile" />
		{/if}
	</div>
</div>

<style>
	.mobile-settings {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-settings__header {
		display: flex;
		flex-direction: column;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
		background-color: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
		flex-shrink: 0;
	}

	.mobile-settings__tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
	}

	.mobile-settings__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
	}

	.mobile-settings__section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--medium);
	}

	.mobile-settings__section h2 {
		margin: 0;
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--bold);
	}
</style>
