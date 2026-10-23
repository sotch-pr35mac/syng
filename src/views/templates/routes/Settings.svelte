<script lang="ts">
	import { router } from 'svelte-spa-router';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import GeneralSettings from '@/components/SettingsOption/GeneralSettings.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
	import { settingsScroll } from '@/actions/settingsScroll.js';
	import { settingsActiveTabStore, type SettingsTab } from '@/stores/settings.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { platform } from '@tauri-apps/plugin-os';
	import { isIPad } from '@/utils/device.js';
	const isMacos = platform() === 'macos';
	const destination = $derived(new URLSearchParams(router.querystring ?? ''));
	$effect.pre(() => {
		if (destination.has('section') || destination.has('setting')) {
			settingsActiveTabStore.set('general');
		}
	});
	const activeTab = $derived(settingsActiveTabStore.value as SettingsTab);
	let scrollContainer = $state<HTMLDivElement>();
	let generalReady = $state(false);
	$effect.pre(() => {
		void activeTab;
		generalReady = false;
	});
	function setActiveTab(tab: SettingsTab): void {
		settingsActiveTabStore.set(tab);
	}
</script>

<div class="settings--container">
	<div
		class="settings--title"
		class:settings--title--ipad={isIPad()}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Settings</h1>
	</div>
	<div class="settings--tabs" role="tablist" aria-label="Settings sections" use:tabNavigation>
		<SyTab
			role="tab"
			id="settings-general-tab"
			aria-controls="settings-panel"
			active={activeTab === 'general'}
			onclick={() => setActiveTab('general')}
		>
			General
		</SyTab>
		<SyTab
			role="tab"
			id="settings-telemetry-tab"
			aria-controls="settings-panel"
			active={activeTab === 'telemetry'}
			onclick={() => setActiveTab('telemetry')}
		>
			Telemetry
		</SyTab>
		<SyTab
			role="tab"
			id="settings-acknowledgements-tab"
			aria-controls="settings-panel"
			active={activeTab === 'acknowledgements'}
			onclick={() => setActiveTab('acknowledgements')}
		>
			Acknowledgements
		</SyTab>
	</div>
	{#if destination.get('from') === 'whats-new'}
		<div class="settings-return">
			<SyButton style="ghost" size="large" onclick={whatsNewStore.back}
				>Back to What’s New</SyButton
			>
		</div>
	{/if}

	{#key activeTab}
		<div
			class="settings--content"
			bind:this={scrollContainer}
			use:settingsScroll={{
				layout: 'desktop',
				tab: activeTab,
				ready: activeTab !== 'general' || generalReady,
				destination: destination.has('section') || destination.has('setting'),
			}}
		>
			<div
				role="tabpanel"
				id="settings-panel"
				aria-labelledby={`settings-${activeTab}-tab`}
				tabindex="0"
				class="settings--panel"
			>
				{#if activeTab === 'general'}
					<GeneralSettings
						variant="desktop"
						{scrollContainer}
						onready={() => {
							generalReady = true;
						}}
					/>
				{:else if activeTab === 'telemetry'}
					{#if privacySettingsStore.childPrivacyMode}
						<AgeStatusSettings />
					{:else}
						<TelemetrySettings />
					{/if}
				{:else}
					<Acknowledgements />
				{/if}
			</div>
		</div>
	{/key}
</div>

<style>
	.settings-return {
		padding: var(--sy-space--large);
		flex-shrink: 0;
	}
	.settings--container {
		padding: 0px var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
		overflow: hidden;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}
	.settings--title {
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.settings--title--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.settings--tabs {
		flex-wrap: wrap;
		display: flex;
		gap: var(--sy-space--large);
		padding: 0 var(--sy-space);
		border-bottom: var(--sy-border);
		margin-bottom: var(--sy-space--extra-large);
	}
	.settings--content {
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		overflow-y: auto;
		flex: 1;
		padding-bottom: var(--sy-space--extra-large);
	}
	.settings--panel {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}
</style>
