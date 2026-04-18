<script>
	import ToneColorPicker from '../components/SettingsOption/ToneColorPicker.svelte';
	import UpdateChecker from '../components/SettingsOption/UpdateChecker.svelte';
	import TelemetrySettings from '../components/TelemetrySettings/TelemetrySettings.svelte';
	import SyTab from '../components/SyTab/SyTab.svelte';
	import SyToggle from '../components/SyToggle/SyToggle.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { telemetry } from '../utils';

	const isMacos = platform() === 'macos';

	let activeTab = $state('general');

	const preferences = [
		{
			label: 'Under Construction Features',
			centerLabel: true,
			component: SyToggle,
			props: {
				checked: window.preferenceManager.get('beta'),
				onchange: (checked) => {
					window.preferenceManager.set('beta', checked);
					telemetry.trackEvent('settings.changed', { setting: 'beta' }).catch(() => {});
				},
			},
		},
		{
			label: 'Updates',
			centerLabel: false,
			component: UpdateChecker,
			props: {},
		},
		{
			label: 'Tone Colors',
			centerLabel: false,
			component: ToneColorPicker,
			props: {
				onchange: (data) => {
					window.preferenceManager.set('toneColors', data);
					telemetry
						.trackEvent('settings.changed', { setting: 'toneColors' })
						.catch(() => {});
				},
			},
		},
	];

	/* Disabling transparency for the time being since Tauri handles it a bit differently than Electron */
	/*
if(isMacos) {
	const macOSPreferences = [
		{
			label: 'Transparency',
			centerLabel: true,
			handler: e => window.preferenceManager.set('transparency', e.detail),
			component: SyToggle,
			props: {
				checked: window.preferenceManager.get('transparency')
			}
		},
	];

	preferences = [...macOSPreferences, ...preferences];
}
*/
</script>

<div class="settings--container">
	<div class="settings--title" data-tauri-drag-region={isMacos ? true : undefined}>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
	</div>
	<div class="settings--tabs">
		<SyTab active={activeTab === 'general'} onclick={() => (activeTab = 'general')}>
			General
		</SyTab>
		<SyTab active={activeTab === 'telemetry'} onclick={() => (activeTab = 'telemetry')}>
			Telemetry
		</SyTab>
	</div>
	<div class="settings--content">
		{#if activeTab === 'general'}
			{#each preferences as preference (preference.label)}
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
