<script lang="ts">
	import ReaderClipboardImportBody from '@/components/ReaderClipboardImportBody.svelte';
	import ReaderImportModal from '@/components/ReaderImportModal.svelte';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';
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

	function updateText(nextText: string): void {
		text = nextText;
		if (!titleEdited) {
			title = inferPlainTextReaderTitle(text);
		}
	}

	async function submit(): Promise<void> {
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(title, text, color);
		close();
	}
</script>

<ReaderImportModal
	title="Import from Clipboard"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
	onclose={close}
	onconfirm={submit}
>
	{#snippet body()}
		<ReaderClipboardImportBody
			{title}
			{text}
			{color}
			ontitleinput={(value) => {
				title = value;
				titleEdited = true;
			}}
			ontextinput={updateText}
			oncolorchange={(nextColor) => (color = nextColor)}
		/>
	{/snippet}
</ReaderImportModal>
