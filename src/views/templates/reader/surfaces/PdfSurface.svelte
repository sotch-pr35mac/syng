<script lang="ts">
	import { onMount } from 'svelte';
	import { configurePdfJsWorker } from '@/reader/pdfjsWorker.js';
	import { getLookupTargetFromPoint } from '@/reader/lookup/dictionaryLookup.js';
	import type {
		ReaderLookupTarget,
		ReaderResource,
		ReaderThemeSettings,
	} from '@/reader/types.js';

	const MIN_PDF_SCALE = 0.1;

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
	let canvasElement = $state<HTMLCanvasElement | undefined>(undefined);
	let renderVersion = 0;

	onMount(() => {
		if (surfaceElement) {
			onready(surfaceElement);
		}
		const resizeObserver = new ResizeObserver(() => {
			renderPdfPage().catch(() => {});
		});
		if (surfaceElement) {
			resizeObserver.observe(surfaceElement);
		}
		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		resource.href;
		settings.pdfZoom;
		renderPdfPage().catch(() => {});
	});

	function asArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
		if (data instanceof ArrayBuffer) {
			return data.slice(0);
		}
		const copy = new Uint8Array(data.byteLength);
		copy.set(data);
		return copy.buffer;
	}

	async function renderPdfPage(): Promise<void> {
		if (!surfaceElement || !canvasElement || !resource.data) {
			return;
		}
		const currentRender = (renderVersion += 1);
		const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
		configurePdfJsWorker(GlobalWorkerOptions);
		const pdf = await getDocument({ data: asArrayBuffer(resource.data) }).promise;
		const page = await pdf.getPage((resource.pageIndex ?? 0) + 1);
		if (currentRender !== renderVersion) {
			await pdf.destroy();
			return;
		}

		const baseViewport = page.getViewport({ scale: 1 });
		const fitScale = Math.max(MIN_PDF_SCALE, surfaceElement.clientWidth / baseViewport.width);
		const viewport = page.getViewport({ scale: fitScale * settings.pdfZoom });
		const context = canvasElement.getContext('2d');
		if (!context) {
			await pdf.destroy();
			return;
		}

		canvasElement.width = Math.ceil(viewport.width);
		canvasElement.height = Math.ceil(viewport.height);
		canvasElement.style.width = `${viewport.width}px`;
		canvasElement.style.height = `${viewport.height}px`;
		surfaceElement.style.setProperty('--reader-pdf-page-width', `${viewport.width}px`);
		surfaceElement.style.setProperty('--reader-pdf-page-height', `${viewport.height}px`);

		await page.render({ canvas: canvasElement, canvasContext: context, viewport }).promise;
		await pdf.destroy();
		if (surfaceElement) {
			onready(surfaceElement);
		}
	}

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
	<canvas bind:this={canvasElement} class="pdf-surface__canvas" aria-hidden="true"></canvas>
	<div class="pdf-surface__text-layer" data-resource-href={resource.href}></div>
</article>

<style>
	.pdf-surface {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: auto;
		background: #f3f0ea;
		transform-origin: top left;
	}

	.pdf-surface__canvas,
	.pdf-surface__text-layer {
		position: absolute;
		top: 0;
		left: 50%;
		width: var(--reader-pdf-page-width, 100%);
		height: var(--reader-pdf-page-height, 100%);
		transform: translateX(-50%);
		transform-origin: top center;
	}

	.pdf-surface__text-layer {
		color: transparent;
	}
</style>
