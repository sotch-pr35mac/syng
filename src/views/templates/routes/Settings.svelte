<script>
	import { onMount } from 'svelte';
	import ToneColorPicker from '../components/SettingsOption/ToneColorPicker.svelte';
	import UpdateChecker from '../components/SettingsOption/UpdateChecker.svelte';
	import TelemetrySettings from '../components/TelemetrySettings/TelemetrySettings.svelte';
	import SyTab from '../components/SyTab/SyTab.svelte';
	import SyToggle from '../components/SyToggle/SyToggle.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { settingsActiveTabStore } from '../stores/settings.svelte.js';
	import { scrollRestore } from '../actions/scrollRestore.svelte.js';
	import {
		isDevBuild,
		resolveIsDevBuild,
		updateBetaPreference,
		updateToneColorsPreference,
	} from '../composables/settings.js';
	import { isIPad } from '../utils/device.js';

	const isMacos = platform() === 'macos';

	let activeTab = $state(settingsActiveTabStore.value);
	let showDevPreferences = $state(isDevBuild());

	const preferences = [
		{
			label: 'Under Construction Features',
			devOnly: true,
			centerLabel: true,
			component: SyToggle,
			props: {
				checked: window.preferenceManager.get('beta'),
				onchange: updateBetaPreference,
			},
		},
		{
			label: 'Updates',
			devOnly: false,
			hideOnIPad: true,
			centerLabel: false,
			component: UpdateChecker,
			props: {},
		},
		{
			label: 'Tone Colors',
			devOnly: false,
			centerLabel: false,
			component: ToneColorPicker,
			props: {
				variant: isIPad() ? 'mobile' : 'desktop',
				onchange: updateToneColorsPreference,
			},
		},
	];

	const visiblePreferences = $derived(
		preferences.filter(
			(preference) =>
				(!preference.devOnly || showDevPreferences) && (!preference.hideOnIPad || !isIPad())
		)
	);

	onMount(() => {
		resolveIsDevBuild()
			.then((devBuild) => {
				showDevPreferences = devBuild;
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
		{:else}
			<TelemetrySettings />
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
		padding-top: var(--sy-space--large);
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
