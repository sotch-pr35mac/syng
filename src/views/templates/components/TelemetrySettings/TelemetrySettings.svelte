<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { ChevronLeft } from 'lucide-svelte';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';
	import SyCollapsibleList from '@/components/SyCollapsibleList/SyCollapsibleList.svelte';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { telemetry, type TelemetryPrefs, type TelemetryEvent } from '@/utils/telemetry.js';
	import { handleError } from '@/utils/error.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { isAndroid } from '@/utils/device.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		onQueueChange?: (open: boolean) => void;
	}

	const TELEMETRY_REFRESH_INTERVAL_MS = 5000;
	const MAX_DISPLAY_EVENTS = 50;
	const QUEUE_PAGE_SIZE = 10;
	const PRIVACY_POLICY_URL = 'https://getsyng.com/privacy';
	const queueFamilies = [
		{ value: 'all', label: 'All' },
		{ value: 'event', label: 'Events' },
		{ value: 'screen_view', label: 'Screens' },
		{ value: 'error', label: 'Errors' },
	] as const;
	type QueueFamily = (typeof queueFamilies)[number]['value'];

	const { variant = 'desktop', onQueueChange }: Props = $props();
	const queueTriggerId = $props.id();

	let prefs = $state<TelemetryPrefs>({
		enabled: true,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	});

	let queuedEvents = $state<TelemetryEvent[]>([]);
	let queueSnapshot = $state<TelemetryEvent[]>([]);
	let showingQueue = $state(false);
	let queueSearch = $state('');
	let queueFamily = $state<QueueFamily>('all');
	let visibleLimit = $state(QUEUE_PAGE_SIZE);
	let queueHeading = $state<HTMLHeadingElement>();
	let savingPreference = $state(false);
	let preferenceError = $state('');
	let refreshInterval: ReturnType<typeof setInterval>;
	const telemetryLocked = $derived(privacySettingsStore.childPrivacyMode);
	const filteredEvents = $derived(
		queueSnapshot.filter(
			(event) =>
				(queueFamily === 'all' || event.family === queueFamily) &&
				event.name.toLocaleLowerCase().includes(queueSearch.trim().toLocaleLowerCase())
		)
	);
	const visibleEvents = $derived(filteredEvents.slice(0, visibleLimit));
	const hasQueueFilter = $derived(queueFamily !== 'all' || queueSearch.trim().length > 0);

	const openQueue = async () => {
		try {
			queueSnapshot = await telemetry.getQueuedEvents(MAX_DISPLAY_EVENTS);
			queuedEvents = queueSnapshot;
		} catch (_) {
			queueSnapshot = [...queuedEvents];
		}
		visibleLimit = QUEUE_PAGE_SIZE;
		showingQueue = true;
		onQueueChange?.(true);
		telemetry.trackScreen('settings_telemetry_queue').catch(() => {});
		await tick();
		queueHeading?.focus();
	};

	const closeQueue = async () => {
		showingQueue = false;
		onQueueChange?.(false);
		queueSnapshot = [];
		await tick();
		document.getElementById(queueTriggerId)?.focus();
	};

	const selectFamily = (family: QueueFamily) => {
		queueFamily = family;
		visibleLimit = QUEUE_PAGE_SIZE;
	};

	onMount(async () => {
		try {
			prefs = await telemetry.getPrefs();
		} catch (e) {
			handleError('Failed to load telemetry preferences.', e);
		}
		await refreshEvents();
		refreshInterval = setInterval(refreshEvents, TELEMETRY_REFRESH_INTERVAL_MS);
	});

	onDestroy(() => {
		clearInterval(refreshInterval);
	});

	$effect(() => {
		void privacySettingsStore.childPrivacyMode;
		telemetry
			.getPrefs()
			.then((nextPrefs) => {
				prefs = nextPrefs;
				return undefined;
			})
			.catch(() => {});
	});

	const refreshEvents = async () => {
		try {
			queuedEvents = await telemetry.getQueuedEvents(MAX_DISPLAY_EVENTS);
		} catch (_) {
			// noop
		}
	};

	const setPref = async (key: keyof TelemetryPrefs, value: boolean) => {
		if (telemetryLocked || savingPreference) {
			return;
		}
		const previousValue = prefs[key];
		savingPreference = true;
		preferenceError = '';
		prefs = { ...prefs, [key]: value };
		try {
			await telemetry.setPref(key, value);
		} catch (error) {
			// Native preferences remain unchanged when persistence fails.
			prefs = { ...prefs, [key]: previousValue };
			preferenceError =
				'Could not save the telemetry setting. The previous setting is still active. Please try again.';
			handleError('Failed to set telemetry preference.', error, { silent: true });
		} finally {
			savingPreference = false;
		}
	};

	const formatTimestamp = (ms: number) => {
		if (!ms) {
			return '';
		}
		return new Date(ms).toLocaleString();
	};

	const familyLabel = (family: string) => {
		switch (family) {
			case 'event':
				return 'Event';
			case 'screen_view':
				return 'Screen';
			case 'error':
				return 'Error';
			default:
				return family;
		}
	};

	const openPrivacyPolicy = (event: MouseEvent) => {
		event.preventDefault();
		openUrl(PRIVACY_POLICY_URL).catch(() => {
			window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer');
		});
	};
</script>

<div class="telemetry--container" class:telemetry--container--mobile={variant === 'mobile'}>
	{#if preferenceError}
		<p role="alert">{preferenceError}</p>
	{/if}
	{#if !showingQueue}
		<div class="telemetry--settings-view">
			<h2 class="telemetry--title">Telemetry</h2>
			<p class="telemetry--intro">
				Choose what Syng records, then inspect events waiting to be sent.
			</p>
			{#if isAndroid()}
				<p class="telemetry--privacy-notice">
					We respect your privacy.
					<a
						class="telemetry--privacy-link"
						href={PRIVACY_POLICY_URL}
						onclick={openPrivacyPolicy}>View our privacy policy to learn more.</a
					>
				</p>
			{/if}

			<div class="telemetry--disclosure">
				<p class="telemetry--disclosure-text">
					We love privacy, and you should too! That's why Syng's telemetry service is
					designed from the ground up to be open, transparent, and put you in control of
					your data. Telemetry data is used only to diagnose issues, improve platform
					compatibility, and better understand app usage. Telemetry data is accessible
					only to the project maintainer and is never shared with third parties or used
					for advertising. You can inspect telemetry payloads, and can opt out of
					telemetry in part or in full at any time.
				</p>
			</div>

			<section class="telemetry--choices" aria-labelledby="telemetry-choices-heading">
				<h3 class="telemetry--section-title" id="telemetry-choices-heading">
					Your choices
				</h3>
				<div class="telemetry--choices-surface">
					<div class="telemetry--setting telemetry--setting--center">
						<div>
							<p class="telemetry--setting-label">Enable Telemetry</p>
							<p class="telemetry--setting-description">
								Allow Syng to collect usage data. Disabling stops new usage events;
								queued events and preference changes can still be sent.
							</p>
						</div>
						<SyToggle
							value="enabled"
							accessibleLabel="Enable Telemetry"
							checked={telemetryLocked ? false : prefs.enabled}
							disabled={telemetryLocked || savingPreference}
							onchange={(checked) => setPref('enabled', checked)}
						/>
					</div>

					{#if prefs.enabled && !telemetryLocked}
						<div class="telemetry--categories">
							<div class="telemetry--setting telemetry--setting--center">
								<div>
									<p class="telemetry--setting-label">Event Tracking</p>
									<p class="telemetry--setting-description">
										Feature usage, settings changes, etc
									</p>
								</div>
								<SyToggle
									value="track_events"
									accessibleLabel="Event Tracking"
									checked={prefs.track_events}
									disabled={savingPreference}
									onchange={(checked) => setPref('track_events', checked)}
								/>
							</div>
							<div class="telemetry--setting telemetry--setting--center">
								<div>
									<p class="telemetry--setting-label">Screen Views</p>
									<p class="telemetry--setting-description">
										Which app screens are visited
									</p>
								</div>
								<SyToggle
									value="track_screen_views"
									accessibleLabel="Screen Views"
									checked={prefs.track_screen_views}
									disabled={savingPreference}
									onchange={(checked) => setPref('track_screen_views', checked)}
								/>
							</div>
							<div class="telemetry--setting telemetry--setting--center">
								<div>
									<p class="telemetry--setting-label">Error Reporting</p>
									<p class="telemetry--setting-description">
										Application errors and failures
									</p>
								</div>
								<SyToggle
									value="track_errors"
									accessibleLabel="Error Reporting"
									checked={prefs.track_errors}
									disabled={savingPreference}
									onchange={(checked) => setPref('track_errors', checked)}
								/>
							</div>
							<div class="telemetry--setting telemetry--setting--center">
								<div>
									<p class="telemetry--setting-label">Device Context</p>
									<p class="telemetry--setting-description">
										OS version, architecture, locale, and timezone for
										compatibility analysis
									</p>
								</div>
								<SyToggle
									value="include_device_context"
									accessibleLabel="Device Context"
									checked={prefs.include_device_context}
									disabled={savingPreference}
									onchange={(checked) =>
										setPref('include_device_context', checked)}
								/>
							</div>
						</div>
					{/if}
				</div>
			</section>
			<section class="telemetry--inspection" aria-labelledby="telemetry-inspection-heading">
				<h3 class="telemetry--section-title" id="telemetry-inspection-heading">
					Pending payloads
				</h3>
				<div class="telemetry--inspection-card">
					<div>
						<p class="telemetry--inspection-title">
							Inspect what Syng is waiting to send
						</p>
						<p class="telemetry--inspection-description">
							Open a full-width snapshot of recent queued payloads. Successfully sent
							events remain visible until you leave this view.
						</p>
					</div>
					<SyButton
						id={queueTriggerId}
						classes={['telemetry--inspect-button']}
						onclick={openQueue}>Inspect queue →</SyButton
					>
				</div>
			</section>
			{#if !isAndroid()}
				<a
					class="telemetry--privacy-link"
					href={PRIVACY_POLICY_URL}
					onclick={openPrivacyPolicy}>Privacy policy</a
				>
			{/if}
		</div>
	{:else}
		<div
			class="telemetry--queue-view"
			use:swipeBack={{ enabled: variant === 'mobile', onBack: () => void closeQueue() }}
		>
			<button class="telemetry--back" type="button" onclick={closeQueue}
				><ChevronLeft size="18" aria-hidden="true" />Telemetry Settings</button
			>
			<h2 class="telemetry--queue-title" tabindex="-1" bind:this={queueHeading}>
				Pending payloads
			</h2>
			<div class="telemetry--queue-toolbar">
				<SyTextInput
					type="search"
					value={queueSearch}
					placeholder="Find an event"
					aria-label="Find a queued event"
					oninput={(value) => {
						queueSearch = value;
						visibleLimit = QUEUE_PAGE_SIZE;
					}}
				/>
				<fieldset class="telemetry--queue-filters">
					<legend>Event family</legend>
					<SyRadioGroup selectedValue={queueFamily} {variant}>
						{#each queueFamilies as family (family.value)}
							<label
								><SyRadio
									name="telemetry-queue-family"
									value={family.value}
									checked={queueFamily === family.value}
									onchange={() => selectFamily(family.value)}
								/><span>{family.label}</span></label
							>
						{/each}
					</SyRadioGroup>
				</fieldset>
			</div>
			<p class="telemetry--queue-count" aria-live="polite">
				Showing {visibleEvents.length} of {filteredEvents.length}
				{hasQueueFilter ? 'matching snapshot payloads' : 'snapshot payloads'}
			</p>
			<div class="telemetry--queue-list">
				<SyCollapsibleList
					items={visibleEvents}
					emptyText={queueSnapshot.length === 0
						? 'No pending payloads right now.'
						: 'No pending payloads match this search.'}
				>
					{#snippet header(event)}
						<span class="telemetry--badge telemetry--badge--{event.family}">
							{familyLabel(event.family)}
						</span>
						<span class="telemetry--event-meta">
							<span class="telemetry--event-name">{event.name}</span>
							<span class="telemetry--event-time"
								>{formatTimestamp(event.timestamp_ms)}</span
							>
						</span>
					{/snippet}
					{#snippet detail(event)}
						<pre class="telemetry--event-payload sy-text--selectable">{JSON.stringify(
								event,
								null,
								2
							)}</pre>
					{/snippet}
				</SyCollapsibleList>
			</div>
			{#if filteredEvents.length > visibleLimit}
				<div class="telemetry--queue-more">
					<SyButton onclick={() => (visibleLimit += QUEUE_PAGE_SIZE)}>
						Show {Math.min(QUEUE_PAGE_SIZE, filteredEvents.length - visibleLimit)} more
					</SyButton>
				</div>
			{/if}
			<p class="telemetry--queue-footnote">
				This snapshot shows up to 50 of the newest pending events when you opened it. Older
				events may still be queued; this is not a history of sent data.
			</p>
		</div>
	{/if}
</div>

<style>
	.telemetry--container {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		flex: 1;
		min-width: 0;
		overflow: visible;
	}

	.telemetry--settings-view,
	.telemetry--queue-view {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
	}

	.telemetry--settings-view {
		gap: var(--sy-space--extra-large);
		max-width: 48rem;
		margin-inline: auto;
	}

	.telemetry--title,
	.telemetry--queue-title {
		margin: 0;
		font: var(--sy-type--local-title);
	}

	.telemetry--intro {
		margin: calc(-1 * var(--sy-space--large)) 0 0;
		font: var(--sy-type--supporting);
		color: var(--sy-text--muted);
	}

	.telemetry--section-title {
		margin: 0 0 var(--sy-space--large);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.telemetry--privacy-notice {
		margin: 0 0 var(--sy-space--large);
		font-size: var(--sy-font-size--medium);
		color: var(--sy-text--dark);
		line-height: 1.5;
	}

	.telemetry--privacy-link {
		color: var(--sy-text--blue);
		text-decoration: underline;
	}

	.telemetry--disclosure {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large);
		background-color: var(--sy-surface--well);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-inner-shadow);
	}

	.telemetry--disclosure-text {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
		line-height: 1.5;
	}

	.telemetry--setting {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large);
	}

	.telemetry--setting--center {
		align-items: center;
	}

	.telemetry--setting-label {
		margin: 0 0 var(--sy-space--small) 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--normal);
	}

	.telemetry--setting-description {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}

	.telemetry--categories {
		display: flex;
		flex-direction: column;
		border-top: var(--sy-border);
	}

	.telemetry--categories .telemetry--setting + .telemetry--setting {
		border-top: var(--sy-border);
	}

	.telemetry--choices-surface,
	.telemetry--inspection-card {
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		outline: 1px solid var(--sy-content-card-edge, transparent);
		box-shadow: var(--sy-shadow--content);
	}

	.telemetry--choices-surface {
		overflow: hidden;
	}

	.telemetry--inspection-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--extra-large);
		padding: var(--sy-space--extra-large);
	}

	.telemetry--inspection-card :global(.telemetry--inspect-button) {
		flex: none;
		white-space: nowrap;
	}

	.telemetry--inspection-title {
		margin: 0 0 var(--sy-space);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
	}

	.telemetry--inspection-description,
	.telemetry--queue-footnote {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--muted);
		line-height: var(--sy-line-height--body);
	}

	.telemetry--settings-view > .telemetry--privacy-link {
		align-self: flex-start;
		font-size: var(--sy-font-size--small);
	}

	.telemetry--queue-view {
		gap: var(--sy-space--large);
	}

	.telemetry--back {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
		min-height: var(--sy-mobile-touch-target);
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sy-text--blue);
		font: inherit;
		cursor: pointer;
	}

	.telemetry--back:focus-visible {
		outline: var(--sy-focus-width) solid var(--sy-focus-color);
		outline-offset: var(--sy-focus-offset);
	}

	@media (hover: hover) {
		.telemetry--back:hover {
			text-decoration: underline;
			text-underline-offset: 3px;
		}
	}

	.telemetry--queue-toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sy-space--large);
		padding-block: var(--sy-space);
	}

	.telemetry--queue-toolbar :global(.sy-text-input) {
		flex: 1;
		min-width: 12rem;
		min-height: 44px;
		margin: 0;
	}

	.telemetry--queue-filters {
		width: min(100%, 340px);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.telemetry--queue-filters legend {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.telemetry--queue-count {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--muted);
	}

	.telemetry--queue-list :global(.sy-collapsible-list) {
		flex: none;
		min-height: 0;
		overflow: visible;
	}

	.telemetry--queue-more {
		align-self: center;
	}

	.telemetry--badge {
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 0.625rem;
		font-weight: var(--sy-font-weight--bold);
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.telemetry--badge--event {
		background-color: var(--sy-fill--blue);
		color: var(--sy-text--on-fill);
	}

	.telemetry--badge--screen_view {
		background-color: var(--sy-fill--green);
		color: var(--sy-text--on-fill);
	}

	.telemetry--badge--error {
		background-color: var(--sy-fill--red);
		color: var(--sy-text--on-fill);
	}

	.telemetry--event-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		flex: 1;
		min-width: 0;
	}

	.telemetry--event-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: var(--sy-font-weight--normal);
	}

	.telemetry--event-time {
		color: var(--sy-text--muted);
		flex-shrink: 0;
	}

	.telemetry--event-payload {
		margin: 0;
		font-size: 0.6875rem;
		line-height: 1.5;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 200px;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.telemetry--container--mobile {
		min-height: 0;
	}

	.telemetry--container--mobile .telemetry--settings-view {
		gap: var(--sy-mobile-space--large);
	}

	.telemetry--container--mobile .telemetry--title,
	.telemetry--container--mobile .telemetry--intro {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.telemetry--container--mobile .telemetry--disclosure {
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--disclosure-text,
	.telemetry--container--mobile .telemetry--setting-description,
	.telemetry--container--mobile .telemetry--inspection-description,
	.telemetry--container--mobile .telemetry--queue-footnote {
		font-size: var(--sy-font-size--mobile-small);
	}

	.telemetry--container--mobile .telemetry--setting {
		gap: var(--sy-mobile-space--medium);
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--setting-label {
		font-size: var(--sy-font-size--mobile-medium);
	}

	.telemetry--container--mobile .telemetry--categories {
		gap: 0;
	}

	.telemetry--container--mobile .telemetry--choices-surface,
	.telemetry--container--mobile .telemetry--inspection-card {
		border: var(--sy-mobile-surface-border);
		outline: none;
		box-shadow: none;
	}

	.telemetry--container--mobile .telemetry--inspection-card {
		align-items: flex-start;
		flex-direction: column;
		gap: var(--sy-mobile-space--medium);
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--queue-toolbar :global(.sy-text-input) {
		flex-basis: 100%;
	}

	.telemetry--container--mobile .telemetry--queue-filters {
		width: 100%;
	}

	.telemetry--container--mobile :global(.sy-collapsible-list--header) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--event-meta {
		align-items: flex-start;
		flex-direction: column;
		gap: var(--sy-mobile-space--extra-small);
	}
</style>
