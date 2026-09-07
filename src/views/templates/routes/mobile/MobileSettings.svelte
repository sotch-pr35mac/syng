<script lang="ts">
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
	import {
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
		updateHskVariantPreference,
		updateToneColorsPreference,
	} from '@/composables/settings.js';

	type SettingsTab = 'general' | 'telemetry' | 'acknowledgements';

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
			<SyTab
				variant="mobile"
				active={activeTab === 'acknowledgements'}
				onclick={() => setActiveTab('acknowledgements')}
			>
				Acknowledgements
			</SyTab>
		</div>
	</header>

	<div class="mobile-settings__content">
		{#if activeTab === 'general'}
			<section class="mobile-settings__section" aria-labelledby="characters-heading">
				<h2 id="characters-heading">Characters</h2>
				<CharacterSetSelector variant="mobile" onchange={updateCharacterSetPreference} />
			</section>
			<section class="mobile-settings__section" aria-labelledby="hsk-heading">
				<h2 id="hsk-heading">HSK</h2>
				<HskVariantSelector variant="mobile" onchange={updateHskVariantPreference} />
			</section>
			<section class="mobile-settings__section" aria-labelledby="tone-coloring-heading">
				<h2 id="tone-coloring-heading">Tone Coloring</h2>
				<ToneColoringSettings
					variant="mobile"
					oncharacterschange={updateColorCharactersByTonePreference}
					onpinyinchange={updateColorPinyinByTonePreference}
					onlistschange={updateColorListsByTonePreference}
				/>
			</section>
			<section class="mobile-settings__section" aria-labelledby="tone-colors-heading">
				<h2 id="tone-colors-heading">Tone Colors</h2>
				<ToneColorPicker variant="mobile" onchange={updateToneColorsPreference} />
			</section>
		{:else if activeTab === 'telemetry'}
			<TelemetrySettings variant="mobile" />
		{:else}
			<Acknowledgements />
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
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-mobile-space--medium) * 3);
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
