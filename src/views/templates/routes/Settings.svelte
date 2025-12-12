<script>
import ToneColorPicker from '../components/SettingsOption/ToneColorPicker.svelte';
import UpdateChecker from '../components/SettingsOption/UpdateChecker.svelte';
import SyToggle from '../components/SyToggle/SyToggle.svelte';
const isMacos = window.platform === 'darwin';

let preferences = [
	{
		label: 'Under Construction Features',
		centerLabel: true,
		handler: e => window.preferenceManager.set('beta', e.detail),
		component: SyToggle,
		props: {
			checked: window.preferenceManager.get('beta')
		}
	},
	{
		label: 'Updates',
		centerLabel: false,
		component: UpdateChecker,
		props: {},
		handler: () => undefined
	},
	{
		label: 'Tone Colors',
		centerLabel: false,
		handler: e => window.preferenceManager.set('toneColors', e.detail),
		component: ToneColorPicker,
		props: {}
	}
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

<style>
.settings--container {
	padding: 0px var(--sy-space--extra-large);
	background-color: var(--sy-color--white);
	overflow: hidden;
	width: -webkit-fill-available;
}
.settings--title {
	padding: var(--sy-space--extra-large) var(--sy-space);
}
.settings--content {
	display: flex;
	flex-direction: column;
	gap: var(--sy-space--extra-large);
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

<div class="settings--container">
	<div class="settings--title" data-tauri-drag-region={isMacos ? true : undefined}>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
	</div>
	<div class="settings--content">
		{#each preferences as preference}
			<div class="settings--setting" class:settings--setting--center={ preference.centerLabel }>
				<p>{ preference.label }</p>
				<preference.component on:change={ preference.handler } {...preference.props} />
			</div>
		{/each}
	</div>
</div>