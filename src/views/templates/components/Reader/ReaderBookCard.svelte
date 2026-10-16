<script lang="ts">
	import { Check, Pencil } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { ReaderDocument } from '@/types/reader.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocument.js';

	const PERCENTAGE_SCALE = 100;

	type Props = {
		document: ReaderDocument;
		editing?: boolean;
		selected?: boolean;
		onclick?: () => void;
		onedit?: (_event: MouseEvent) => void;
	};

	const { document, editing = false, selected = false, onclick, onedit }: Props = $props();
	const progressId = `reader-book-progress-${crypto.randomUUID()}`;

	function getProgressPercent(): number {
		const progression = document.progress?.total_progression ?? 0;
		return Math.round(Math.max(0, Math.min(1, progression)) * PERCENTAGE_SCALE);
	}

	function handleEditClick(event: MouseEvent): void {
		event.stopPropagation();
		onedit?.(event);
	}
</script>

<div
	class="reader-book-card"
	class:reader-book-card--selected={selected}
	style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
>
	<button
		class="reader-book-card__cover"
		type="button"
		aria-label={`${editing ? 'Select' : 'Open'} ${document.title}`}
		aria-pressed={editing ? selected : undefined}
		aria-describedby={progressId}
		{onclick}
	>
		{#if editing}
			<span
				class="reader-book-card__selection-indicator"
				class:reader-book-card__selection-indicator--selected={selected}
				aria-hidden="true"
			>
				{#if selected}
					<Check size="14" />
				{/if}
			</span>
		{/if}
		<span class="reader-book-card__title">{document.title}</span>
		<span
			id={progressId}
			class="reader-book-card__progress"
			aria-label={`${getProgressPercent()}% read`}>{getProgressPercent()}%</span
		>
	</button>
	{#if editing}
		<SyButton
			style="filled"
			shape="rectangle"
			size="large"
			classes={['reader-book-card__metadata-button']}
			aria-label={`Edit ${document.title}`}
			onclick={handleEditClick}
		>
			<Pencil size="14" />
		</SyButton>
	{/if}
</div>

<style>
	.reader-book-card {
		position: relative;
		display: block;
		width: 100%;
		border: 0;
		padding: 0;
		background: transparent;
		font-family: var(--sy-font-family);
		text-align: left;
	}

	.reader-book-card__cover {
		position: relative;
		display: grid;
		grid-template-rows: minmax(2.75rem, 1fr) auto minmax(2.75rem, 1fr);
		width: 100%;
		aspect-ratio: 2 / 3;
		min-height: 14.0625rem;
		padding: 0;
		font-family: inherit;
		cursor: pointer;
		box-sizing: border-box;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
			color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #ffffff);
		box-shadow: var(--sy-shadow);
		color: var(--sy-text--muted);
		text-align: center;
		transition:
			box-shadow var(--sy-transition-duration),
			transform var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}

	@media (prefers-color-scheme: dark) {
		.reader-book-card__cover {
			background:
				linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
				color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #000000);
		}
	}

	@media (hover: hover) {
		.reader-book-card:hover .reader-book-card__cover {
			box-shadow: var(--sy-shadow--active);
			transform: translateY(-2px);
			transition-property: box-shadow, transform;
			transition-duration: var(--sy-transition-duration);
		}
	}

	.reader-book-card--selected .reader-book-card__cover {
		border-color: var(--sy-color--black);
		box-shadow: var(--sy-shadow--active);
	}

	.reader-book-card__selection-indicator {
		position: absolute;
		top: var(--sy-space--large);
		right: var(--sy-space--large);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: 50%;
		border: 2px solid var(--sy-color--black);
		color: var(--sy-color--white);
		background: var(--sy-color--white);
	}

	.reader-book-card__selection-indicator--selected {
		background: var(--sy-color--black);
	}

	:global(.reader-book-card__metadata-button) {
		position: absolute !important;
		top: var(--sy-space--large) !important;
		left: var(--sy-space--large) !important;
	}

	.reader-book-card__title {
		grid-row: 2;
		padding: var(--sy-space--small) var(--sy-space) var(--sy-space--small)
			calc(var(--sy-space) + 12px);
		background: var(--sy-color--white);
		box-shadow: 0 3px 8px rgb(0 0 0 / 14%);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.3;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.reader-book-card__progress {
		grid-row: 3;
		align-self: end;
		justify-self: center;
		margin: var(--sy-space--small) var(--sy-space--large) var(--sy-space--large);
		padding: var(--sy-space--small) var(--sy-space);
		border-radius: var(--sy-border-radius);
		background: var(--sy-color--white);
		font-size: 0.78rem;
		text-align: center;
		color: var(--sy-color--black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
