<script lang="ts">
	import CharacterSetSelector from '@/components/SettingsOption/CharacterSetSelector.svelte';
	import ToneColoringSettings from '@/components/SettingsOption/ToneColoringSettings.svelte';
	import ChinesePreferencesPreview from '@/components/Onboarding/ChinesePreferencesPreview.svelte';
	import {
		updateCharacterSetPreference,
		updateColorCharactersByTonePreference,
		updateColorListsByTonePreference,
		updateColorPinyinByTonePreference,
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
	<h2 class="chinese-prefs__title">Chinese display</h2>
	<p class="chinese-prefs__intro">Choose how characters and tone colors appear in Syng.</p>
	<div class="chinese-prefs__layout">
		{#if variant === 'mobile'}
			<section class="chinese-prefs__section" aria-labelledby="onboarding-characters-heading">
				<h3 id="onboarding-characters-heading">Characters</h3>
				<CharacterSetSelector variant="mobile" onchange={updateCharacterSetPreference} />
			</section>
			<ChinesePreferencesPreview />
			<section class="chinese-prefs__section" aria-labelledby="onboarding-tones-heading">
				<h3 id="onboarding-tones-heading">Tone coloring</h3>
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
					<CharacterSetSelector onchange={updateCharacterSetPreference} />
				</section>
				<section class="chinese-prefs__section" aria-labelledby="onboarding-tones-heading">
					<h3 id="onboarding-tones-heading">Tone coloring</h3>
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
		gap: var(--sy-space--extra-large);
	}

	.chinese-prefs__title {
		margin: 0;
		font-size: var(--sy-font-size--large);
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

	.chinese-prefs__section h3 {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
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
		font-size: var(--sy-font-size--mobile-extra-large);
	}

	:global(.onboarding-flow--mobile) .chinese-prefs__intro,
	:global(.onboarding-flow--mobile) .chinese-prefs__section h3 {
		font-size: var(--sy-font-size--mobile-medium);
	}
</style>
