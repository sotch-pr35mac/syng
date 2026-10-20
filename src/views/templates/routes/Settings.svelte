<script>
	import WalkthroughSettings from '@/components/Walkthrough/WalkthroughSettings.svelte';
	import WalkthroughReset from '@/components/Walkthrough/WalkthroughReset.svelte';

	import { onMount } from 'svelte';
	import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
	import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import DictionaryMetadataSettings from '@/components/SettingsOption/DictionaryMetadataSettings.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import UpdateChecker from '@/components/SettingsOption/UpdateChecker.svelte';
	import DatabaseMigrationPreview from '@/components/SettingsOption/DatabaseMigrationPreview.svelte';
	import BookmarkRecoverySettings from '@/components/SettingsOption/BookmarkRecoverySettings.svelte';
	import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
	import { handleError } from '@/utils/error.js';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';
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
		updateShowAlternativePronunciationsPreference,
		updateShowPartsOfSpeechPreference,
		updateShowQualifiersPreference,
		updateToneColorsPreference,
	} from '@/composables/settings.js';
	import { isIPad, isMobile } from '@/utils/device.js';
	import { getPreferenceManager } from '@/utils/appServices.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

	const isMacos = platform() === 'macos';

	let activeTab = $state(settingsActiveTabStore.value);
	let showDevPreferences = $state(isDevBuild());
	let isMasBuild = $state(false);
	let hasSavedRecoveryReport = $state(false);

	const preferences = [
		{
			label: 'Increase Contrast',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: true,
			component: IncreaseContrastSettings,
			props: { variant: isIPad() ? 'mobile' : 'desktop', showLabel: false },
		},
		...(isMobile()
			? [
					{
						label: 'Bookmark Recovery',
						devOnly: false,
						hideOnIPad: false,
						hideOnMas: false,
						requiresSavedRecoveryReport: true,
						centerLabel: true,
						component: BookmarkRecoverySettings,
						props: {},
					},
				]
			: []),
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
				accessibleLabel: 'Under Construction Features',
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
			label: 'Dictionary Metadata',
			devOnly: false,
			hideOnIPad: false,
			hideOnMas: false,
			centerLabel: false,
			component: DictionaryMetadataSettings,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				onqualifierschange: updateShowQualifiersPreference,
				onpartsofspeechchange: updateShowPartsOfSpeechPreference,
				onalternativepronunciationschange: updateShowAlternativePronunciationsPreference,
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
				(!preference.requiresSavedRecoveryReport || hasSavedRecoveryReport) &&
				(!preference.hideOnIPad || !isIPad()) &&
				(!preference.hideOnMas || !isMasBuild)
		)
	);

	onMount(() => {
		let mounted = true;
		if (isMobile()) {
			bookmarkRecoveryStore
				.hasSaved()
				.then((hasSaved) => {
					if (mounted) {
						hasSavedRecoveryReport = hasSaved;
					}
					return undefined;
				})
				.catch((error) => {
					handleError('Could not check for bookmark recovery reports.', error);
				});
		}
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
		return () => {
			mounted = false;
		};
	});
</script>

<div
	class="settings--container"
	use:responsiveLayout={{ thresholdRem: 36, className: 'settings--compact' }}
>
	<div
		class="settings--title"
		class:settings--title--ipad={isIPad()}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
	</div>
	<div class="settings--tabs" role="tablist" aria-label="Settings sections" use:tabNavigation>
		<SyTab
			role="tab"
			id="settings-general-tab"
			aria-controls="settings-panel"
			active={activeTab === 'general'}
			onclick={() => {
				activeTab = 'general';
				settingsActiveTabStore.set('general');
			}}
		>
			General
		</SyTab>
		<SyTab
			role="tab"
			id="settings-telemetry-tab"
			aria-controls="settings-panel"
			active={activeTab === 'telemetry'}
			onclick={() => {
				activeTab = 'telemetry';
				settingsActiveTabStore.set('telemetry');
			}}
		>
			Telemetry
		</SyTab>
		<SyTab
			role="tab"
			id="settings-acknowledgements-tab"
			aria-controls="settings-panel"
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
		<div
			role="tabpanel"
			id="settings-panel"
			aria-labelledby={`settings-${activeTab}-tab`}
			tabindex="0"
			class="settings--panel"
		>
			{#if activeTab === 'general'}
				<WalkthroughSettings />
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
					<div class="settings--setting">
						<p>Feature tour testing</p>
						<WalkthroughReset />
					</div>
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
		flex-wrap: wrap;
		display: flex;
		gap: var(--sy-space--large);
		padding: 0 var(--sy-space);
		border-bottom: var(--sy-border);
		margin-bottom: var(--sy-space--extra-large);
	}
	.settings--content {
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		overflow-y: auto;
		flex: 1;
		padding-bottom: var(--sy-space--extra-large);
	}
	.settings--setting {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--sy-space--large);
		align-items: start;
	}
	.settings--panel {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}
	:global(.settings--compact) .settings--setting {
		grid-template-columns: minmax(0, 1fr);
	}
	.settings--setting--center {
		align-items: center;
	}
</style>
