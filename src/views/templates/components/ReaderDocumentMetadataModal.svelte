<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
		normalizeReaderDocumentColor,
	} from '@/utils/readerDocumentMetadata.js';

	type Props = {
		visible?: boolean;
		title?: string;
		initialTitle?: string;
		initialColor?: string;
		confirmLabel?: string;
		busy?: boolean;
		onclose?: () => void;
		onsave?: (_title: string, _color: string) => Promise<void> | void;
	};

	const {
		visible = false,
		title = 'Document Details',
		initialTitle = '',
		initialColor = DEFAULT_READER_DOCUMENT_COLOR,
		confirmLabel = 'Save',
		busy = false,
		onclose = () => {},
		onsave = () => {},
	}: Props = $props();

	let documentTitle = $state('');
	let documentColor = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let submitting = $state(false);
	const canSave = $derived(documentTitle.trim().length > 0 && !busy && !submitting);

	$effect(() => {
		if (visible) {
			documentTitle = initialTitle;
			documentColor = normalizeReaderDocumentColor(initialColor);
			submitting = false;
		}
	});

	async function save(): Promise<void> {
		if (!canSave) {
			return;
		}
		submitting = true;
		await onsave(documentTitle, documentColor);
		onclose();
	}
</script>

<SyModal {title} {visible} {onclose}>
	{#snippet body()}
		<div class="reader-document-metadata">
			<label class="reader-document-metadata__field">
				<span>Title</span>
				<input
					bind:value={documentTitle}
					class="reader-document-metadata__input"
					type="text"
					autocomplete="off"
					placeholder="Document title"
				/>
			</label>
			<div class="reader-document-metadata__field">
				<span>Color</span>
				<div class="reader-document-metadata__swatches">
					{#each READER_DOCUMENT_COLORS as color (color)}
						<button
							class="reader-document-metadata__swatch"
							class:reader-document-metadata__swatch--selected={documentColor ===
								color}
							style:background-color={color}
							type="button"
							aria-label={`Use ${color}`}
							aria-pressed={documentColor === color}
							onclick={() => {
								documentColor = color;
							}}
						></button>
					{/each}
				</div>
				<input
					bind:value={documentColor}
					class="reader-document-metadata__color-input"
					type="color"
					aria-label="Custom color"
				/>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={onclose}>Cancel</SyButton>
		<SyButton size="large" color="green" disabled={!canSave} onclick={save}>
			{busy || submitting ? 'Saving...' : confirmLabel}
		</SyButton>
	{/snippet}
</SyModal>

<style>
	.reader-document-metadata {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(420px, 68vw);
		font-family: var(--sy-font-family);
	}

	.reader-document-metadata__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-size: 0.92rem;
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-document-metadata__input {
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
		box-sizing: border-box;
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: 16px;
	}

	.reader-document-metadata__swatches {
		display: grid;
		grid-template-columns: repeat(8, 28px);
		gap: var(--sy-space);
	}

	.reader-document-metadata__swatch {
		width: 28px;
		height: 28px;
		border: 1px solid rgb(0 0 0 / 16%);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		cursor: pointer;
	}

	.reader-document-metadata__swatch--selected {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	.reader-document-metadata__color-input {
		width: 44px;
		height: 32px;
		border: 0;
		padding: 0;
		background: transparent;
	}

	@media (max-width: 640px) {
		.reader-document-metadata {
			width: 100%;
		}

		.reader-document-metadata__swatches {
			grid-template-columns: repeat(4, 28px);
		}
	}
</style>
