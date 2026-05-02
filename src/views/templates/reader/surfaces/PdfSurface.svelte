<script lang="ts">
	import { onMount } from 'svelte';
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

	function handlePointerUp(event: PointerEvent): void {
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
	class="pdf-surface"
	style:--reader-pdf-zoom={settings.pdfZoom}
	onpointerup={handlePointerUp}
>
	<canvas class="pdf-surface__canvas" aria-hidden="true"></canvas>
	<div class="pdf-surface__text-layer" data-resource-href={resource.href}></div>
</article>

<style>
	.pdf-surface {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #f3f0ea;
		transform-origin: top left;
	}

	.pdf-surface__canvas,
	.pdf-surface__text-layer {
		position: absolute;
		inset: 0;
		transform: scale(var(--reader-pdf-zoom, 1));
		transform-origin: top left;
	}

	.pdf-surface__text-layer {
		color: transparent;
	}
</style>
