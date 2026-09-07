<script lang="ts">
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import DatabaseMigrationPreview from '@/components/SettingsOption/DatabaseMigrationPreview.svelte';
	import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import {
		isDevBuild,
		resolveIsDevBuild,
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
		updateHskVariantPreference,
		updateToneColorsPreference,
	} from '@/composables/settings.js';

	type SettingsTab = 'general' | 'telemetry' | 'acknowledgements';

	let activeTab = $state(settingsActiveTabStore.value as SettingsTab);
	let showDevPreferences = $state(isDevBuild());

	function setActiveTab(tab: SettingsTab): void {
		activeTab = tab;
		settingsActiveTabStore.set(tab);
	}

	onMount(() => {
		resolveIsDevBuild()
			.then((devBuild) => {
				showDevPreferences = devBuild;
				return undefined;
			})
			.catch(() => {});
	});
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
			{#if showDevPreferences}
				<section class="mobile-settings__section" aria-labelledby="migration-heading">
					<h2 id="migration-heading">Database Migration</h2>
					<DatabaseMigrationPreview />
				</section>
				<section
					class="mobile-settings__section"
					aria-labelledby="replay-onboarding-heading"
				>
					<h2 id="replay-onboarding-heading">Replay onboarding</h2>
					<p>Show first-run setup again. Your words and documents are kept.</p>
					<SyButton
						style="filled"
						onclick={() => privacySettingsStore.requestOnboardingReplay()}
					>
						Show again
					</SyButton>
				</section>
			{/if}
		{:else if activeTab === 'telemetry'}
			{#if privacySettingsStore.childPrivacyMode}
				<AgeStatusSettings variant="mobile" />
			{/if}
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

	.mobile-settings__section p {
		margin: 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}
</style>
