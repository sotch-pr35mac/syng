<script lang="ts">
	import { Check, ClipboardPaste, FilePlus2, Globe2, Library, Pencil } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { READER_SUPPORTED_DOCUMENT_FORMAT_LABEL } from '@/reader/importSupport.js';
	import type { ReaderDocument } from '@/types/reader.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

	type Props = {
		documents?: ReaderDocument[];
		editingLibrary?: boolean;
		importing?: boolean;
		selectedDocumentIds?: ReadonlySet<string>;
		onopenClipboardImport?: () => void;
		onopenWebpageImport?: () => void;
		onopenFileImport?: () => void;
		onopenDocumentDetails?: (_event: MouseEvent, _document: ReaderDocument) => void;
		oncardClick?: (_document: ReaderDocument) => void;
		oncardKey?: (_event: KeyboardEvent, _document: ReaderDocument) => void;
		getProgressPercent?: (_document: ReaderDocument) => number;
	};

	const {
		documents = [],
		editingLibrary = false,
		importing = false,
		selectedDocumentIds = new Set<string>(),
		onopenClipboardImport = () => {},
		onopenWebpageImport = () => {},
		onopenFileImport = () => {},
		onopenDocumentDetails = () => {},
		oncardClick = () => {},
		oncardKey = () => {},
		getProgressPercent = () => 0,
	}: Props = $props();
</script>

<main class="reader-library" class:reader-library--empty={!documents.length}>
	{#if documents.length}
		<div class="reader-library__grid">
			{#each documents as document (document._id)}
				<div
					class="reader-library__book-card"
					class:reader-library__book-card--selected={selectedDocumentIds.has(
						document._id
					)}
					style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
					onclick={() => oncardClick(document)}
					onkeyup={(event) => oncardKey(event, document)}
					role="button"
					tabindex="0"
				>
					<div class="reader-library__book-cover">
						{#if editingLibrary}
							<span
								class="reader-library__selection-indicator"
								class:reader-library__selection-indicator--selected={selectedDocumentIds.has(
									document._id
								)}
							>
								{#if selectedDocumentIds.has(document._id)}
									<Check size="14" />
								{/if}
							</span>
							<SyButton
								style="filled"
								shape="rectangle"
								size="large"
								classes={['reader-library__metadata-button']}
								aria-label={`Edit ${document.title}`}
								onclick={(event) => onopenDocumentDetails(event, document)}
							>
								<Pencil size="14" />
							</SyButton>
						{/if}
						<span class="reader-library__book-title">{document.title}</span>
						<span class="reader-library__book-progress"
							>{getProgressPercent(document)}%</span
						>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="reader-library__empty">
			<div class="reader-library__empty-copy">
				<Library size="42" />
				<p>Your reading library is empty</p>
			</div>
			<div class="reader-library__empty-actions" aria-label="Import options">
				<div class="reader-library__empty-action-group">
					<SyButton
						size="large"
						classes={['reader-library__empty-action']}
						disabled={importing}
						onclick={onopenFileImport}
					>
						<FilePlus2 size="20" />
						<span>{importing ? 'Importing...' : 'Import Document'}</span>
					</SyButton>
					<span class="reader-library__empty-action-hint"
						>{READER_SUPPORTED_DOCUMENT_FORMAT_LABEL}</span
					>
				</div>
				<SyButton
					size="large"
					classes={['reader-library__empty-action']}
					disabled={importing}
					onclick={onopenWebpageImport}
				>
					<Globe2 size="20" />
					<span>Import from Webpage</span>
				</SyButton>
				<SyButton
					size="large"
					classes={['reader-library__empty-action']}
					disabled={importing}
					onclick={onopenClipboardImport}
				>
					<ClipboardPaste size="20" />
					<span>Import from Clipboard</span>
				</SyButton>
			</div>
		</div>
	{/if}
</main>

<style>
	.reader-library {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		box-sizing: border-box;
	}

	.reader-library--empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reader-library__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: clamp(18px, 3vw, 34px);
		align-items: start;
	}

	.reader-library__book-card {
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

	.reader-library__book-card:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 4px;
	}

	.reader-library__book-card:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.reader-library__book-cover {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
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
		transition:
			box-shadow var(--sy-transition-duration),
			transform var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}

	@media (prefers-color-scheme: dark) {
		.reader-library__book-cover {
			background:
				linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
				color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #000000);
		}
	}

	@media (hover: hover) {
		.reader-library__book-card:hover .reader-library__book-cover {
			box-shadow: var(--sy-shadow--active);
			transform: translateY(-2px);
			transition-property: box-shadow, transform;
			transition-duration: var(--sy-transition-duration);
		}
	}

	.reader-library__book-card--selected .reader-library__book-cover {
		border-color: var(--sy-color--black);
		box-shadow: var(--sy-shadow--active);
	}

	.reader-library__book-card .reader-library__book-cover {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.reader-library__selection-indicator {
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

	.reader-library__selection-indicator--selected {
		background: var(--sy-color--black);
	}

	:global(.reader-library__metadata-button) {
		position: absolute !important;
		top: var(--sy-space--large) !important;
		left: var(--sy-space--large) !important;
	}

	.reader-library__book-title {
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
		.reader-library__book-title {
			background: rgb(0 0 0 / 50%);
		}
	}

	.reader-library__book-progress {
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

	.reader-library__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--extra-large);
		width: 100%;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: center;
	}

	.reader-library__empty-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
	}

	.reader-library__empty p {
		margin: 0;
	}

	.reader-library__empty-actions {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: var(--sy-space--large);
		max-width: 100%;
		flex-wrap: wrap;
	}

	.reader-library__empty-action-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space);
	}

	:global(.reader-library__empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		margin: 0;
	}

	.reader-library__empty-action-hint {
		max-width: 220px;
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--small);
		line-height: 1.4;
	}
</style>
