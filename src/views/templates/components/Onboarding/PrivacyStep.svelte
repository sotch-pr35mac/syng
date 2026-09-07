<script lang="ts">
	import RegionSelector from '@/components/Onboarding/RegionSelector.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import { onboardingStore } from '@/stores/onboarding.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { privacyPolicyFor } from '@/utils/privacyPolicy.js';
	import { handleError } from '@/utils/error.js';
	import {
		exampleTelemetryEnvelopes,
		telemetry,
		type TelemetryPrefs,
	} from '@/utils/telemetry.js';
	import { onMount } from 'svelte';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const { variant = 'desktop' }: Props = $props();

	let telemetryPrefs = $state<TelemetryPrefs>({
		enabled: true,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	});

	const policy = $derived(privacyPolicyFor(privacySettingsStore.regionCode));
	const showAgeQuestion = $derived(
		privacySettingsStore.regionCode !== null && policy.ageThreshold !== null
	);
	const showTelemetry = $derived(
		privacySettingsStore.regionCode !== null &&
			(policy.ageThreshold === null || onboardingStore.isBelowApplicableAge !== null)
	);
	const telemetryLocked = $derived(privacySettingsStore.childPrivacyMode);
	const exampleEnvelopes = $derived(
		telemetryLocked ? [] : exampleTelemetryEnvelopes(telemetryPrefs)
	);
	const ageQuestion = $derived(
		policy.ageThreshold === null
			? ''
			: `Are you below the age of ${policy.ageThreshold} for this region?`
	);

	onMount(() => {
		telemetry
			.getPrefs()
			.then((prefs) => {
				telemetryPrefs = prefs;
				return undefined;
			})
			.catch((error) => {
				handleError('Failed to load telemetry preferences.', error, { silent: true });
			});
	});

	$effect(() => {
		void privacySettingsStore.childPrivacyMode;
		telemetry
			.getPrefs()
			.then((prefs) => {
				telemetryPrefs = prefs;
				return undefined;
			})
			.catch(() => {});
	});

	function handleTelemetryPref(key: keyof TelemetryPrefs, enabled: boolean): void {
		if (telemetryLocked) {
			return;
		}
		telemetryPrefs = { ...telemetryPrefs, [key]: enabled };
		telemetry
			.setPref(key, enabled)
			.catch((error) =>
				handleError('Failed to set telemetry preference.', error, { silent: true })
			);
	}
</script>

<div class="privacy-step" class:privacy-step--mobile={variant === 'mobile'}>
	<h2 class="privacy-step__title">Privacy</h2>
	<p class="privacy-step__intro">
		Choose your region so Syng can apply the right privacy defaults.
	</p>

	<RegionSelector
		selectedRegionCode={privacySettingsStore.regionCode}
		onselect={(regionCode) => onboardingStore.selectRegion(regionCode)}
	/>

	{#if showAgeQuestion}
		<fieldset class="privacy-step__age">
			<legend>{ageQuestion}</legend>
			<div class="privacy-step__age-actions">
				<SyButton
					style={onboardingStore.isBelowApplicableAge === true ? 'filled' : 'ghost'}
					color="blue"
					aria-pressed={onboardingStore.isBelowApplicableAge === true}
					classes={onboardingStore.isBelowApplicableAge === true
						? ['privacy-step__age-button--selected']
						: []}
					onclick={() => onboardingStore.setIsBelowApplicableAge(true)}
				>
					Yes
				</SyButton>
				<SyButton
					style={onboardingStore.isBelowApplicableAge === false ? 'filled' : 'ghost'}
					color="blue"
					aria-pressed={onboardingStore.isBelowApplicableAge === false}
					classes={onboardingStore.isBelowApplicableAge === false
						? ['privacy-step__age-button--selected']
						: []}
					onclick={() => onboardingStore.setIsBelowApplicableAge(false)}
				>
					No
				</SyButton>
			</div>
		</fieldset>
	{/if}

	{#if showTelemetry}
		<div class="privacy-step__telemetry">
			<p class="privacy-step__disclosure">
				We hate creepy data collection, and you should too! That's why Syng's telemetry
				service is designed to be open and transparent. You can inspect and change this
				later in Settings → Telemetry. You can opt out of telemetry in part or in full at
				any time. Telemetry data is used only to diagnose issues, improve compatibility, and
				better understand how the app is used. It's accessible only to the project
				maintainer and is never used for advertising or shared with third parties.
			</p>
			{#if telemetryLocked}
				<p class="privacy-step__locked">
					Telemetry is turned off while additional privacy protections apply.
				</p>
			{/if}
			<div class="privacy-step__toggle">
				<div>
					<p class="privacy-step__toggle-label">Enable Telemetry</p>
					<p class="privacy-step__toggle-description">Allow Syng to collect usage data</p>
				</div>
				<SyToggle
					value="enabled"
					accessibleLabel="Enable Telemetry"
					checked={telemetryLocked ? false : telemetryPrefs.enabled}
					disabled={telemetryLocked}
					onchange={(enabled) => handleTelemetryPref('enabled', enabled)}
				/>
			</div>
			{#if telemetryPrefs.enabled && !telemetryLocked}
				<div class="privacy-step__categories">
					<div class="privacy-step__toggle">
						<div>
							<p class="privacy-step__toggle-label">Event Tracking</p>
							<p class="privacy-step__toggle-description">
								Feature usage, settings changes, etc
							</p>
						</div>
						<SyToggle
							value="track_events"
							accessibleLabel="Event Tracking"
							checked={telemetryPrefs.track_events}
							onchange={(enabled) => handleTelemetryPref('track_events', enabled)}
						/>
					</div>
					<div class="privacy-step__toggle">
						<div>
							<p class="privacy-step__toggle-label">Screen Views</p>
							<p class="privacy-step__toggle-description">
								Which app screens are visited
							</p>
						</div>
						<SyToggle
							value="track_screen_views"
							accessibleLabel="Screen Views"
							checked={telemetryPrefs.track_screen_views}
							onchange={(enabled) =>
								handleTelemetryPref('track_screen_views', enabled)}
						/>
					</div>
					<div class="privacy-step__toggle">
						<div>
							<p class="privacy-step__toggle-label">Error Reporting</p>
							<p class="privacy-step__toggle-description">
								Application errors and failures
							</p>
						</div>
						<SyToggle
							value="track_errors"
							accessibleLabel="Error Reporting"
							checked={telemetryPrefs.track_errors}
							onchange={(enabled) => handleTelemetryPref('track_errors', enabled)}
						/>
					</div>
					<div class="privacy-step__toggle">
						<div>
							<p class="privacy-step__toggle-label">Device Context</p>
							<p class="privacy-step__toggle-description">
								OS version, architecture, locale, and timezone for compatibility
								analysis
							</p>
						</div>
						<SyToggle
							value="include_device_context"
							accessibleLabel="Device Context"
							checked={telemetryPrefs.include_device_context}
							onchange={(enabled) =>
								handleTelemetryPref('include_device_context', enabled)}
						/>
					</div>
				</div>
			{/if}
			<div class="privacy-step__payloads">
				<p class="privacy-step__payloads-label">Example payloads</p>
				{#if exampleEnvelopes.length === 0}
					<p class="privacy-step__payloads-empty">
						No telemetry is sent with these settings.
					</p>
				{:else}
					{#each exampleEnvelopes as envelope (envelope.id)}
						<pre class="privacy-step__payload sy-text--selectable">{JSON.stringify(
								envelope,
								null,
								2
							)}</pre>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.privacy-step {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}

	.privacy-step__title {
		margin: 0;
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
	}

	.privacy-step__intro {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.privacy-step__age {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}

	.privacy-step__age legend {
		padding: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.privacy-step__age-actions {
		display: flex;
		gap: var(--sy-space--large);
	}

	:global(.privacy-step__age-button--selected.sy-button--filled) {
		background-color: var(--sy-color--blue-2);
		color: var(--sy-color--white);
	}

	.privacy-step__telemetry {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}

	.privacy-step__disclosure,
	.privacy-step__locked,
	.privacy-step__toggle-description,
	.privacy-step__payloads-empty {
		margin: 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.privacy-step__disclosure {
		padding: var(--sy-space--extra-large);
		background-color: var(--sy-color--grey-2);
		border-radius: var(--sy-border-radius);
	}

	.privacy-step__categories {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		padding-left: var(--sy-space--extra-large);
		border-left: 2px solid var(--sy-color--grey-2);
	}

	.privacy-step__toggle {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--sy-space--large);
		align-items: center;
	}

	.privacy-step__toggle-label {
		margin: 0 0 var(--sy-space--small) 0;
		font-size: var(--sy-font-size--medium);
	}

	.privacy-step__payloads {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.privacy-step__payloads-label {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.privacy-step__payload {
		margin: 0;
		padding: var(--sy-space--large);
		background-color: var(--sy-color--grey-2);
		border-radius: var(--sy-border-radius);
		font-size: 11px;
		line-height: 1.5;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.privacy-step--mobile .privacy-step__title {
		font-size: var(--sy-font-size--mobile-extra-large);
	}

	.privacy-step--mobile .privacy-step__intro,
	.privacy-step--mobile .privacy-step__age legend,
	.privacy-step--mobile .privacy-step__toggle-label {
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
