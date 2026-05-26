<script lang="ts">
	import { Check, Pencil } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { ReaderDocument } from '@/types/reader.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

	const PERCENTAGE_SCALE = 100;

	type Props = {
		document: ReaderDocument;
		editing?: boolean;
		selected?: boolean;
		onclick?: () => void;
		onkeyup?: (_event: KeyboardEvent) => void;
		onedit?: (_event: MouseEvent) => void;
	};

	const {
		document,
		editing = false,
		selected = false,
		onclick,
		onkeyup,
		onedit,
	}: Props = $props();

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
	{onclick}
	{onkeyup}
	role="button"
	tabindex="0"
>
	<div class="reader-book-card__cover">
		{#if editing}
			<span
				class="reader-book-card__selection-indicator"
				class:reader-book-card__selection-indicator--selected={selected}
			>
				{#if selected}
					<Check size="14" />
				{/if}
			</span>
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
		<span class="reader-book-card__title">{document.title}</span>
		<span class="reader-book-card__progress">{getProgressPercent()}%</span>
	</div>
</div>

<style>
	.reader-book-card {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		border: 0;
		padding: 0;
		background: transparent;
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.reader-book-card:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 4px;
	}

	.reader-book-card:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.reader-book-card__cover {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--sy-space--large);
		padding-left: calc(var(--sy-space--large) + 12px);
		box-sizing: border-box;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
			color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #ffffff);
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--grey-4);
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
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--sy-color--black);
		color: var(--sy-color--white);
		background: transparent;
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
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		padding: var(--sy-space--small) var(--sy-space) var(--sy-space--small)
			calc(var(--sy-space) + 12px);
		background: rgb(255 255 255 / 70%);
		box-shadow: 0 3px 8px rgb(0 0 0 / 14%);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.3;
		text-align: center;
		overflow-wrap: anywhere;
	}

	@media (prefers-color-scheme: dark) {
		.reader-book-card__title {
			background: rgb(0 0 0 / 50%);
		}
	}

	.reader-book-card__progress {
		position: absolute;
		left: calc(var(--sy-space--large) + 12px);
		right: var(--sy-space--large);
		bottom: var(--sy-space--large);
		margin-top: var(--sy-space--small);
		font-size: 0.78rem;
		text-align: center;
		color: var(--sy-color--black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
