<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';
	import { router } from 'svelte-spa-router';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import WhatsNewTesting from '@/components/WhatsNew/WhatsNewTesting.svelte';
	import WalkthroughSettings from '@/components/Walkthrough/WalkthroughSettings.svelte';
	import WalkthroughReset from '@/components/Walkthrough/WalkthroughReset.svelte';
	import ChinesePreferencesPreview from '@/components/Onboarding/ChinesePreferencesPreview.svelte';
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
	import SyListContent from '@/components/SyList/SyListContent.svelte';
	import SyListItem from '@/components/SyList/SyListItem.svelte';
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
		section = undefined,
		scrollContainer,
		onready,
	}: {
		variant?: 'desktop' | 'mobile';
		section?: 'help' | 'dictionary' | 'appearance' | 'developer';
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
	const SECTION_POSITION_TOLERANCE = 1;
	const BOTTOM_TOLERANCE = 2;
	const MIN_OPTIONS_SPACE = 192;
	const PREVIEW_FOCUS_GAP = 10;
	const controlVariant = $derived(variant === 'mobile' || isIPad() ? 'mobile' : 'desktop');
	let content = $state<HTMLDivElement>();
	let currentSection = $state('help');
	let showDevPreferences = $state(isDevBuild());
	let showUpdates = $state(false);
	let hasSavedRecoveryReport = $state(false);
	let optionsReady = $state(false);
	let appliedQuery = '';
	let previewElement = $state<HTMLDivElement>();
	let previewSize = $state<DOMRectReadOnly>();
	let scrollHeight = $state(0);
	const pinPreview = $derived(
		variant === 'mobile' &&
			!!previewSize &&
			scrollHeight > previewSize.height + MIN_OPTIONS_SPACE
	);
	$effect(() => {
		if (variant !== 'mobile' || !scrollContainer) {
			return undefined;
		}
		const observer = new ResizeObserver(() => {
			scrollHeight = scrollContainer.clientHeight;
		});
		observer.observe(scrollContainer);
		scrollHeight = scrollContainer.clientHeight;
		return () => observer.disconnect();
	});
	function keepAppearanceFocusVisible(event: FocusEvent): void {
		if (
			!pinPreview ||
			!previewElement ||
			!scrollContainer ||
			!(event.target instanceof HTMLElement)
		) {
			return;
		}
		const target =
			event.target instanceof HTMLInputElement
				? (event.target.labels?.[0] ?? event.target)
				: event.target;
		const top = previewElement.getBoundingClientRect().bottom + PREVIEW_FOCUS_GAP;
		if (target.getBoundingClientRect().top < top) {
			scrollContainer.scrollTop -= top - target.getBoundingClientRect().top;
		}
	}
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
		const target =
			control ??
			(variant === 'mobile' ? document.getElementById('mobile-settings-title') : heading);
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
		const top =
			scrollContainer.getBoundingClientRect().top +
			SECTION_OFFSET +
			SECTION_POSITION_TOLERANCE;
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
	<SyListItem>
		<div
			class="settings--setting"
			class:settings--setting--inline={inline}
			role="group"
			aria-label={label}
		>
			<h3>{label}</h3>
			<div class="settings--controls">{@render controls()}</div>
		</div>
	</SyListItem>
{/snippet}

<div
	class="general-settings"
	class:general-settings--mobile={variant === 'mobile'}
	class:general-settings--touch={controlVariant === 'mobile'}
	class:general-settings--detail={section !== undefined}
	use:responsiveLayout={{ thresholdRem: 56, className: 'general-settings--compact' }}
>
	{#if !section}<nav class="general-settings__index" aria-label="General settings sections">
			{#each visibleSections as section (section.id)}
				<SyButton
					style="ghost"
					size="large"
					aria-current={currentSection === section.id ? 'location' : undefined}
					classes={['general-settings__section-link']}
					onclick={() => selectSection(section.id)}>{section.label}</SyButton
				>
			{/each}
		</nav>{/if}
	<div
		class="general-settings__body"
		bind:this={content}
		use:responsiveLayout={{ thresholdRem: 36, className: 'general-settings__body--stacked' }}
	>
		{#if !section}<div class="general-settings__picker">
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
			</div>{/if}
		{#if !section || section === 'help'}
			<section aria-labelledby={`${identifier}-help`} class="general-settings__section">
				<h2
					class="sy-content-list-title"
					id={`${identifier}-help`}
					tabindex="-1"
					use:sectionHeading={'help'}
				>
					Help &amp; Maintenance
				</h2>
				<SyListContent bare={variant === 'mobile'}>
					<div class="sy-list--items">
						<SyListItem>
							<WalkthroughSettings {variant} />
						</SyListItem>
						{#snippet whatsNew()}<SyButton
								size="large"
								onclick={() => whatsNewStore.open()}>View changes</SyButton
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
					</div>
				</SyListContent>
			</section>
		{/if}
		{#if !section || section === 'dictionary'}
			<section aria-labelledby={`${identifier}-dictionary`} class="general-settings__section">
				<h2
					class="sy-content-list-title"
					id={`${identifier}-dictionary`}
					tabindex="-1"
					use:sectionHeading={'dictionary'}
				>
					Chinese &amp; Dictionary
				</h2>
				<SyListContent bare={variant === 'mobile'}>
					<div class="sy-list--items">
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
								Choose which vocabulary standard supplies the level labels shown on
								dictionary entries.
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
					</div>
				</SyListContent>
			</section>
		{/if}
		{#if !section || section === 'appearance'}
			<section
				aria-labelledby={`${identifier}-appearance`}
				class="general-settings__section"
				onfocusin={keepAppearanceFocusVisible}
			>
				<h2
					class="sy-content-list-title"
					id={`${identifier}-appearance`}
					tabindex="-1"
					use:sectionHeading={'appearance'}
				>
					Appearance
				</h2>
				<div
					class="general-settings__appearance-layout"
					use:responsiveLayout={{
						thresholdRem: 42,
						className: 'general-settings__appearance-layout--stacked',
					}}
				>
					<div
						class="general-settings__appearance-preview"
						class:general-settings__appearance-preview--sticky={pinPreview}
						bind:this={previewElement}
						bind:contentRect={previewSize}
					>
						<ChinesePreferencesPreview
							variant={variant === 'desktop' ? 'settings' : 'onboarding'}
						/>
					</div>
					<div class="general-settings__appearance-controls">
						<SyListContent bare={variant === 'mobile'}>
							<div class="sy-list--items">
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
							</div>
						</SyListContent>
					</div>
				</div>
			</section>
		{/if}
		{#if showDevPreferences && (!section || section === 'developer')}
			<section aria-labelledby={`${identifier}-developer`} class="general-settings__section">
				<h2
					class="sy-content-list-title"
					id={`${identifier}-developer`}
					tabindex="-1"
					use:sectionHeading={'developer'}
				>
					Developer
				</h2>
				<SyListContent bare={variant === 'mobile'}>
					<div class="sy-list--items">
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
					</div>
				</SyListContent>
			</section>
		{/if}
	</div>
</div>

<style>
	.general-settings {
		display: grid;
		grid-template-columns: 12rem minmax(0, 1fr);
		gap: var(--sy-space--extra-large);
		align-items: start;
		width: 100%;
		max-width: 74rem;
		margin-inline: auto;
		min-width: 0;
	}
	.general-settings:not(.general-settings--touch) {
		--sy-settings-option-font-size: var(--sy-font-size--button-medium);
		--sy-radio-choice-font: var(--sy-type--control-label);
		--sy-toggle-track-width: 2.75rem;
		--sy-toggle-track-height: 1.5rem;
		--sy-toggle-knob-inset: 0.125rem;
		--sy-toggle-knob-size: 1.25rem;
		--sy-toggle-knob-active-width: 1.625rem;
	}
	.general-settings__index {
		position: sticky;
		top: var(--sy-space--large);
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		padding: var(--sy-space);
		background: var(--sy-surface--well);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-inner-shadow);
	}
	.general-settings__index :global(.general-settings__section-link) {
		margin: 0;
		text-align: left;
		font-size: var(--sy-font-size--small);
		border-inline-start: 2px solid transparent;
		border-radius: 0;
	}
	.general-settings__index :global([aria-current='location']) {
		color: var(--sy-text--blue);
		border-inline-start-color: var(--sy-color--blue-2);
		font-weight: var(--sy-font-weight--bold);
	}
	.general-settings__body {
		--settings-row-columns: 10rem minmax(0, 1fr);
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		min-width: 0;
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
		gap: var(--sy-space--large);
		min-width: 0;
	}
	.general-settings:not(.general-settings--mobile) .general-settings__section > h2 {
		margin: 0 0 var(--sy-space);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}
	.general-settings__section :global(.sy-list--container) {
		margin: 0;
	}
	.general-settings:not(.general-settings--mobile)
		.general-settings__section
		:global(.sy-list--container) {
		padding: 0;
		overflow: hidden;
	}
	.general-settings:not(.general-settings--mobile)
		.general-settings__section
		:global(.sy-list--list-item) {
		padding: var(--sy-space--large) calc(var(--sy-space--large) + var(--sy-space));
	}
	.general-settings__appearance-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 0.9fr);
		grid-template-areas: 'controls preview';
		gap: var(--sy-space--extra-large);
		align-items: start;
		min-width: 0;
	}
	.general-settings__appearance-controls {
		grid-area: controls;
		min-width: 0;
	}
	.general-settings__appearance-preview {
		grid-area: preview;
		min-width: 0;
		background: var(--sy-surface--floating);
		border-radius: var(--sy-border-radius--content-list);
	}
	.general-settings:not(.general-settings--mobile) .general-settings__appearance-preview {
		padding: var(--sy-space--extra-large);
		box-shadow: var(--sy-shadow--content);
	}
	.general-settings:not(.general-settings--mobile)
		.general-settings__appearance-layout:not(
			:global(.general-settings__appearance-layout--stacked)
		)
		.general-settings__appearance-preview {
		position: sticky;
		top: var(--sy-space--large);
	}
	.general-settings--mobile .general-settings__appearance-preview--sticky {
		position: sticky;
		top: 0;
		z-index: 1;
		box-shadow: var(--sy-box-shadow);
	}
	.general-settings__appearance-layout:global(.general-settings__appearance-layout--stacked) {
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'preview' 'controls';
	}
	.general-settings__section + .general-settings__section {
		padding-top: var(--sy-space--extra-large);
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
		font-size: var(--sy-settings-option-font-size);
		font-weight: var(--sy-font-weight--regular);
		overflow-wrap: anywhere;
	}
	.general-settings:not(.general-settings--mobile) h3 {
		font-weight: 600;
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
	.general-settings--mobile .general-settings__appearance-layout {
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'preview' 'controls';
	}
	.general-settings--mobile .general-settings__section {
		gap: var(--sy-mobile-space--large);
	}
	.general-settings--mobile .general-settings__section :global(.sy-list--list-item) {
		padding: 0;
	}
	.general-settings--mobile .general-settings__section + .general-settings__section {
		padding-top: var(--sy-mobile-space--extra-large);
	}
	.general-settings--mobile h2 {
		margin: 0;
		font-size: var(--sy-font-size--mobile-large);
	}
	.general-settings--detail h2 {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.general-settings--mobile h3 {
		font-size: var(--sy-font-size--mobile-medium);
	}
	.general-settings--mobile .settings--description {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
