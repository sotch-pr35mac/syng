<script lang="ts">
	import ReaderModalShell from '@/components/Reader/ReaderModalShell.svelte';
	import ReaderMetadataFields from '@/components/Reader/ReaderMetadataFields.svelte';
	import type { ReaderImportResult } from '@/types/reader.js';
	import { handleError } from '@/utils/error.js';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		normalizeReaderDocumentColor,
	} from '@/utils/readerDocument.js';

	type Props = {
		visible?: boolean;
		initialTitle?: string;
		initialColor?: string;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (
			_title: string,
			_color: string
		) => Promise<ReaderImportResult> | ReaderImportResult;
	};

	const {
		visible = false,
		initialTitle = '',
		initialColor = DEFAULT_READER_DOCUMENT_COLOR,
		importing = false,
		onclose = () => {},
		onimport = () => ({ status: 'cancelled' }),
	}: Props = $props();

	let title = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let submitting = $state(false);
	let importError = $state('');
	let importRequest = 0;
	const canImport = $derived(title.trim().length > 0 && !submitting && !importing);

	$effect(() => {
		if (visible) {
			title = initialTitle;
			color = normalizeReaderDocumentColor(initialColor);
			submitting = false;
			importError = '';
		}
	});

	function close(): void {
		importRequest += 1;
		title = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		importError = '';
		submitting = false;
		onclose();
	}

	async function submit(): Promise<void> {
		if (!canImport) {
			return;
		}
		submitting = true;
		importError = '';
		const request = ++importRequest;
		try {
			const result = await onimport(title, color);
			if (request !== importRequest) {
				return;
			}
			if (result.status === 'success') {
				close();
			} else if (result.status === 'error') {
				importError = result.message;
			}
		} catch (error) {
			const message = 'There was an error importing the reader document.';
			handleError(message, error, { silent: true });
			if (request === importRequest) {
				importError = message;
			}
		} finally {
			if (request === importRequest) {
				submitting = false;
			}
		}
	}
</script>

<ReaderModalShell
	title="Import Document"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
	errorMessage={importError}
	onclose={close}
	onconfirm={submit}
>
	{#snippet body()}
		<ReaderMetadataFields
			idPrefix="reader-document-import"
			{title}
			{color}
			ontitleinput={(nextTitle) => (title = nextTitle)}
			oncolorchange={(nextColor) => (color = nextColor)}
		/>
	{/snippet}
</ReaderModalShell>
