<script lang="ts">
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	/** A measured, deterministic cloud. All words remain available in the frequency list. */
	import { onMount } from 'svelte';
	import { subscribeSystemTypography } from '@/composables/systemTypography.js';
	import type { WordFrequencyEntry } from '@/types/tools.js';
	const {
		entries,
		selectedWord,
		onopen,
	}: {
		entries: WordFrequencyEntry[];
		selectedWord: string | null;
		onopen: (event: MouseEvent, text: string) => void;
	} = $props();
	// Bound layout work and keep every hit target readable on touch screens.
	const COMPACT_WIDTH = 450;
	const COMPACT_HEIGHT = 300;
	const WIDE_HEIGHT = 360;
	const MAX_WORDS = 50;
	const FONT_RANGE = 1.7;
	const HORIZONTAL_PADDING = 16;
	const MIN_TARGET_HEIGHT = 44;
	const LINE_HEIGHT = 1.5;
	const MAX_STEPS = 2400;
	const ANGLE_STEP = 0.35;
	const RADIUS_STEP = 0.22;
	const HORIZONTAL_SPREAD = 1.5;
	const WORD_GAP = 3;
	let host: HTMLDivElement;
	let width = $state(0);
	let fontRevision = $state(0);
	let placements = $state<
		{
			entry: WordFrequencyEntry;
			left: number;
			top: number;
			size: number;
			width: number;
			height: number;
		}[]
	>([]);
	const height = $derived(width < COMPACT_WIDTH ? COMPACT_HEIGHT : WIDE_HEIGHT);
	onMount(() => {
		const observer = new ResizeObserver(() => {
			width = host.clientWidth;
		});
		observer.observe(host);
		let active = true;
		const fontsChanged = () => {
			if (active) {
				fontRevision += 1;
			}
		};
		const unsubscribeTypography = subscribeSystemTypography(fontsChanged);
		document.fonts?.ready.then(fontsChanged);
		document.fonts?.addEventListener('loadingdone', fontsChanged);
		return () => {
			active = false;
			unsubscribeTypography();
			observer.disconnect();
			document.fonts?.removeEventListener('loadingdone', fontsChanged);
		};
	});
	$effect(() => {
		void fontRevision;
		const availableWidth = width;
		const availableHeight = height;
		const candidates = entries.slice(0, MAX_WORDS);
		if (!availableWidth || !host) {
			return;
		}
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) {
			return;
		}
		const font = getComputedStyle(host).fontFamily;
		const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const maximum = Math.max(1, ...candidates.map((entry) => entry.count));
		const placed: typeof placements = [];
		for (const entry of candidates) {
			const size =
				rootSize * (1 + (FONT_RANGE * Math.log1p(entry.count)) / Math.log1p(maximum));
			context.font = `400 ${size}px ${font}`;
			const boxWidth = Math.ceil(context.measureText(entry.text).width) + HORIZONTAL_PADDING;
			const boxHeight = Math.max(MIN_TARGET_HEIGHT, Math.ceil(size * LINE_HEIGHT));
			for (let step = 0; step < MAX_STEPS; step += 1) {
				const angle = step * ANGLE_STEP;
				const radius = step * RADIUS_STEP;
				const left =
					availableWidth / 2 +
					Math.cos(angle) * radius * HORIZONTAL_SPREAD -
					boxWidth / 2;
				const top = availableHeight / 2 + Math.sin(angle) * radius - boxHeight / 2;
				if (
					left < 0 ||
					top < 0 ||
					left + boxWidth > availableWidth ||
					top + boxHeight > availableHeight
				) {
					continue;
				}
				if (
					placed.some(
						(other) =>
							left < other.left + other.width + WORD_GAP &&
							left + boxWidth + WORD_GAP > other.left &&
							top < other.top + other.height + WORD_GAP &&
							top + boxHeight + WORD_GAP > other.top
					)
				) {
					continue;
				}
				placed.push({ entry, left, top, size, width: boxWidth, height: boxHeight });
				break;
			}
		}
		placements = placed;
	});
</script>

<div class="cloud" bind:this={host} style:height={`${height}px`} aria-label="Frequent words">
	{#each placements as placement (placement.entry.text)}
		<button
			type="button"
			aria-current={selectedWord === placement.entry.text ? 'true' : undefined}
			style:left={`${placement.left}px`}
			style:top={`${placement.top}px`}
			style:width={`${placement.width}px`}
			style:height={`${placement.height}px`}
			style:font-size={`${placement.size}px`}
			title={`${placement.entry.text}: ${placement.entry.count}`}
			aria-label={`${placement.entry.text}, ${placement.entry.count} occurrences`}
			onclick={(event) => onopen(event, placement.entry.text)}
			><ChineseCharacters
				characters={placement.entry.text}
				tones={placement.entry.tones}
				colorByTone={dictionaryDisplaySettingsStore.settings.colorCharactersByTone}
			/></button
		>
	{/each}
</div>
<p class="caption">
	Showing {placements.length} of {entries.length} words. Larger words appear more often.
</p>

<style>
	.cloud {
		position: relative;
		width: 100%;
	}
	button {
		position: absolute;
		padding: 0 8px;
		border: 0;
		border-radius: var(--sy-border-radius, 5px);
		background: transparent;
		color: var(--sy-color--black);
		font-family: inherit;
		font-weight: 400;
		line-height: 1.5;
		white-space: nowrap;
		cursor: pointer;
		animation: settle 280ms ease-out;
	}
	button:hover,
	button[aria-current='true'] {
		color: var(--sy-text--blue);
	}
	/* Keep the word itself highlighted while its dictionary is open, even with tone colors. */
	button:hover :global(span),
	button[aria-current='true'] :global(span) {
		color: inherit;
	}
	button:focus-visible {
		outline: none;
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}
	.caption {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		margin: 0;
	}
	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			animation: none;
		}
	}
</style>
