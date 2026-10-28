<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';
	import { router } from 'svelte-spa-router';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import WhatsNewTesting from '@/components/WhatsNew/WhatsNewTesting.svelte';
	import WalkthroughSettings from '@/components/Walkthrough/WalkthroughSettings.svelte';
	import WalkthroughReset from '@/components/Walkthrough/WalkthroughReset.svelte';
	import PinyinSettings from '@/components/SettingsOption/PinyinSettings.svelte';
	import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import DictionaryMetadataSettings from '@/components/SettingsOption/DictionaryMetadataSettings.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import ToneColorPicker from '@/components/SettingsOption/ToneColorPicker.svelte';
	import UpdateChecker from '@/components/SettingsOption/UpdateChecker.svelte';
	import BookmarkRecoverySettings from '@/components/SettingsOption/BookmarkRecoverySettings.svelte';
	import DatabaseMigrationPreview from '@/components/SettingsOption/DatabaseMigrationPreview.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';
	import { bookmarkRecoveryStore } from '@/stores/bookmarkRecovery.svelte.js';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import { getPreferenceManager } from '@/utils/appServices.js';
	import { handleError } from '@/utils/error.js';
	import { telemetry } from '@/utils/telemetry.js';
	import { isIPad, isMobile } from '@/utils/device.js';
	import {
		isDevBuild,
		resolveIsDevBuild,
		resolveIsMasBuild,
		updateBetaPreference,
		updateCharacterSetPreference,
		updateHskVariantPreference,
		updateShowQualifiersPreference,
		updateShowPartsOfSpeechPreference,
		updateShowAlternativePronunciationsPreference,
		updateColorCharactersByTonePreference,
		updateColorPinyinByTonePreference,
		updateColorListsByTonePreference,
		updateToneColorsPreference,
	} from '@/composables/settings.js';

	const {
		variant = 'desktop',
		scrollContainer,
		onready,
	}: {
		variant?: 'desktop' | 'mobile';
		scrollContainer?: HTMLElement;
		onready?: () => void;
	} = $props();

	const identifier = $props.id();
	const sections = [
		{ id: 'help', label: 'Help & Maintenance' },
		{ id: 'dictionary', label: 'Chinese & Dictionary' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'developer', label: 'Developer' },
	];
	const headingElements: Record<string, HTMLHeadingElement> = {};
	const SECTION_OFFSET = 10;
	const BOTTOM_TOLERANCE = 2;
	const controlVariant = $derived(variant === 'mobile' || isIPad() ? 'mobile' : 'desktop');
	let content = $state<HTMLDivElement>();
	let currentSection = $state('help');
	let showDevPreferences = $state(isDevBuild());
	let showUpdates = $state(false);
	let hasSavedRecoveryReport = $state(false);
	let optionsReady = $state(false);
	let appliedQuery = '';
	const visibleSections = $derived(
		sections.filter((section) => section.id !== 'developer' || showDevPreferences)
	);
	const choices = $derived(
		visibleSections.map((section) => ({
			id: section.id,
			text: section.label,
			selected: currentSection === section.id,
			component: SimpleTextDropdownItem,
		}))
	);

	function sectionHeading(node: HTMLHeadingElement, section: string) {
		headingElements[section] = node;
		return {
			destroy: () => {
				delete headingElements[section];
			},
		};
	}

	$effect(() => {
		const query = router.querystring ?? '';
		if (!optionsReady || !scrollContainer || !content || query === appliedQuery) {
			return;
		}
		appliedQuery = query;
		const parameters = new URLSearchParams(query);
		const setting = parameters.get('setting');
		const section =
			parameters.get('section') ?? (setting === 'contrast' ? 'appearance' : 'help');
		if (!parameters.has('section') && !setting) {
			return;
		}
		const heading = headingElements[section];
		const control =
			setting === 'walkthrough'
				? content.querySelector<HTMLElement>('.walkthrough-settings [aria-haspopup="menu"]')
				: setting === 'contrast'
					? content.querySelector<HTMLElement>('.increase-contrast-settings input')
					: null;
		const target = control ?? heading;
		if (target) {
			scrollContainer.scrollTop +=
				target.getBoundingClientRect().top -
				scrollContainer.getBoundingClientRect().top -
				SECTION_OFFSET;
			target.focus({ preventScroll: true });
			updateCurrentSection();
		}
	});

	function updateCurrentSection(): void {
		if (!scrollContainer || !scrollContainer.clientHeight) {
			return;
		}
		const atBottom =
			scrollContainer.scrollTop > 0 &&
			scrollContainer.scrollTop + scrollContainer.clientHeight >=
				scrollContainer.scrollHeight - BOTTOM_TOLERANCE;
		const top = scrollContainer.getBoundingClientRect().top + SECTION_OFFSET;
		let section = visibleSections[0].id;
		for (const candidate of visibleSections) {
			if (
				atBottom ||
				(headingElements[candidate.id]?.getBoundingClientRect().top ?? Infinity) <= top
			) {
				section = candidate.id;
			}
		}
		currentSection = section;
	}

	async function selectSection(value: string | number): Promise<void> {
		// Let SyDropdown finish closing/restoring its trigger before moving focus.
		await tick();
		const heading = headingElements[String(value)];
		if (!scrollContainer || !heading?.isConnected) {
			return;
		}
		telemetry
			.trackEvent('settings.section_selected', { section: String(value) })
			.catch(() => {});
		scrollContainer.scrollTop +=
			heading.getBoundingClientRect().top -
			scrollContainer.getBoundingClientRect().top -
			SECTION_OFFSET;
		heading.focus({ preventScroll: true });
		updateCurrentSection();
	}

	$effect(() => {
		const container = scrollContainer;
		const body = content;
		void visibleSections;
		if (!container || !body) {
			return undefined;
		}
		let frame: number | undefined;
		const schedule = () => {
			if (frame === undefined) {
				frame = requestAnimationFrame(() => {
					frame = undefined;
					updateCurrentSection();
				});
			}
		};
		const observer =
			typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
		observer?.observe(container);
		observer?.observe(body);
		container.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		schedule();
		return () => {
			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}
			observer?.disconnect();
			container.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});

	onMount(() => {
		let mounted = true;
		async function resolveOptions(): Promise<void> {
			const [development, mas, recovery] = await Promise.allSettled([
				resolveIsDevBuild(),
				variant === 'desktop' && !isMobile() ? resolveIsMasBuild() : Promise.resolve(true),
				variant === 'mobile' || isMobile()
					? bookmarkRecoveryStore.hasSaved()
					: Promise.resolve(false),
			]);
			if (!mounted) {
				return;
			}
			if (development.status === 'fulfilled') {
				showDevPreferences = development.value;
			}
			showUpdates = mas.status === 'fulfilled' && !mas.value;
			if (recovery.status === 'fulfilled') {
				hasSavedRecoveryReport = recovery.value;
			} else {
				handleError('Could not check for bookmark recovery reports.', recovery.reason);
			}
			await tick();
			if (mounted) {
				optionsReady = true;
				onready?.();
			}
		}
		void resolveOptions().catch((error) => {
			handleError('Could not load settings options.', error);
			if (mounted) {
				onready?.();
			}
		});
		return () => {
			mounted = false;
		};
	});
</script>

{#snippet setting(label: string, controls: Snippet, inline = false)}
	<div
		class="settings--setting"
		class:settings--setting--inline={inline}
		role="group"
		aria-label={label}
	>
		<h3>{label}</h3>
		<div class="settings--controls">{@render controls()}</div>
	</div>
{/snippet}

<div
	class="general-settings"
	class:general-settings--mobile={variant === 'mobile'}
	use:responsiveLayout={{ thresholdRem: 56, className: 'general-settings--compact' }}
>
	<nav class="general-settings__index" aria-label="General settings sections">
		{#each visibleSections as section (section.id)}
			<SyButton
				style="ghost"
				size="large"
				aria-current={currentSection === section.id ? 'location' : undefined}
				classes={['general-settings__section-link']}
				onclick={() => selectSection(section.id)}>{section.label}</SyButton
			>
		{/each}
	</nav>
	<div
		class="general-settings__body"
		bind:this={content}
		use:responsiveLayout={{ thresholdRem: 36, className: 'general-settings__body--stacked' }}
	>
		<div class="general-settings__picker">
			<SyDropdown
				fixed
				values={choices}
				aria-label="General settings sections"
				onselection={selectSection}
			>
				{#snippet children(_open, attributes)}
					<SyButton {...attributes} style="ghost" center>
						Jump to section <ChevronDown size="16" />
					</SyButton>
				{/snippet}
			</SyDropdown>
		</div>
		<section aria-labelledby={`${identifier}-help`} class="general-settings__section">
			<h2 id={`${identifier}-help`} tabindex="-1" use:sectionHeading={'help'}>
				Help &amp; Maintenance
			</h2>
			<WalkthroughSettings {variant} />
			{#snippet whatsNew()}<SyButton size="large" onclick={() => whatsNewStore.open()}
					>View changes</SyButton
				>{/snippet}
			{@render setting('What’s New', whatsNew)}
			{#if showUpdates}
				{#snippet updates()}<UpdateChecker />{/snippet}
				{@render setting('Updates', updates)}
			{/if}
			{#if hasSavedRecoveryReport}
				{#snippet recovery()}<BookmarkRecoverySettings />{/snippet}
				{@render setting('Bookmark Recovery', recovery)}
			{/if}
		</section>
		<section aria-labelledby={`${identifier}-dictionary`} class="general-settings__section">
			<h2 id={`${identifier}-dictionary`} tabindex="-1" use:sectionHeading={'dictionary'}>
				Chinese &amp; Dictionary
			</h2>
			{#snippet characters()}
				<CharacterSetSelector
					variant={controlVariant}
					label="Character set"
					onchange={updateCharacterSetPreference}
				/>
			{/snippet}
			{@render setting('Character set', characters)}
			{#snippet hsk()}
				<p id={`${identifier}-hsk-description`} class="settings--description">
					Choose which vocabulary standard supplies the level labels shown on dictionary
					entries.
				</p>
				<HskVariantSelector
					variant={controlVariant}
					label="HSK standard"
					describedBy={`${identifier}-hsk-description`}
					onchange={updateHskVariantPreference}
				/>
			{/snippet}
			{@render setting('HSK standard', hsk)}
			{#snippet metadata()}
				<DictionaryMetadataSettings
					variant={controlVariant}
					onqualifierschange={updateShowQualifiersPreference}
					onpartsofspeechchange={updateShowPartsOfSpeechPreference}
					onalternativepronunciationschange={updateShowAlternativePronunciationsPreference}
				/>
			{/snippet}
			{@render setting('Dictionary details', metadata)}
		</section>
		<section aria-labelledby={`${identifier}-appearance`} class="general-settings__section">
			<h2 id={`${identifier}-appearance`} tabindex="-1" use:sectionHeading={'appearance'}>
				Appearance
			</h2>
			{#snippet contrast()}<IncreaseContrastSettings
					variant={controlVariant}
					showLabel={false}
				/>{/snippet}
			{@render setting('Increase Contrast', contrast, true)}
			{#snippet pinyin()}<PinyinSettings />{/snippet}
			{@render setting('Show pinyin', pinyin)}
			{#snippet coloring()}
				<ToneColoringSettings
					variant={controlVariant}
					oncharacterschange={updateColorCharactersByTonePreference}
					onpinyinchange={updateColorPinyinByTonePreference}
					onlistschange={updateColorListsByTonePreference}
				/>
			{/snippet}
			{@render setting('Tone Coloring', coloring)}
			{#snippet palette()}<ToneColorPicker
					variant={controlVariant}
					onchange={updateToneColorsPreference}
				/>{/snippet}
			{@render setting('Tone Colors', palette)}
		</section>
		{#if showDevPreferences}
			<section aria-labelledby={`${identifier}-developer`} class="general-settings__section">
				<h2 id={`${identifier}-developer`} tabindex="-1" use:sectionHeading={'developer'}>
					Developer
				</h2>
				{#if variant === 'desktop'}
					{#snippet beta()}
						<SyToggle
							checked={getPreferenceManager().get('beta')}
							accessibleLabel="Under Construction Features"
							onchange={updateBetaPreference}
						/>
					{/snippet}
					{@render setting('Under Construction Features', beta, true)}
				{/if}
				{#snippet migration()}<DatabaseMigrationPreview />{/snippet}
				{@render setting('Database Migration', migration)}
				{#snippet resetTours()}<WalkthroughReset />{/snippet}
				{@render setting('Feature tour testing', resetTours)}
				{#snippet releaseTesting()}<WhatsNewTesting />{/snippet}
				{@render setting('What’s New testing', releaseTesting)}
				{#snippet onboarding()}
					<p class="settings--description">
						Show first-run setup again. Your words and documents are kept.
					</p>
					<SyButton onclick={() => privacySettingsStore.requestOnboardingReplay()}
						>Show again</SyButton
					>
				{/snippet}
				{@render setting('Replay onboarding', onboarding)}
			</section>
		{/if}
	</div>
</div>

<style>
	.general-settings {
		display: grid;
		grid-template-columns: 12rem minmax(0, 52rem);
		gap: var(--sy-space--extra-large);
		align-items: start;
		min-width: 0;
	}
	.general-settings__index {
		position: sticky;
		top: var(--sy-space--large);
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
	}
	.general-settings__index :global(.general-settings__section-link) {
		margin: 0;
		text-align: left;
		border-inline-start: 2px solid transparent;
		border-radius: 0;
	}
	.general-settings__index :global([aria-current='location']) {
		color: var(--sy-text--blue);
		border-inline-start-color: var(--sy-color--blue-2);
		font-weight: var(--sy-font-weight--bold);
	}
	.general-settings__body {
		--settings-row-columns: 12rem minmax(0, 1fr);
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-space--extra-large) * 2);
		min-width: 0;
		max-width: 52rem;
	}
	.general-settings__picker {
		display: none;
	}
	.general-settings__picker :global(.sy-button) {
		gap: var(--sy-space--large);
		margin: 0;
	}
	.general-settings__section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		min-width: 0;
	}
	.general-settings__section + .general-settings__section {
		border-top: var(--sy-border);
		padding-top: calc(var(--sy-space--extra-large) * 2);
	}
	h2 {
		margin: 0;
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
	}
	.settings--setting {
		display: grid;
		grid-template-columns: var(--settings-row-columns);
		gap: var(--sy-space--extra-large);
		align-items: start;
		min-width: 0;
	}
	h3 {
		margin: 0;
		padding-block: var(--sy-space);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--regular);
		overflow-wrap: anywhere;
	}
	.settings--controls {
		min-width: 0;
	}
	.settings--description {
		margin: 0 0 var(--sy-space--large);
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--muted);
		line-height: var(--sy-line-height--body);
	}
	.settings--setting--inline {
		align-items: center;
	}
	.general-settings:global(.general-settings--compact),
	.general-settings--mobile {
		grid-template-columns: minmax(0, 1fr);
	}
	.general-settings:global(.general-settings--compact) .general-settings__index,
	.general-settings--mobile .general-settings__index {
		display: none;
	}
	.general-settings:global(.general-settings--compact) .general-settings__picker,
	.general-settings--mobile .general-settings__picker {
		display: block;
		margin-bottom: calc(-1 * var(--sy-space--extra-large));
	}
	.general-settings--mobile .general-settings__body,
	.general-settings__body:global(.general-settings__body--stacked) {
		--settings-row-columns: minmax(0, 1fr);
	}
	.general-settings--mobile .settings--setting,
	.general-settings__body:global(.general-settings__body--stacked) .settings--setting {
		gap: var(--sy-space--large);
	}
	.general-settings--mobile .settings--setting--inline,
	.general-settings__body:global(.general-settings__body--stacked) .settings--setting--inline {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
	}
	.general-settings--mobile .general-settings__body {
		gap: var(--sy-mobile-space--extra-large);
	}
	.general-settings--mobile .general-settings__section {
		gap: var(--sy-mobile-space--large);
	}
	.general-settings--mobile .general-settings__section + .general-settings__section {
		padding-top: var(--sy-mobile-space--extra-large);
	}
	.general-settings--mobile h2 {
		font-size: var(--sy-font-size--mobile-large);
	}
	.general-settings--mobile h3 {
		font-size: var(--sy-font-size--mobile-medium);
	}
	.general-settings--mobile .settings--description {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
