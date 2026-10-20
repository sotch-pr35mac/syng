<script lang="ts">
	import GeneralSettings from '@/components/SettingsOption/GeneralSettings.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
	import { settingsScroll } from '@/actions/settingsScroll.js';
	import { settingsActiveTabStore, type SettingsTab } from '@/stores/settings.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
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

<div class="mobile-settings">
	<header class="mobile-settings__header">
		<div
			class="mobile-settings__tabs"
			role="tablist"
			aria-label="Settings sections"
			use:tabNavigation
		>
			<SyTab
				variant="mobile"
				role="tab"
				id="mobile-settings-general-tab"
				aria-controls="mobile-settings-panel"
				active={activeTab === 'general'}
				onclick={() => setActiveTab('general')}
			>
				General
			</SyTab>
			<SyTab
				variant="mobile"
				role="tab"
				id="mobile-settings-telemetry-tab"
				aria-controls="mobile-settings-panel"
				active={activeTab === 'telemetry'}
				onclick={() => setActiveTab('telemetry')}
			>
				Telemetry
			</SyTab>
			<SyTab
				variant="mobile"
				role="tab"
				id="mobile-settings-acknowledgements-tab"
				aria-controls="mobile-settings-panel"
				active={activeTab === 'acknowledgements'}
				onclick={() => setActiveTab('acknowledgements')}
			>
				Acknowledgements
			</SyTab>
		</div>
	</header>

	{#key activeTab}
		<div
			class="mobile-settings__content"
			bind:this={scrollContainer}
			use:settingsScroll={{
				layout: 'mobile',
				tab: activeTab,
				ready: activeTab !== 'general' || generalReady,
			}}
		>
			<div
				role="tabpanel"
				id="mobile-settings-panel"
				aria-labelledby={`mobile-settings-${activeTab}-tab`}
				tabindex="0"
				class="mobile-settings__panel"
			>
				{#if activeTab === 'general'}
					<GeneralSettings
						variant="mobile"
						{scrollContainer}
						onready={() => {
							generalReady = true;
						}}
					/>
				{:else if activeTab === 'telemetry'}
					{#if privacySettingsStore.childPrivacyMode}
						<AgeStatusSettings variant="mobile" />
					{:else}
						<TelemetrySettings variant="mobile" />
					{/if}
				{:else}
					<Acknowledgements />
				{/if}
			</div>
		</div>
	{/key}
</div>

<style>
	.mobile-settings {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--sy-color--white);
	}

	.mobile-settings__header {
		display: flex;
		flex-direction: column;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
		background-color: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
		flex-shrink: 0;
	}

	.mobile-settings__tabs {
		flex-wrap: wrap;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
	}

	.mobile-settings__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-mobile-space--medium) * 3);
	}

	.mobile-settings__panel {
		flex-shrink: 0;
		min-width: 0;
	}
</style>
