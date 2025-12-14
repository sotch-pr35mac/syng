<script>
import ToneColorPicker from '../components/SettingsOption/ToneColorPicker.svelte';
import UpdateChecker from '../components/SettingsOption/UpdateChecker.svelte';
import SyToggle from '../components/SyToggle/SyToggle.svelte';
import { platform } from '@tauri-apps/plugin-os';

const isMacos = platform() === 'macos';

const preferences = [
	{
		label: 'Under Construction Features',
		centerLabel: true,
		component: SyToggle,
		props: {
			checked: window.preferenceManager.get('beta'),
			onchange: (checked) => window.preferenceManager.set('beta', checked),
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
			onchange: (data) => window.preferenceManager.set('toneColors', data),
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
  <div
    class="settings--title"
    data-tauri-drag-region={isMacos ? true : undefined}
  >
    <h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
  </div>
  <div class="settings--content">
    {#each preferences as preference (preference.label)}
      <div
        class="settings--setting"
        class:settings--setting--center={preference.centerLabel}
      >
        <p>{preference.label}</p>
        <preference.component {...preference.props} />
      </div>
    {/each}
  </div>
</div>

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
