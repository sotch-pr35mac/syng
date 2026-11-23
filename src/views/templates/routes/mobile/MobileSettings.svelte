<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BookOpen,
		ChevronLeft,
		ChevronRight,
		CircleQuestionMark,
		Info,
		Settings2,
		ShieldCheck,
		Sun,
	} from 'lucide-svelte';
	import { router } from 'svelte-spa-router';
	import GeneralSettings from '@/components/SettingsOption/GeneralSettings.svelte';
	import TelemetrySettings from '@/components/TelemetrySettings/TelemetrySettings.svelte';
	import AgeStatusSettings from '@/components/TelemetrySettings/AgeStatusSettings.svelte';
	import Acknowledgements from '@/components/Acknowledgements/Acknowledgements.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { settingsScroll } from '@/actions/settingsScroll.js';
	import {
		mobileSettingsDetailStore,
		type MobileSettingsDetail,
	} from '@/stores/settings.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import { isDevBuild, resolveIsDevBuild } from '@/composables/settings.js';
	import { isAndroid } from '@/utils/device.js';
	import { telemetry } from '@/utils/telemetry.js';

	const destination = $derived(new URLSearchParams(router.querystring ?? ''));
	const detail = $derived(mobileSettingsDetailStore.value);
	let scrollContainer = $state<HTMLDivElement>();
	let generalReady = $state(false);
	let telemetryQueueOpen = $state(false);
	let showDeveloper = $state(isDevBuild());
	onMount(() => {
		let mounted = true;
		void resolveIsDevBuild().then((development) => {
			if (mounted) {
				showDeveloper = development;
			}
			return undefined;
		});
		return () => {
			mounted = false;
		};
	});
	const titles: Record<MobileSettingsDetail, string> = {
		home: 'Settings',
		appearance: 'Appearance',
		dictionary: 'Chinese & Dictionary',
		help: 'Help & Maintenance',
		telemetry: 'Telemetry',
		acknowledgements: 'Acknowledgements',
		developer: 'Developer',
	};
	const groups = [
		{
			label: 'Preferences',
			items: [
				{
					detail: 'appearance',
					label: 'Appearance',
					description: 'Contrast, pinyin, and tone colors',
					icon: Sun,
				},
				{
					detail: 'dictionary',
					label: 'Chinese & Dictionary',
					description: 'Characters, HSK, and entry details',
					icon: BookOpen,
				},
			],
		},
		{
			label: 'Privacy',
			items: [
				{
					detail: 'telemetry',
					label: 'Telemetry',
					description: 'Choose what Syng sends',
					icon: ShieldCheck,
				},
			],
		},
		{
			label: 'Help & information',
			items: [
				{
					detail: 'help',
					label: 'Help & Maintenance',
					description: 'Feature guides and What’s New',
					icon: CircleQuestionMark,
				},
				{
					detail: 'acknowledgements',
					label: 'Acknowledgements',
					description: 'Credits and licenses',
					icon: Info,
				},
			],
		},
	] as const;
	$effect.pre(() => {
		const section = destination.get('section');
		const setting = destination.get('setting');
		const target =
			section === 'appearance' ||
			section === 'dictionary' ||
			section === 'help' ||
			section === 'developer'
				? section
				: setting === 'contrast'
					? 'appearance'
					: setting === 'walkthrough'
						? 'help'
						: undefined;
		if (target) {
			mobileSettingsDetailStore.set(target);
		}
	});
	$effect.pre(() => {
		void detail;
		generalReady = false;
		telemetryQueueOpen = false;
	});
	function open(next: MobileSettingsDetail): void {
		if (next === detail) {
			return;
		}
		mobileSettingsDetailStore.set(next);
		if (next !== 'home') {
			telemetry.trackEvent('settings.section_selected', { section: next }).catch(() => {});
		}
	}
	const generalSection = $derived(
		detail === 'help' ||
			detail === 'dictionary' ||
			detail === 'appearance' ||
			detail === 'developer'
			? detail
			: undefined
	);
</script>

<div class="mobile-settings">
	{#if destination.get('from') === 'whats-new'}
		<div class="mobile-settings__return">
			<SyButton style="ghost" size="large" onclick={whatsNewStore.back}
				>Back to What’s New</SyButton
			>
		</div>
	{/if}
	{#key detail}
		<div
			class="mobile-settings__page"
			use:swipeBack={{
				enabled: detail !== 'home' && !telemetryQueueOpen,
				onBack: () => open('home'),
			}}
		>
			{#if detail !== 'home'}
				<header class="mobile-settings__detail-header">
					<button type="button" class="mobile-settings__back" onclick={() => open('home')}
						><ChevronLeft size="18" />Settings</button
					>
					<h1 id="mobile-settings-title" tabindex="-1">{titles[detail]}</h1>
				</header>
			{/if}
			<div
				class="mobile-settings__content"
				class:mobile-settings__content--android={isAndroid()}
				data-sy-primary-scroll
				bind:this={scrollContainer}
				use:settingsScroll={{
					layout: 'mobile',
					tab: detail,
					ready: !generalSection || generalReady,
					destination: destination.has('section') || destination.has('setting'),
				}}
			>
				{#if detail === 'home'}
					<div class="mobile-settings__home" aria-label="Settings groups">
						{#each groups as group (group.label)}
							<section class="mobile-settings__group">
								<h2>{group.label}</h2>
								<div class="mobile-settings__list">
									{#each group.items as item (item.detail)}
										<button
											type="button"
											class="mobile-settings__row"
											onclick={() => open(item.detail)}
										>
											<item.icon size="20" aria-hidden="true" /><span
												><strong>{item.label}</strong><small
													>{item.description}</small
												></span
											><ChevronRight size="17" aria-hidden="true" />
										</button>
									{/each}
								</div>
							</section>
						{/each}
						{#if showDeveloper}<section class="mobile-settings__group">
								<h2>Developer</h2>
								<div class="mobile-settings__list">
									<button
										type="button"
										class="mobile-settings__row"
										onclick={() => open('developer')}
										><Settings2 size="20" aria-hidden="true" /><span
											><strong>Developer</strong><small
												>Testing and advanced controls</small
											></span
										><ChevronRight size="17" aria-hidden="true" /></button
									>
								</div>
							</section>{/if}
					</div>
				{:else}
					<div
						role={generalSection ? undefined : 'region'}
						aria-labelledby={generalSection ? undefined : 'mobile-settings-title'}
						class="mobile-settings__panel"
					>
						{#if generalSection}
							<GeneralSettings
								variant="mobile"
								section={generalSection}
								{scrollContainer}
								onready={() => {
									generalReady = true;
								}}
							/>
						{:else if detail === 'telemetry'}
							{#if privacySettingsStore.childPrivacyMode}<AgeStatusSettings
									variant="mobile"
								/>{:else}<TelemetrySettings
									variant="mobile"
									onQueueChange={(open) => (telemetryQueueOpen = open)}
								/>{/if}
						{:else}<Acknowledgements />{/if}
					</div>
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
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}
	.mobile-settings__page {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.mobile-settings__return {
		padding: var(--sy-mobile-space--large);
	}
	.mobile-settings__detail-header {
		flex: none;
		padding: 10px 16px 12px;
		background: var(--sy-surface--chrome);
		border-bottom: var(--sy-mobile-surface-border);
	}
	.mobile-settings__detail-header h1 {
		margin: 8px 0 0;
		font-size: var(--sy-font-size--mobile-heading);
	}
	.mobile-settings__back {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sy-text--blue);
		font: inherit;
	}
	.mobile-settings__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
	}
	.mobile-settings__content--android {
		/* Android WebView otherwise reuses stale tiles from earlier shell frames. */
		transform: translateZ(0);
	}
	.mobile-settings__home {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.mobile-settings__group h2 {
		margin: 0 0 8px 12px;
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: 700;
	}
	.mobile-settings__list {
		overflow: hidden;
		border: var(--sy-mobile-surface-border);
		border-radius: 16px;
		background: var(--sy-surface--content);
	}
	.mobile-settings__row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 64px;
		padding: 10px 14px;
		border: 0;
		border-top: var(--sy-mobile-surface-border);
		background: transparent;
		color: var(--sy-color--black);
		font: inherit;
		text-align: left;
	}
	.mobile-settings__row:first-child {
		border-top: 0;
	}
	.mobile-settings__row:active {
		background: var(--sy-surface--well);
	}
	.mobile-settings__row > span {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.mobile-settings__row strong {
		font-size: var(--sy-font-size--mobile-medium);
	}
	.mobile-settings__row small {
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--mobile-small);
	}
	.mobile-settings__panel {
		min-width: 0;
		padding-bottom: 32px;
	}
</style>
