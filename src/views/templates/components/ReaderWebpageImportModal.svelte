<script lang="ts">
	import ReaderMetadataFields from '@/components/ReaderMetadataFields.svelte';
	import ReaderModalFooter from '@/components/ReaderModalFooter.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import type { ReaderImportPayload } from '@/types/reader.js';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';
	import { invokePrepareReaderImport } from '@/utils/readerNativeImport.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (
			_title: string,
			_url: string,
			_color: string,
			_preparedPayload?: ReaderImportPayload
		) => Promise<void> | void;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	const PREVIEW_TEXT_LIMIT = 600;
	let url = $state('');
	let title = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let titleEdited = $state(false);
	let submitting = $state(false);
	let fetching = $state(false);
	let fetchError = $state('');
	let preparedUrl = $state('');
	let preparedPayload = $state<ReaderImportPayload | undefined>(undefined);
	const canImport = $derived(url.trim().length > 0 && !submitting && !importing);
	const canFetch = $derived(url.trim().length > 0 && !fetching && !submitting && !importing);
	const preparedPayloadIsValid = $derived(Boolean(preparedPayload && preparedUrl === url.trim()));
	const previewText = $derived(preparedPayload?.text.trim().slice(0, PREVIEW_TEXT_LIMIT) ?? '');

	function reset(): void {
		url = '';
		title = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		submitting = false;
		fetching = false;
		fetchError = '';
		preparedUrl = '';
		preparedPayload = undefined;
	}

	function close(): void {
		reset();
		onclose();
	}

	async function fetchPreview(): Promise<void> {
		if (!canFetch) {
			return;
		}
		fetching = true;
		fetchError = '';
		preparedPayload = undefined;
		preparedUrl = '';
		try {
			const nextPayload = await invokePrepareReaderImport({
				url: url.trim(),
				title: titleEdited ? title : undefined,
			});
			preparedPayload = nextPayload;
			preparedUrl = url.trim();
			if (!titleEdited) {
				title = nextPayload.title;
			}
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Could not fetch webpage preview.';
		} finally {
			fetching = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(
			titleEdited ? title : title.trim(),
			url.trim(),
			color,
			preparedPayloadIsValid ? preparedPayload : undefined
		);
		close();
	}
</script>

<SyModal title="Import From Webpage" {visible} onclose={close}>
	{#snippet body()}
		<form class="reader-webpage-import" id="reader-webpage-import-form" onsubmit={submit}>
			<label class="reader-webpage-import__field">
				<span>URL</span>
				<SyTextInput
					value={url}
					id="reader-webpage-import-url"
					size="large"
					type="text"
					inputmode="url"
					autocomplete="url"
					placeholder="https://example.com/article"
					oninput={(value) => {
						url = value;
						fetchError = '';
					}}
				/>
			</label>
			<ReaderMetadataFields
				idPrefix="reader-webpage-import"
				{title}
				{color}
				titlePlaceholder="Use webpage title"
				ontitleinput={(value) => {
					title = value;
					titleEdited = true;
				}}
				oncolorchange={(nextColor) => (color = nextColor)}
			/>
			{#if fetchError}
				<p class="reader-webpage-import__error">{fetchError}</p>
			{/if}
			{#if previewText}
				<section class="reader-webpage-import__preview" aria-label="Webpage preview">
					<h3>{preparedPayload?.title}</h3>
					<p>{previewText}</p>
				</section>
			{/if}
		</form>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" disabled={!canFetch} onclick={fetchPreview}>
			{fetching ? 'Fetching...' : 'Fetch Preview'}
		</SyButton>
		<ReaderModalFooter
			disabled={!canImport}
			confirmLabel="Import"
			busyLabel="Importing..."
			busy={importing || submitting}
			oncancel={close}
			onconfirm={() => {
				const form = document.getElementById(
					'reader-webpage-import-form'
				) as HTMLFormElement | null;
				form?.requestSubmit();
			}}
		/>
	{/snippet}
</SyModal>

<style>
	.reader-webpage-import {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(520px, 72vw);
	}

	.reader-webpage-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-webpage-import__error {
		margin: 0;
		color: var(--sy-color--red);
	}

	.reader-webpage-import__preview {
		max-height: 180px;
		overflow: auto;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-inner-shadow);
	}

	.reader-webpage-import__preview h3,
	.reader-webpage-import__preview p {
		margin: 0;
	}

	.reader-webpage-import__preview h3 {
		margin-bottom: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
	}

	.reader-webpage-import__preview p {
		line-height: 1.5;
		white-space: pre-wrap;
	}

	@media (max-width: 640px) {
		.reader-webpage-import {
			width: 100%;
		}
	}
</style>
