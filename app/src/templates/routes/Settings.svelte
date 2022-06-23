<script>
import SyToggle from '../components/SyToggle/SyToggle.svelte';
import ToneColorPicker from '../components/SettingsOption/ToneColorPicker.svelte';
const isMacos = process.platform === 'darwin';

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
		label: 'Tone Colors',
		centerLabel: false,
		handler: e => window.preferenceManager.set('tone-colors', e.detail),
		component: ToneColorPicker,
		props: {}
	}
];

// Load system specific preferences
if (isMacos) {
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
.settings--title--macos {
	-webkit-app-region: drag;
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
	<div class="settings--title" class:settings--title--macos={isMacos}>
		<h1>Settings</h1>
	</div>
	<div class="settings--content">
		{#each preferences as preference}
			<div class="settings--setting" class:settings--setting--center={ preference.centerLabel }>
				<p>{ preference.label }</p>
				<svelte:component this={ preference.component } on:change={ preference.handler } {...preference.props} />
			</div>
		{/each}
	</div>
</div>
