<script lang="ts">
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import HskVariantSelector from '@/components/SettingsOption/HskVariantSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import ChinesePreferencesPreview from '@/components/Onboarding/ChinesePreferencesPreview.svelte';
	import {
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
		updateHskVariantPreference,
	} from '@/composables/settings.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
	}

	const { variant = 'desktop' }: Props = $props();
</script>

<div
	class="chinese-prefs"
	class:chinese-prefs--desktop={variant === 'desktop'}
	class:chinese-prefs--mobile={variant === 'mobile'}
>
	<header class="chinese-prefs__header">
		<h2 class="chinese-prefs__title">Chinese display</h2>
		<p class="chinese-prefs__intro">
			Choose how characters, HSK levels, and tone colors appear throughout Syng. You can
			change any of these later in Settings.
		</p>
	</header>
	<div class="chinese-prefs__layout">
		{#if variant === 'mobile'}
			<section class="chinese-prefs__section" aria-labelledby="onboarding-characters-heading">
				<h3 id="onboarding-characters-heading">Characters</h3>
				<p>Choose which character forms appear in definitions and results.</p>
				<CharacterSetSelector variant="mobile" onchange={updateCharacterSetPreference} />
			</section>
			<ChinesePreferencesPreview />
			<section class="chinese-prefs__section" aria-labelledby="onboarding-hsk-heading">
				<h3 id="onboarding-hsk-heading">HSK levels</h3>
				<p>Choose the framework Syng uses for vocabulary-level badges.</p>
				<HskVariantSelector variant="mobile" onchange={updateHskVariantPreference} />
			</section>
			<section class="chinese-prefs__section" aria-labelledby="onboarding-tones-heading">
				<h3 id="onboarding-tones-heading">Tone coloring</h3>
				<p>Choose where tone colors help distinguish pronunciation.</p>
				<ToneColoringSettings
					variant="mobile"
					oncharacterschange={updateColorCharactersByTonePreference}
					onpinyinchange={updateColorPinyinByTonePreference}
					onlistschange={updateColorListsByTonePreference}
				/>
			</section>
		{:else}
			<div class="chinese-prefs__controls">
				<section
					class="chinese-prefs__section"
					aria-labelledby="onboarding-characters-heading"
				>
					<h3 id="onboarding-characters-heading">Characters</h3>
					<p>Choose which character forms appear in definitions and results.</p>
					<CharacterSetSelector onchange={updateCharacterSetPreference} />
				</section>
				<section class="chinese-prefs__section" aria-labelledby="onboarding-hsk-heading">
					<h3 id="onboarding-hsk-heading">HSK levels</h3>
					<p>Choose the framework Syng uses for vocabulary-level badges.</p>
					<HskVariantSelector onchange={updateHskVariantPreference} />
				</section>
				<section class="chinese-prefs__section" aria-labelledby="onboarding-tones-heading">
					<h3 id="onboarding-tones-heading">Tone coloring</h3>
					<p>Choose where tone colors help distinguish pronunciation.</p>
					<ToneColoringSettings
						oncharacterschange={updateColorCharactersByTonePreference}
						onpinyinchange={updateColorPinyinByTonePreference}
						onlistschange={updateColorListsByTonePreference}
					/>
				</section>
			</div>
			<ChinesePreferencesPreview />
		{/if}
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
		font-size: 1.5rem;
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

	.chinese-prefs__controls,
	.chinese-prefs__section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.chinese-prefs__controls {
		gap: calc(var(--sy-space--extra-large) + var(--sy-space--large));
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

	@container onboarding (min-width: 36rem) {
		.chinese-prefs--desktop .chinese-prefs__layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__title {
		font-size: 1.375rem;
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__intro,
	:global(.onboarding-flow--mobile) .chinese-prefs__section h3 {
		font-size: var(--sy-font-size--mobile-medium);
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__section > p {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
