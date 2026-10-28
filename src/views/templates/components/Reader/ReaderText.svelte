<script lang="ts">
	import type { ReaderSegment } from '@/utils/readerPagination.js';
	import type { ReaderTextLine, ReaderTextRun } from '@/utils/readerTextLayout.js';
	import { READER_PINYIN_SCALE } from '@/utils/readerTextLayout.js';
	import type { ReaderToken } from '@/types/reader.js';
	import ColorizedPinyinSyllables from '@/components/ColorizedText/ColorizedPinyinSyllables.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	const {
		segments,
		lines,
		selected,
		onopen,
	}: {
		segments: ReaderSegment[];
		lines?: ReaderTextLine[];
		selected?: ReaderToken;
		onopen: (event: MouseEvent, token: ReaderToken | undefined) => void;
	} = $props();
	function active(token: ReaderToken | undefined): boolean {
		return (
			!!token &&
			!!selected &&
			token.block_id === selected.block_id &&
			token.start === selected.start &&
			token.end === selected.end &&
			token.table_cell?.row === selected.table_cell?.row &&
			token.table_cell?.col === selected.table_cell?.col
		);
	}
</script>

{#snippet annotation(segment: ReaderSegment)}
	{#if segment.pinyin && segment.annotationSource === 'generated'}
		<ColorizedPinyinSyllables
			pinyin={segment.annotation}
			tones={segment.pinyin.tones}
			colorByTone={dictionaryDisplaySettingsStore.settings.colorPinyinByTone}
		/>
	{:else}{segment.annotation}{/if}
{/snippet}

{#snippet pronunciation(segment: ReaderSegment, run?: ReaderTextRun)}
	{#if segment.annotation}<span
			class="reader-pronunciation"
			class:reader-pronunciation--wrapped={run?.wrapAnnotation}
			class:reader-pronunciation--imported={segment.annotationSource === 'imported'}
			lang="zh-Latn"
			style:font-size={`${READER_PINYIN_SCALE}em`}
			style={run ? `height:${run.annotationHeight}px` : undefined}
			>{@render annotation(segment)}</span
		>{/if}
{/snippet}

{#snippet word(segment: ReaderSegment, run?: ReaderTextRun, withAnnotation = false)}
	{#if segment.token}<button
			type="button"
			class="reader-word"
			class:reader-word--active={active(segment.token)}
			lang="zh"
			aria-haspopup="dialog"
			onclick={(event) => onopen(event, segment.token)}
			><span>{segment.text}</span>{#if withAnnotation}{@render pronunciation(
					segment,
					run
				)}{/if}</button
		>{:else}{segment.text}{/if}
{/snippet}

{#snippet base(segment: ReaderSegment)}
	{#each segment.parts ?? [segment] as part, index (index)}{@render word(part)}{/each}
{/snippet}

{#snippet content(segment: ReaderSegment, run?: ReaderTextRun, above = 0)}
	{#if !run && segment.annotationSource === 'imported'}
		<ruby class="reader-ruby">{@render base(segment)}<rt>{segment.annotation}</rt></ruby>
	{:else if !run && !segment.annotation}
		{@render base(segment)}
	{:else}
		<span
			class="reader-text-unit"
			class:reader-text-unit--measured={!!run}
			class:reader-text-unit--annotated={!!segment.annotation}
			style={run
				? `width:${run.width}px;height:${run.baseHeight}px;top:${above}px`
				: undefined}
			>{#if segment.token}{@render word(segment, run, true)}{:else}<span
					>{@render base(segment)}</span
				>{@render pronunciation(segment, run)}{/if}</span
		>
	{/if}
{/snippet}

{#if lines}
	{#each lines as line (line.start)}
		<span
			class="reader-text-line"
			style={`padding-left:${Math.max(0, line.indent ?? 0)}px;margin-left:${Math.min(0, line.indent ?? 0)}px;height:${line.height}px;font-size:${line.metrics.fontSize}px;line-height:${line.metrics.lineHeight}px;font-family:${line.metrics.fontFamily};font-weight:${line.metrics.fontWeight ?? '400'}`}
		>
			{#each line.runs as run, index (index)}{@render content(run, run, line.above)}{/each}
		</span>
	{/each}
{:else}
	{#each segments as segment, index (index)}{@render content(segment)}{/each}
{/if}

<style>
	.reader-text-unit--measured .reader-pronunciation {
		white-space: pre;
	}
	.reader-text-unit--measured .reader-pronunciation--wrapped {
		white-space: normal;
		word-break: break-all;
	}

	.reader-text-unit--annotated:not(.reader-text-unit--measured),
	.reader-text-unit--annotated:not(.reader-text-unit--measured) .reader-word {
		display: inline-flex;
		flex-direction: column;
	}
	.reader-text-unit:not(.reader-text-unit--measured) .reader-pronunciation {
		position: static;
	}
	.reader-text-unit:not(.reader-text-unit--measured) .reader-pronunciation--imported {
		order: -1;
	}

	.reader-ruby rt {
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-size: 0.52em;
		font-weight: 500;
		line-height: 1;
	}
	.reader-text-line {
		box-sizing: border-box;
		display: block;
		white-space: nowrap;
		text-indent: 0;
	}
	.reader-text-unit {
		position: relative;
	}
	.reader-text-unit--measured {
		display: inline-block;
		vertical-align: top;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		text-indent: 0;
	}
	.reader-text-unit--annotated {
		display: inline-block;
		text-align: center;
		max-width: 100%;
	}
	.reader-text-unit--annotated:not(.reader-text-unit--measured) {
		margin-block: 0.7em;
	}
	.reader-word {
		display: inline;
		padding: 0;
		margin: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: inherit;
		text-align: inherit;
		cursor: pointer;
		overflow-wrap: inherit;
		border-bottom: 1px solid transparent;
	}
	.reader-word:hover,
	.reader-word--active {
		color: var(--reader-link-color, var(--sy-color--blue));
		border-bottom-color: var(--reader-link-color, var(--sy-color--blue));
	}
	:global(.mobile-reader-document) .reader-word {
		border: 0;
	}
	:global(.mobile-reader-document) .reader-word:active {
		color: var(--reader-link-color, var(--sy-color--blue));
	}
	:global(.mobile-reader-document) .reader-word--active {
		background: var(--reader-selection-background, #dbeafe);
		color: var(--reader-selection-text, #111827);
		border-bottom-color: transparent;
		border-radius: 3px;
	}
	.reader-pronunciation {
		position: absolute;
		display: block;
		inset-inline: 0;
		top: 100%;
		line-height: 1.2;
		font-weight: 400;
		color: var(--reader-page-text);
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.reader-pronunciation--imported {
		top: auto;
		bottom: 100%;
		color: var(--reader-muted-text);
	}
</style>
