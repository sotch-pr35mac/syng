<script lang="ts">
	import ReaderImportModal from '@/components/ReaderImportModal.svelte';
	import ReaderWebpageImportBody from '@/components/ReaderWebpageImportBody.svelte';
	import { ask } from '@tauri-apps/plugin-dialog';
	import type { ReaderImportPayload } from '@/types/reader.js';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';
	import {
		invokePrepareReaderImport,
		LARGE_HTML_IMPORT_CANCELED_MESSAGE,
		parseLargeHtmlImportError,
		type PrepareReaderImportInvokeArgs,
	} from '@/utils/readerNativeImport.js';

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
	const BYTES_PER_MIB = Number('1048576');
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

	async function prepareWithLargeHtmlConfirmation(
		args: PrepareReaderImportInvokeArgs
	): Promise<ReaderImportPayload> {
		try {
			return await invokePrepareReaderImport(args);
		} catch (error) {
			const largeHtmlError = parseLargeHtmlImportError(error);
			if (!largeHtmlError) {
				throw error;
			}
			const receivedMib = Math.ceil(largeHtmlError.receivedBytes / BYTES_PER_MIB);
			const confirmed = await ask(
				`This webpage is about ${receivedMib} MiB before reader processing. Importing it may use significant memory and storage. Continue?`,
				{ title: 'Import Large Webpage' }
			);
			if (!confirmed) {
				throw new Error(LARGE_HTML_IMPORT_CANCELED_MESSAGE, { cause: error });
			}
			return invokePrepareReaderImport({
				...args,
				allowLargeHtml: true,
			});
		}
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
			const nextPayload = await prepareWithLargeHtmlConfirmation({
				url: url.trim(),
				title: titleEdited ? title : undefined,
			});
			preparedPayload = nextPayload;
			preparedUrl = url.trim();
			if (!titleEdited) {
				title = nextPayload.title;
			}
		} catch (error) {
			if (error instanceof Error && error.message === LARGE_HTML_IMPORT_CANCELED_MESSAGE) {
				fetchError = '';
				return;
			}
			fetchError =
				error instanceof Error ? error.message : 'Could not fetch webpage preview.';
		} finally {
			fetching = false;
		}
	}

	async function submit(): Promise<void> {
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

<ReaderImportModal
	title="Import From Webpage"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
	onclose={close}
	onconfirm={submit}
>
	{#snippet body()}
		<ReaderWebpageImportBody
			{url}
			{title}
			{color}
			{fetching}
			{canFetch}
			{fetchError}
			previewTitle={preparedPayload?.title}
			{previewText}
			onurlinput={(value) => {
				url = value;
				fetchError = '';
			}}
			ontitleinput={(value) => {
				title = value;
				titleEdited = true;
			}}
			oncolorchange={(nextColor) => (color = nextColor)}
			onfetchpreview={fetchPreview}
		/>
	{/snippet}
</ReaderImportModal>
