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
	const coverColor = $derived(normalizeReaderDocumentColor(document.color));
	/* eslint-disable @typescript-eslint/no-magic-numbers -- sRGB luminance constants and the cover's 70/30 paint mix. */
	const lightCoverInk = $derived(getCoverInk(coverColor, 255));
	const darkCoverInk = $derived(getCoverInk(coverColor, 0));
	const progressPercent = $derived(getProgressPercent());

	function getCoverInk(color: string, themeBase: number): string {
		const channels = [1, 3, 5].map((position) =>
			Number.parseInt(color.slice(position, position + 2), 16)
		);
		const blendedChannels = channels.map((channel) => channel * 0.7 + themeBase * 0.3);
		const luminance = (rgb: number[]): number => {
			const linearChannels = rgb.map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return (
				linearChannels[0] * 0.2126 + linearChannels[1] * 0.7152 + linearChannels[2] * 0.0722
			);
		};
		const coverLuminance = luminance(blendedChannels);
		const charcoalLuminance = luminance([35, 35, 35]);
		const contrast = (inkLuminance: number): number =>
			(Math.max(coverLuminance, inkLuminance) + 0.05) /
			(Math.min(coverLuminance, inkLuminance) + 0.05);

		if (contrast(charcoalLuminance) >= 4.5) {
			return '#232323';
		}
		return contrast(1) >= 4.5 ? '#ffffff' : '#000000';
	}
	/* eslint-enable @typescript-eslint/no-magic-numbers */

	function getFormatLabel(sourceType: string): string {
		switch (sourceType.toLowerCase()) {
			case 'plain_text':
				return 'Text';
			case 'webpage':
				return 'Webpage';
			case 'epub':
			case 'pdf':
			case 'docx':
			case 'rtf':
				return sourceType.toUpperCase();
			default:
				return 'Document';
		}
	}

	function getTitleSignature(title: string): string {
		const characters = Array.from(title.trim());
		return (
			characters.find((character) => /[\p{L}\p{N}]/u.test(character)) ??
			characters[0] ??
			''
		).toLocaleUpperCase();
	}

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
	class:reader-book-card--editing={editing}
	style={`--reader-book-color: ${coverColor}; --reader-book-ink-light: ${lightCoverInk}; --reader-book-ink-dark: ${darkCoverInk}; --reader-book-progress: ${progressPercent}%;`}
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
		<span class="reader-book-card__format">{getFormatLabel(document.source_type)}</span>
		<span class="reader-book-card__signature" aria-hidden="true"
			>{getTitleSignature(document.title)}</span
		>
		<span class="reader-book-card__title">{document.title}</span>
		<span class="reader-book-card__progress">
			<span id={progressId} class="reader-book-card__progress-label">
				<span
					>{progressPercent === 0
						? 'Not started'
						: progressPercent === 100
							? 'Finished'
							: 'Reading'}</span
				>
				{#if progressPercent > 0}<span>{progressPercent}%</span>{/if}
			</span>
			<span class="reader-book-card__progress-track" aria-hidden="true"></span>
		</span>
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
		display: flex;
		flex-direction: column;
		width: 100%;
		aspect-ratio: 2 / 3;
		min-height: 14.0625rem;
		padding: 17px 15px 14px 20px;
		overflow: hidden;
		font-family: inherit;
		cursor: pointer;
		box-sizing: border-box;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background: color-mix(in srgb, var(--reader-book-color) 70%, #ffffff);
		box-shadow: var(--sy-shadow);
		color: var(--reader-book-ink-light);
		text-align: left;
		transition:
			box-shadow var(--sy-transition-duration--control),
			transform var(--sy-transition-duration--artwork),
			border-color var(--sy-transition-duration--control);
	}

	.reader-book-card__cover::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 6px;
		border-radius: var(--sy-border-radius) 0 0 var(--sy-border-radius);
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 16%),
			rgb(0 0 0 / 2%) 70%,
			rgb(255 255 255 / 15%)
		);
		pointer-events: none;
	}

	.reader-book-card__cover::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--sy-border-radius);
		background: linear-gradient(
			160deg,
			rgb(255 255 255 / 14%),
			transparent 40%,
			rgb(0 0 0 / 9%)
		);
		pointer-events: none;
	}

	@media (prefers-color-scheme: dark) {
		.reader-book-card__cover {
			background: color-mix(in srgb, var(--reader-book-color) 70%, #000000);
			color: var(--reader-book-ink-dark);
		}
	}

	@media (hover: hover) {
		.reader-book-card:hover .reader-book-card__cover {
			box-shadow: var(--sy-shadow--active);
			transform: translateY(var(--sy-hover-lift));
		}
	}

	.reader-book-card__cover:active {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.reader-book-card:hover .reader-book-card__cover {
			transform: none;
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
		background: var(--sy-surface--content);
	}

	.reader-book-card__selection-indicator--selected {
		background: var(--sy-color--black);
	}

	:global(.reader-book-card__metadata-button) {
		position: absolute !important;
		top: var(--sy-space--large) !important;
		left: var(--sy-space--large) !important;
	}

	.reader-book-card__format,
	.reader-book-card__title,
	.reader-book-card__progress {
		position: relative;
		z-index: 1;
	}

	.reader-book-card__format {
		font-size: 0.625rem;
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.055em;
		text-transform: uppercase;
	}

	.reader-book-card--editing .reader-book-card__format {
		visibility: hidden;
	}

	.reader-book-card__title {
		margin: 48px 0 auto;
		max-width: 95%;
		font-size: clamp(var(--sy-font-size--mobile-large), 1.6vw, 1.4375rem);
		font-weight: var(--sy-font-weight--bold);
		line-height: 1.19;
		overflow-wrap: anywhere;
	}

	.reader-book-card__signature {
		position: absolute;
		z-index: 1;
		right: -8px;
		bottom: 16px;
		font-size: 8.875rem;
		font-weight: var(--sy-font-weight--bold);
		line-height: 0.9;
		opacity: 0.11;
		pointer-events: none;
	}

	.reader-book-card__progress {
		display: block;
		width: 100%;
	}

	.reader-book-card__progress-label {
		display: flex;
		justify-content: space-between;
		gap: var(--sy-space);
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.reader-book-card__progress-track {
		display: block;
		height: 3px;
		margin-top: 7px;
		border-radius: var(--sy-border-radius);
		background: color-mix(in srgb, currentColor 25%, transparent);
	}

	.reader-book-card__progress-track::before {
		content: '';
		display: block;
		width: var(--reader-book-progress);
		height: 100%;
		background: currentColor;
	}
</style>
