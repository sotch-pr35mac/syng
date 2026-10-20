<script lang="ts">
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { contrastStore } from '@/stores/contrast.svelte.js';
	import { getPreferenceManager } from '@/utils/appServices.js';
	import { THEME_TONE_COLOR_TOKENS } from '@/utils/tones.js';

	/**
	 * @typedef {Object} Props
	 * @property {'desktop' | 'mobile'} [variant] - Visual density/layout variant
	 * @property {(data: {hasCustomColors: boolean, colors: string[]}) => void} [onchange] - Change handler
	 */
	/** @type {Props} */
	const {
		variant = 'desktop',
		onchange,
	}: {
		variant?: 'desktop' | 'mobile';
		onchange?: (_data: { hasCustomColors: boolean; colors: string[] }) => void;
	} = $props();

	const pickerId = $props.id();
	const RGB_CHANNELS = 3;
	const HEX_RADIX = 16;
	const labels = ['First Tone', 'Second Tone', 'Third Tone', 'Fourth Tone', 'No Tone'];
	const savedColors = getPreferenceManager().get('toneColors');
	let hasCustomColors = $state(Boolean(savedColors.hasCustomColors));

	function resolveColor(value: string): string {
		if (/^#[0-9a-f]{6}$/i.test(value)) {
			return value;
		}
		const sample = document.createElement('span');
		sample.style.color = value.startsWith('--') ? `var(${value})` : value;
		document.body.appendChild(sample);
		const resolved = getComputedStyle(sample).color;
		sample.remove();
		const channels = resolved.match(/[\d.]+/g)?.slice(0, RGB_CHANNELS);
		return channels?.length === RGB_CHANNELS
			? `#${channels.map((channel) => Math.round(Number(channel)).toString(HEX_RADIX).padStart(2, '0')).join('')}`
			: '#000000';
	}

	let colors = $state<string[]>(savedColors.colors.map(resolveColor));
	let previousIncreaseContrast = contrastStore.increaseContrast;

	function refreshThemeColors(): void {
		if (!hasCustomColors) {
			colors = THEME_TONE_COLOR_TOKENS.map(resolveColor);
		}
	}

	$effect(() => {
		const increaseContrast = contrastStore.increaseContrast;
		if (increaseContrast !== previousIncreaseContrast) {
			refreshThemeColors();
			previousIncreaseContrast = increaseContrast;
		}
	});

	function handleUpdate(index: number, event: Event): void {
		colors[index] = (event.currentTarget as HTMLInputElement).value;
		hasCustomColors = true;
		onchange?.({ hasCustomColors: true, colors: [...colors] });
	}

	function resetColors(): void {
		hasCustomColors = false;
		colors = THEME_TONE_COLOR_TOKENS.map(resolveColor);
		onchange?.({ hasCustomColors: false, colors: [...THEME_TONE_COLOR_TOKENS] });
	}

	onMount(() => {
		const query = window.matchMedia?.('(prefers-color-scheme: dark)');
		query?.addEventListener?.('change', refreshThemeColors);
		return () => query?.removeEventListener?.('change', refreshThemeColors);
	});
</script>

<div class="tone-color-picker" class:tone-color-picker--mobile={variant === 'mobile'}>
	{#each labels as label, index (label)}
		<div class="tone-color-picker--tone">
			<label for={`${pickerId}-tone-${index + 1}`}>{label}</label>
			<input
				type="color"
				value={colors[index]}
				id={`${pickerId}-tone-${index + 1}`}
				name={`tone-${index + 1}`}
				onchange={(event) => handleUpdate(index, event)}
			/>
		</div>
	{/each}
	<SyButton style="ghost" onclick={resetColors} disabled={!hasCustomColors}
		>Reset to theme colors</SyButton
	>
</div>

<style>
	.tone-color-picker {
		display: flex;
		flex-direction: column;
	}
	.tone-color-picker--tone {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sy-space);
	}

	.tone-color-picker--tone label {
		font-size: var(--sy-font-size--medium);
	}

	.tone-color-picker--tone input {
		width: var(--sy-mobile-touch-target);
		height: var(--sy-mobile-space--extra-large);
	}

	.tone-color-picker--mobile {
		gap: var(--sy-space);
	}

	.tone-color-picker--mobile .tone-color-picker--tone {
		min-height: 48px;
		padding: calc(var(--sy-mobile-space--extra-small) * 3) 0;
	}

	.tone-color-picker--mobile .tone-color-picker--tone label {
		font-size: var(--sy-font-size--mobile-medium);
	}

	.tone-color-picker--mobile .tone-color-picker--tone input {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background-color: transparent;
		overflow: hidden;
		appearance: none;
		-webkit-appearance: none;
	}

	.tone-color-picker--mobile .tone-color-picker--tone input::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.tone-color-picker--mobile .tone-color-picker--tone input::-webkit-color-swatch {
		border: var(--sy-border);
		border-radius: 50%;
	}

	.tone-color-picker--mobile .tone-color-picker--tone input::-moz-color-swatch {
		border: var(--sy-border);
		border-radius: 50%;
	}
</style>
