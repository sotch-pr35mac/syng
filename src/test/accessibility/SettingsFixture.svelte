<script lang="ts">
	import { onMount } from 'svelte';
	import Settings from '@/routes/Settings.svelte';
	import MobileSettings from '@/routes/mobile/MobileSettings.svelte';
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { setPreferenceManagerForTest } from '@/utils/appServices.js';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { contrastStore } from '@/stores/contrast.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';

	const parameters = new URLSearchParams(location.search);
	const mobile = parameters.has('mobile');
	const preferences: Record<string, unknown> = {
		increaseContrast: parameters.get('appearance') === 'contrast',
		toneColors: {
			hasCustomColors: false,
			colors: ['#3366ff', '#ffcc00', '#ff3333', '#33aa66', '#777777'],
		},
	};
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) => preferences[key],
		set: (key: string, value: unknown) => {
			preferences[key] = value;
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (command: string) => {
			if (command === 'read_bookmark_recovery_report') {
				await new Promise((resolve) =>
					setTimeout(resolve, Number(parameters.get('delay')) || 0)
				);
				return parameters.has('recovery') ? 'Saved recovery report' : null;
			}
			if (command === 'is_mas_build') return parameters.has('mas');
			if (command === 'get_acknowledgements') {
				await new Promise((resolve) =>
					setTimeout(resolve, Number(parameters.get('delay')) || 0)
				);
				return parameters.has('acknowledgements')
					? Array.from({ length: 30 }, (_entry, index) => ({
							name: `Example library ${index + 1}`,
							license: 'MIT',
							text: 'Example license text.',
						}))
					: [];
			}
			if (command === 'plugin:app|version') return '2.6.0';
			if (command === 'telemetry_get_prefs')
				return {
					enabled: false,
					track_events: false,
					track_screen_views: false,
					track_errors: false,
					include_device_context: false,
				};
			if (command === 'telemetry_get_queued_events') return [];
			return false;
		},
	});
	void dictionaryDisplaySettingsStore.loadSettings();
	void contrastStore.loadSettings();
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 1,
	});
	let showingSettings = $state(true);
	onMount(() => {
		const updateRoute = () => {
			showingSettings = location.hash === '#/settings';
		};
		window.addEventListener('hashchange', updateRoute);
		return () => window.removeEventListener('hashchange', updateRoute);
	});
</script>

<div class="shell" class:mobile>
	{#if mobile}<MobileNavigation />{:else}<aside><Navigation /></aside>{/if}
	<main aria-label="Settings fixture">
		{#if showingSettings}
			{#if mobile}<MobileSettings />{:else}<Settings />{/if}
		{:else}
			<SyButton
				onclick={() => {
					location.hash = '#/settings';
				}}>Return to Settings</SyButton
			>
		{/if}
	</main>
</div>

<style>
	.shell {
		display: flex;
		height: 100vh;
	}
	.shell.mobile {
		flex-direction: column;
	}
	aside {
		width: 92px;
		flex-shrink: 0;
	}
	main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	main :global(.settings--container) {
		height: 100%;
	}
</style>
