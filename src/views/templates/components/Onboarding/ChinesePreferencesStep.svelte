<script lang="ts">
	/**
	 * Chinese display setup and its live preview. OnboardingFlow owns the scrollport
	 * and footer; this step reports the space obscured by its pinned preview.
	 * CSS handles positioning. Svelte dimension bindings measure the actual content
	 * so settings, wrapping, and system text size can disable pinning when it would
	 * crowd the controls. No viewport-height approximation or scroll animation is used.
	 */
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import DictionaryMetadataSettings from '@/components/SettingsOption/DictionaryMetadataSettings.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import ChinesePreferencesPreview from '@/components/Onboarding/ChinesePreferencesPreview.svelte';
	import {
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
		updateHskVariantPreference,
		updateShowAlternativePronunciationsPreference,
		updateShowPartsOfSpeechPreference,
		updateShowQualifiersPreference,
	} from '@/composables/settings.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		scrollContainer?: HTMLElement;
		/** Scrollport content height, excluding its padding and the persistent footer. */
		availableHeight: number;
		/** Extra scroll padding needed for the stacked preview; owned by OnboardingFlow. */
		onpreviewoffsetchange?: (offset: number) => void;
	}

	const {
		variant = 'desktop',
		scrollContainer,
		availableHeight,
		onpreviewoffsetchange,
	}: Props = $props();
	const MINIMUM_OPTIONS_HEIGHT_REM = 12;
	let layout: HTMLDivElement | undefined = $state();
	let preview: HTMLDivElement | undefined = $state();
	let layoutSize: DOMRectReadOnly | undefined = $state();
	let previewSize: DOMRectReadOnly | undefined = $state();

	const stacked = $derived(
		!!layoutSize && !!previewSize && previewSize.width >= layoutSize.width - 1
	);
	const spacing = $derived.by(() => {
		// Dimension changes also invalidate CSS measurements after wrapping/text scaling.
		if (!layout || !layoutSize || !previewSize) {
			return { gap: 0, optionsHeight: 0 };
		}
		return {
			gap: parseFloat(getComputedStyle(layout).rowGap),
			optionsHeight:
				MINIMUM_OPTIONS_HEIGHT_REM *
				parseFloat(getComputedStyle(document.documentElement).fontSize),
		};
	});
	// Stacked layouts must leave a readable area for options beneath the full preview.
	const sticky = $derived(
		!!previewSize &&
			availableHeight > 0 &&
			previewSize.height + (stacked ? spacing.gap + spacing.optionsHeight : 0) <=
				availableHeight
	);
	$effect(() => {
		onpreviewoffsetchange?.(sticky && stacked ? (previewSize?.height ?? 0) + spacing.gap : 0);
	});

	/** Keep keyboard focus below the pinned preview when the browser's own scroll
	 * adjustment ignores scroll-padding. SyToggle focuses a clipped input, so use
	 * its visible label's bounds to protect the entire control and focus indicator.
	 */
	function keepFocusVisible(event: FocusEvent) {
		const target = event.target;
		if (
			!sticky ||
			!stacked ||
			!preview ||
			!scrollContainer ||
			!(target instanceof HTMLElement)
		) {
			return;
		}
		const visibleTarget =
			target instanceof HTMLInputElement ? (target.labels?.[0] ?? target) : target;
		const targetBounds = visibleTarget.getBoundingClientRect();
		const bodyBounds = scrollContainer.getBoundingClientRect();
		const top = preview.getBoundingClientRect().bottom + spacing.gap;
		if (targetBounds.top < top) {
			scrollContainer.scrollTop -= top - targetBounds.top;
		} else if (targetBounds.bottom > bodyBounds.bottom) {
			scrollContainer.scrollTop += targetBounds.bottom - bodyBounds.bottom;
		}
	}
</script>

<div
	class="chinese-prefs"
	class:chinese-prefs--desktop={variant === 'desktop'}
	class:chinese-prefs--mobile={variant === 'mobile'}
>
	<header class="chinese-prefs__header">
		<h2 class="chinese-prefs__title">Chinese display</h2>
		<p class="chinese-prefs__intro">
			Choose how characters, dictionary details, HSK levels, and tone colors appear throughout
			Syng. You can change any of these later in Settings.
		</p>
	</header>
	<div class="chinese-prefs__layout" bind:this={layout} bind:contentRect={layoutSize}>
		<div
			class="chinese-prefs__preview"
			class:chinese-prefs__preview--sticky={sticky}
			bind:this={preview}
			bind:contentRect={previewSize}
		>
			<ChinesePreferencesPreview />
		</div>
		<div class="chinese-prefs__controls" onfocusin={keepFocusVisible}>
			<section class="chinese-prefs__section" aria-labelledby="onboarding-characters-heading">
				<h3 id="onboarding-characters-heading">Characters</h3>
				<p>Choose which character forms appear in definitions and results.</p>
				<CharacterSetSelector {variant} onchange={updateCharacterSetPreference} />
			</section>
			<section class="chinese-prefs__section" aria-labelledby="onboarding-hsk-heading">
				<h3 id="onboarding-hsk-heading">HSK levels</h3>
				<p>Choose the framework Syng uses for vocabulary-level badges.</p>
				<HskVariantSelector {variant} onchange={updateHskVariantPreference} />
			</section>
			<section class="chinese-prefs__section" aria-labelledby="onboarding-tones-heading">
				<h3 id="onboarding-tones-heading">Tone coloring</h3>
				<p>Choose where tone colors help distinguish pronunciation.</p>
				<ToneColoringSettings
					{variant}
					oncharacterschange={updateColorCharactersByTonePreference}
					onpinyinchange={updateColorPinyinByTonePreference}
					onlistschange={updateColorListsByTonePreference}
				/>
			</section>
			<section class="chinese-prefs__section" aria-labelledby="onboarding-metadata-heading">
				<h3 id="onboarding-metadata-heading">Dictionary details</h3>
				<p>Choose which extra information appears alongside dictionary entries.</p>
				<DictionaryMetadataSettings
					{variant}
					onqualifierschange={updateShowQualifiersPreference}
					onpartsofspeechchange={updateShowPartsOfSpeechPreference}
					onalternativepronunciationschange={updateShowAlternativePronunciationsPreference}
				/>
			</section>
		</div>
	</div>
</div>

<style>
	.chinese-prefs {
		display: flex;
		flex-direction: column;
		gap: calc(var(--sy-space--extra-large) + var(--sy-space--large));
	}

	.chinese-prefs__header {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.chinese-prefs__title {
		margin: 0;
		font-size: var(--sy-font-size--heading);
		font-weight: var(--sy-font-weight--bold);
	}

	.chinese-prefs__intro {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.chinese-prefs__layout {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}

	.chinese-prefs__preview {
		min-width: 0;
		align-self: start;
		width: 100%;
		background: var(--sy-color--white);
	}

	.chinese-prefs__preview--sticky {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	/* Mask the scrollport's top padding while options pass behind the preview. */
	.chinese-prefs__preview--sticky::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		height: var(--onboarding-body-padding-top);
		background: var(--sy-color--white);
	}

	.chinese-prefs__controls,
	.chinese-prefs__section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.chinese-prefs__controls {
		gap: calc(var(--sy-space--extra-large) + var(--sy-space--large));
	}

	.chinese-prefs--mobile .chinese-prefs__controls {
		gap: var(--sy-space--extra-large);
	}

	.chinese-prefs__section h3 {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.chinese-prefs__section > p {
		margin: calc(var(--sy-space) * -1) 0 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.chinese-prefs--desktop .chinese-prefs__layout {
		display: grid;
		grid-template-columns: 1fr;
	}

	:global(.onboarding-flow:not(.onboarding-flow--compact))
		.chinese-prefs--desktop
		.chinese-prefs__layout {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: start;
	}

	:global(.onboarding-flow:not(.onboarding-flow--compact))
		.chinese-prefs--desktop
		.chinese-prefs__preview {
		grid-column: 2;
		grid-row: 1;
	}
	:global(.onboarding-flow:not(.onboarding-flow--compact))
		.chinese-prefs--desktop
		.chinese-prefs__controls {
		grid-column: 1;
		grid-row: 1;
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__title {
		font-size: var(--sy-font-size--mobile-heading);
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__intro,
	:global(.onboarding-flow--mobile) .chinese-prefs__section h3 {
		font-size: var(--sy-font-size--mobile-medium);
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__section > p {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
