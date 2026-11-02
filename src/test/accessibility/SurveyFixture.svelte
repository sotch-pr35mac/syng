<script lang="ts">
	import OnboardingFlow from '@/components/Onboarding/OnboardingFlow.svelte';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { setPreferenceManagerForTest } from '@/utils/appServices.js';
	const preferences: Record<string, unknown> = {};
	setPreferenceManagerForTest({
		get: (key: string) => preferences[key],
		set: (key: string, value: unknown) => {
			preferences[key] = value;
		},
		waitForInit: async () => {},
	} as never);
	privacySettingsStore.setPrivacySettingsForTest({ completedOnboardingVersion: 2 });
	const variant = new URLSearchParams(location.search).has('mobile') ? 'mobile' : 'desktop';
</script>

<div class="survey-fixture"><OnboardingFlow {variant} /></div>

<style>
	.survey-fixture {
		height: 100dvh;
	}
</style>
