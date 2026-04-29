<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyCollapsibleList from '@/components/SyCollapsibleList/SyCollapsibleList.svelte';
	import { telemetry, type TelemetryPrefs, type TelemetryEvent } from '@/utils/telemetry.js';
	import { handleError } from '@/utils/error.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const TELEMETRY_REFRESH_INTERVAL_MS = 5000;
	const MAX_DISPLAY_EVENTS = 50;

	const { variant = 'desktop' }: Props = $props();

	let prefs = $state<TelemetryPrefs>({
		enabled: true,
		track_events: true,
		track_screen_views: true,
		track_errors: true,
		include_device_context: true,
	});

	let queuedEvents = $state<TelemetryEvent[]>([]);
	let refreshInterval: ReturnType<typeof setInterval>;

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

	const refreshEvents = async () => {
		try {
			queuedEvents = await telemetry.getQueuedEvents(MAX_DISPLAY_EVENTS);
		} catch (_) {
			// noop
		}
	};

	const setPref = async (key: string, value: boolean) => {
		prefs = { ...prefs, [key]: value };
		await telemetry
			.setPref(key, value)
			.catch((e) => handleError('Failed to set telemetry preference.', e, { silent: true }));
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
</script>

<div class="telemetry--container" class:telemetry--container--mobile={variant === 'mobile'}>
	<div class="telemetry--disclosure">
		<p class="telemetry--disclosure-text">
			We hate creepy data collection, and you should too! That's why Syng's telemetry service
			is designed to be open and transparent. You can inspect exactly what is sent below, and
			you can opt out of telemetry in part or in full at any time. Telemetry data is used only
			to diagnose issues, improve compatibility, and better understand how the app is used.
			It's accessible only to the project maintainer and is never used for advertising or
			shared with third parties.
		</p>
	</div>

	<div class="telemetry--setting telemetry--setting--center">
		<div>
			<p class="telemetry--setting-label">Enable Telemetry</p>
			<p class="telemetry--setting-description">Allow Syng to collect usage data</p>
		</div>
		<SyToggle value="enabled" checked={prefs.enabled} onchange={(v) => setPref('enabled', v)} />
	</div>

	{#if prefs.enabled}
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
					checked={prefs.track_events}
					onchange={(v) => setPref('track_events', v)}
				/>
			</div>
			<div class="telemetry--setting telemetry--setting--center">
				<div>
					<p class="telemetry--setting-label">Screen Views</p>
					<p class="telemetry--setting-description">Which app screens are visited</p>
				</div>
				<SyToggle
					value="track_screen_views"
					checked={prefs.track_screen_views}
					onchange={(v) => setPref('track_screen_views', v)}
				/>
			</div>
			<div class="telemetry--setting telemetry--setting--center">
				<div>
					<p class="telemetry--setting-label">Error Reporting</p>
					<p class="telemetry--setting-description">Application errors and failures</p>
				</div>
				<SyToggle
					value="track_errors"
					checked={prefs.track_errors}
					onchange={(v) => setPref('track_errors', v)}
				/>
			</div>
			<div class="telemetry--setting telemetry--setting--center">
				<div>
					<p class="telemetry--setting-label">Device Context</p>
					<p class="telemetry--setting-description">
						OS version, architecture, and locale for compatibility analysis
					</p>
				</div>
				<SyToggle
					value="include_device_context"
					checked={prefs.include_device_context}
					onchange={(v) => setPref('include_device_context', v)}
				/>
			</div>
		</div>
	{/if}

	<div class="telemetry--preview">
		<h2 class="telemetry--preview-title">Recent Telemetry Events</h2>
		<p class="telemetry--preview-subtitle">
			These are the actual payloads being sent to the telemetry backend.
		</p>
		<SyCollapsibleList items={queuedEvents} emptyText="No events recorded yet.">
			{#snippet header(event)}
				<span class="telemetry--badge telemetry--badge--{event.family}">
					{familyLabel(event.family)}
				</span>
				<span class="telemetry--event-name">{event.name}</span>
				<span class="telemetry--event-time">{formatTimestamp(event.timestamp_ms)}</span>
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
</div>

<style>
	.telemetry--container {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		flex: 1;
		overflow-y: auto;
	}

	.telemetry--disclosure {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large);
		background-color: var(--sy-color--grey-2);
		border-radius: var(--sy-border-radius);
	}

	.telemetry--disclosure-text {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
		line-height: 1.5;
	}

	.telemetry--setting {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--sy-space--large);
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
		gap: var(--sy-space--extra-large);
		padding-left: var(--sy-space--extra-large);
		border-left: 2px solid var(--sy-color--grey-2);
	}

	.telemetry--preview {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		flex: 1;
	}

	.telemetry--preview-title {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.telemetry--preview-subtitle {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
	}

	.telemetry--badge {
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: var(--sy-font-weight--bold);
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.telemetry--badge--event {
		background-color: var(--sy-color--blue-1);
		color: var(--sy-color--white);
	}

	.telemetry--badge--screen_view {
		background-color: var(--sy-color--green-3);
		color: var(--sy-color--white);
	}

	.telemetry--badge--error {
		background-color: var(--sy-color--red-1);
		color: var(--sy-color--white);
	}

	.telemetry--event-name {
		flex: 1;
		font-weight: var(--sy-font-weight--normal);
	}

	.telemetry--event-time {
		color: var(--sy-text--dark);
		flex-shrink: 0;
	}

	.telemetry--event-payload {
		margin: 0;
		padding: var(--sy-space--large);
		background-color: var(--sy-color--grey-2);
		font-size: 11px;
		line-height: 1.5;
		overflow-x: auto;
		overflow-y: auto;
		max-height: 200px;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.telemetry--container--mobile {
		gap: calc(var(--sy-mobile-space--extra-small) * 5);
		overflow: visible;
		min-height: 0;
	}

	.telemetry--container--mobile .telemetry--disclosure {
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--disclosure-text,
	.telemetry--container--mobile .telemetry--setting-description,
	.telemetry--container--mobile .telemetry--preview-subtitle {
		font-size: var(--sy-font-size--mobile-small);
	}

	.telemetry--container--mobile .telemetry--setting {
		gap: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--setting-label {
		font-size: var(--sy-font-size--mobile-medium);
	}

	.telemetry--container--mobile .telemetry--categories {
		gap: calc(var(--sy-mobile-space--extra-small) * 5);
		padding-left: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--preview-title {
		font-size: var(--sy-font-size--mobile-medium);
	}

	.telemetry--container--mobile :global(.sy-collapsible-list--header) {
		gap: calc(var(--sy-mobile-space--extra-small) * 3);
		padding: var(--sy-mobile-space--medium);
	}

	.telemetry--container--mobile .telemetry--event-time {
		display: none;
	}
</style>
