<script lang="ts">
	import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';
	import { setPreferenceManagerForTest } from '@/utils/appServices.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';

	const mobile = new URLSearchParams(location.search).has('mobile');
	const preferences: Record<string, unknown> = {};
	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) => preferences[key],
		set: (key: string, value: unknown) => {
			preferences[key] = value;
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	Reflect.set(window, '__TAURI_INTERNALS__', {
		invoke: async (command: string) => {
			if (command === 'telemetry_get_prefs') {
				return { enabled: false };
			}
			if (command === 'get_region_options') {
				return [];
			}
			return false;
		},
	});
	privacySettingsStore.setPrivacySettingsForTest({
		childPrivacyMode: false,
		completedOnboardingVersion: 0,
	});
	void dictionaryDisplaySettingsStore.loadSettings();
</script>

<div class="onboarding-fixture">
	<OnboardingFlow variant={mobile ? 'mobile' : 'desktop'} />
</div>

<style>
	.onboarding-fixture {
		height: 100vh;
	}
</style>
