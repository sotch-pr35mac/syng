<script>
	import { onMount } from 'svelte';
	import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import UpdateChecker from '@/components/SettingsOption/UpdateChecker.svelte';
	import DatabaseMigrationPreview from '@/components/SettingsOption/DatabaseMigrationPreview.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { settingsActiveTabStore } from '@/stores/settings.svelte.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import {
		isDevBuild,
		resolveIsDevBuild,
		resolveIsMasBuild,
		updateBetaPreference,
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
		updateHskVariantPreference,
		updateToneColorsPreference,
	} from '@/composables/settings.js';
	import { isIPad } from '@/utils/device.js';
	import { getPreferenceManager } from '@/utils/appServices.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

	const isMacos = platform() === 'macos';

	let activeTab = $state(settingsActiveTabStore.value);
	let showDevPreferences = $state(isDevBuild());
	let isMasBuild = $state(false);

	const preferences = [
		{
			label: 'HSK',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: false,
			component: HskVariantSelector,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				onchange: updateHskVariantPreference,
			},
		},
		{
			label: 'Under Construction Features',
			devOnly: true,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: true,
			component: SyToggle,
			props: {
				checked: getPreferenceManager().get('beta'),
				onchange: updateBetaPreference,
			},
		},
		{
			label: 'Updates',
			devOnly: false,
			hideOnIPad: true,
			hideOnMas: true,
			centerLabel: false,
			component: UpdateChecker,
			props: {},
		},
		{
			label: 'Characters',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: false,
			component: CharacterSetSelector,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				onchange: updateCharacterSetPreference,
			},
		},
		{
			label: 'Tone Coloring',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: false,
			component: ToneColoringSettings,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				oncharacterschange: updateColorCharactersByTonePreference,
				onpinyinchange: updateColorPinyinByTonePreference,
				onlistschange: updateColorListsByTonePreference,
			},
		},
		{
			label: 'Tone Colors',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: false,
			component: ToneColorPicker,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				onchange: updateToneColorsPreference,
			},
		},
		{
			label: 'Database Migration',
			devOnly: true,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: true,
			component: DatabaseMigrationPreview,
			props: {},
		},
	];

	const visiblePreferences = $derived(
		preferences.filter(
			(preference) =>
				(!preference.devOnly || showDevPreferences) &&
				(!preference.hideOnIPad || !isIPad()) &&
				(!preference.hideOnMas || !isMasBuild)
		)
	);

	onMount(() => {
		resolveIsDevBuild()
			.then((devBuild) => {
				showDevPreferences = devBuild;
				return undefined;
			})
			.catch(() => {});
		resolveIsMasBuild()
			.then((masBuild) => {
				isMasBuild = masBuild;
				return undefined;
			})
			.catch(() => {});
	});
</script>

<div class="settings--container">
	<div
		class="settings--title"
		class:settings--title--ipad={isIPad()}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
	</div>
	<div class="settings--tabs">
		<SyTab
			active={activeTab === 'general'}
			onclick={() => {
				activeTab = 'general';
				settingsActiveTabStore.set('general');
			}}
		>
			General
		</SyTab>
		<SyTab
			active={activeTab === 'telemetry'}
			onclick={() => {
				activeTab = 'telemetry';
				settingsActiveTabStore.set('telemetry');
			}}
		>
			Telemetry
		</SyTab>
		<SyTab
			active={activeTab === 'acknowledgements'}
			onclick={() => {
				activeTab = 'acknowledgements';
				settingsActiveTabStore.set('acknowledgements');
			}}
		>
			Acknowledgements
		</SyTab>
	</div>
	<div class="settings--content" use:scrollRestore={'settings-content'}>
		{#if activeTab === 'general'}
			{#each visiblePreferences as preference (preference.label)}
				<div
					class="settings--setting"
					class:settings--setting--center={preference.centerLabel}
				>
					<p>{preference.label}</p>
					<preference.component {...preference.props} />
				</div>
			{/each}
			{#if showDevPreferences}
				<div class="settings--setting settings--setting--center">
					<p>Replay onboarding</p>
					<SyButton
						style="filled"
						onclick={() => privacySettingsStore.requestOnboardingReplay()}
					>
						Show again
					</SyButton>
				</div>
			{/if}
		{:else if activeTab === 'telemetry'}
			{#if privacySettingsStore.childPrivacyMode}
				<AgeStatusSettings />
			{:else}
				<TelemetrySettings />
			{/if}
		{:else}
			<Acknowledgements />
		{/if}
	</div>
</div>

<style>
	.settings--container {
		padding: 0px var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
		overflow: hidden;
		width: -webkit-fill-available;
		display: flex;
		flex-direction: column;
	}
	.settings--title {
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.settings--title--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.settings--tabs {
		display: flex;
		gap: var(--sy-space--large);
		padding: 0 var(--sy-space);
		border-bottom: var(--sy-border);
		margin-bottom: var(--sy-space--extra-large);
	}
	.settings--content {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		overflow-y: auto;
		flex: 1;
		padding-bottom: var(--sy-space--extra-large);
	}
	.settings--setting {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: start;
	}
	.settings--setting--center {
		align-items: center;
	}
</style>
