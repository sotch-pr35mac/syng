<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
	} from '@/utils/readerDocumentMetadata.js';
	import { inferPlainTextReaderTitle } from '@/utils/readerPlainTextImport.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (_title: string, _text: string, _color: string) => Promise<void> | void;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	let title = $state('');
	let text = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let titleEdited = $state(false);
	let submitting = $state(false);
	const canImport = $derived(
		title.trim().length > 0 && text.trim().length > 0 && !submitting && !importing
	);

	function reset(): void {
		title = '';
		text = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		submitting = false;
	}

	function close(): void {
		reset();
		onclose();
	}

	function updateText(event: Event): void {
		text =
			event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget.value : text;
		if (!titleEdited) {
			title = inferPlainTextReaderTitle(text);
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(title, text, color);
		close();
	}
</script>

<SyModal title="Import From Clipboard" {visible} onclose={close}>
	{#snippet body()}
		<form class="reader-clipboard-import" id="reader-clipboard-import-form" onsubmit={submit}>
			<label class="reader-clipboard-import__field">
				<span>Title</span>
				<input
					bind:value={title}
					class="reader-clipboard-import__input"
					type="text"
					autocomplete="off"
					placeholder="Document title"
					oninput={() => {
						titleEdited = true;
					}}
				/>
			</label>
			<div class="reader-clipboard-import__field">
				<span>Color</span>
				<div class="reader-clipboard-import__swatches">
					{#each READER_DOCUMENT_COLORS as swatchColor (swatchColor)}
						<button
							class="reader-clipboard-import__swatch"
							class:reader-clipboard-import__swatch--selected={color === swatchColor}
							style:background-color={swatchColor}
							type="button"
							aria-label={`Use ${swatchColor}`}
							aria-pressed={color === swatchColor}
							onclick={() => {
								color = swatchColor;
							}}
						></button>
					{/each}
				</div>
			</div>
			<label class="reader-clipboard-import__field">
				<span>Text</span>
				<textarea
					value={text}
					class="reader-clipboard-import__textarea"
					placeholder="Paste text here"
					rows="10"
					oninput={updateText}
				></textarea>
			</label>
		</form>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={close}>Cancel</SyButton>
		<SyButton
			size="large"
			color="green"
			disabled={!canImport}
			onclick={() => {
				const form = document.getElementById(
					'reader-clipboard-import-form'
				) as HTMLFormElement | null;
				form?.requestSubmit();
			}}
		>
			{importing || submitting ? 'Importing...' : 'Import'}
		</SyButton>
	{/snippet}
</SyModal>

<style>
	.reader-clipboard-import {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(520px, 72vw);
		font-family: var(--sy-font-family);
	}

	.reader-clipboard-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-size: 0.92rem;
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-clipboard-import__input,
	.reader-clipboard-import__textarea {
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
		box-sizing: border-box;
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: 16px;
	}

	.reader-clipboard-import__textarea {
		min-height: 220px;
		resize: vertical;
		line-height: 1.5;
	}

	.reader-clipboard-import__swatches {
		display: grid;
		grid-template-columns: repeat(8, 28px);
		gap: var(--sy-space);
	}

	.reader-clipboard-import__swatch {
		width: 28px;
		height: 28px;
		border: 1px solid rgb(0 0 0 / 16%);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		cursor: pointer;
	}

	.reader-clipboard-import__swatch--selected {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	@media (max-width: 640px) {
		.reader-clipboard-import {
			width: 100%;
		}

		.reader-clipboard-import__swatches {
			grid-template-columns: repeat(4, 28px);
		}

		.reader-clipboard-import__textarea {
			min-height: 180px;
		}
	}
</style>
