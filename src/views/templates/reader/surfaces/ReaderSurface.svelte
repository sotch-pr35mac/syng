<script lang="ts">
	import PdfSurface from '@/reader/surfaces/PdfSurface.svelte';
	import ReflowableSurface from '@/reader/surfaces/ReflowableSurface.svelte';
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
</script>

{#if resource.kind === 'fixed-page'}
	<PdfSurface {resource} {settings} {onlookup} {onready} />
{:else}
	<ReflowableSurface {resource} {settings} {onlookup} {onready} />
{/if}
