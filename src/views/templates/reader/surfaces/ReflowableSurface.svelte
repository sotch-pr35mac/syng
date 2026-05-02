<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { applyReaderTheme } from '@/reader/layout/reflowableLayout.js';
	import { getLookupTargetFromPoint } from '@/reader/lookup/dictionaryLookup.js';
	import type {
		ReaderLookupTarget,
		ReaderResource,
		ReaderThemeSettings,
	} from '@/reader/types.js';

	interface Props {
		resource: ReaderResource;
		settings: ReaderThemeSettings;
		onlookup?: (_target: ReaderLookupTarget) => void;
		onready?: (_element: HTMLElement) => void;
	}

	const {
		resource,
		settings,
		onlookup = (_target) => {},
		onready = (_element) => {},
	}: Props = $props();
	let surfaceElement = $state<HTMLElement | undefined>(undefined);

	onMount(() => {
		if (surfaceElement) {
			onready(surfaceElement);
		}
	});

	$effect(() => {
		if (!surfaceElement) {
			return;
		}
		applyReaderTheme(surfaceElement, settings);
		tick()
			.then(() => onready(surfaceElement as HTMLElement))
			.catch(() => {});
	});

	function handlePointerUp(event: PointerEvent): void {
		if (!surfaceElement) {
			return;
		}
		const target = getLookupTargetFromPoint(
			document,
			event.clientX,
			event.clientY,
			resource.href
		);
		if (target) {
			onlookup(target);
		}
	}
</script>

<article
	bind:this={surfaceElement}
	class="reader-surface"
	class:reader-surface--scroll={settings.view === 'scroll'}
	onpointerup={handlePointerUp}
>
	{#if resource.html}
		<!-- Sanitized by the publication adapter before it reaches this surface. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html resource.html}
	{:else}
		<p>{resource.text}</p>
	{/if}
</article>

<style>
	.reader-surface {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: calc(3rem * var(--reader-margin-scale, 1));
		overflow: hidden;
		box-sizing: border-box;
		background: var(--reader-background-color, #fff);
		color: var(--reader-text-color, #171717);
		column-count: var(--reader-column-count, 1);
		column-gap: calc(4rem * var(--reader-margin-scale, 1));
		font-family: var(--reader-font-family, serif);
		font-size: var(--reader-font-size, 100%);
		line-height: var(--reader-line-height, 1.8);
		writing-mode: var(--reader-writing-mode, horizontal-tb);
	}

	.reader-surface--scroll {
		overflow: auto;
		column-count: 1;
	}

	.reader-surface :global(a) {
		color: var(--reader-link-color, #1f6feb);
		pointer-events: none;
		cursor: inherit;
	}

	.reader-surface ::selection {
		background: var(--reader-selection-background-color, #dbeafe);
		color: var(--reader-selection-text-color, #111827);
	}
</style>
