<script lang="ts">
	import { Palette } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import { getReaderColorTheme, READER_COLOR_THEMES } from '@/utils/readerSettings.js';
	import type { ReaderColorThemeId } from '@/types/reader.js';

	type Props = {
		colorTheme: ReaderColorThemeId;
		systemPrefersDark?: boolean;
		onchange?: (_theme: ReaderColorThemeId) => void;
	};

	const { colorTheme, systemPrefersDark = false, onchange }: Props = $props();
</script>

<div class="reader-theme-selector">
	<SyButtonBar
		class="reader-theme-selector__bar"
		size="large"
		role="group"
		aria-label="Reader theme"
	>
		{#each READER_COLOR_THEMES as theme (theme.id)}
			{@const resolvedTheme = getReaderColorTheme(theme.id, systemPrefersDark)}
			<SyButton
				grouped={true}
				center={true}
				color={colorTheme === theme.id ? 'blue' : undefined}
				aria-label={`Use ${theme.label} reader theme`}
				aria-pressed={colorTheme === theme.id}
				title={theme.label}
				onclick={() => onchange?.(theme.id)}
			>
				<span class="reader-theme-selector__content">
					<span
						class="reader-theme-selector__swatch"
						style={`background:${resolvedTheme.backgroundColor};color:${resolvedTheme.textColor};`}
						aria-hidden="true"
					>
						<Palette size="14" />
					</span>
					<span>{theme.label}</span>
				</span>
			</SyButton>
		{/each}
	</SyButtonBar>
</div>

<style>
	.reader-theme-selector {
		container-type: inline-size;
		container-name: reader-themes;
		min-width: 0;
	}

	.reader-theme-selector :global(.reader-theme-selector__bar) {
		display: grid;
		align-items: stretch;
		grid-template-columns: repeat(2, auto);
		row-gap: var(--sy-space);
		width: 100%;
	}

	.reader-theme-selector :global(.reader-theme-selector__bar > .sy-button:nth-child(odd)) {
		border-radius: var(--sy-space) 0 0 var(--sy-space);
	}
	.reader-theme-selector :global(.reader-theme-selector__bar > .sy-button:nth-child(even)) {
		border-radius: 0 var(--sy-space) var(--sy-space) 0;
	}

	@container reader-themes (min-width: 28rem) {
		.reader-theme-selector :global(.reader-theme-selector__bar) {
			grid-template-columns: repeat(4, auto);
		}
		.reader-theme-selector
			:global(.reader-theme-selector__bar > .sy-button:not(:first-child):not(:last-child)) {
			border-radius: 0;
		}
	}

	@container reader-themes (max-width: 20rem) {
		.reader-theme-selector :global(.reader-theme-selector__bar > .sy-button) {
			padding-inline: var(--sy-space);
		}
	}

	.reader-theme-selector__content {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.reader-theme-selector__swatch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--sy-color--grey-2);
		border-radius: 50%;
		box-sizing: border-box;
	}
</style>
