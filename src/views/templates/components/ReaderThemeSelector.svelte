<script lang="ts">
	import { Palette } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import {
		getReaderColorTheme,
		READER_COLOR_THEMES,
	} from '@/reader/settings/defaults.js';
	import type { ReaderColorThemeId } from '@/reader/types.js';

	type Props = {
		colorTheme: ReaderColorThemeId;
		systemPrefersDark?: boolean;
		onchange?: (_theme: ReaderColorThemeId) => void;
	};

	const {
		colorTheme,
		systemPrefersDark = false,
		onchange,
	}: Props = $props();
</script>

<SyButtonBar size="large" aria-label="Reader theme">
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

<style>
	.reader-theme-selector__content {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
		font-size: 0.82rem;
	}

	.reader-theme-selector__swatch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 1px solid var(--sy-color--grey-2);
		border-radius: 50%;
		box-sizing: border-box;
	}
</style>
