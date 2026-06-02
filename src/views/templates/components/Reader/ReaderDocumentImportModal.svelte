<script lang="ts">
	import ReaderModalShell from '@/components/Reader/ReaderModalShell.svelte';
	import ReaderMetadataFields from '@/components/Reader/ReaderMetadataFields.svelte';
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
		onimport?: (_title: string, _color: string) => Promise<void> | void;
	};

	const {
		visible = false,
		initialTitle = '',
		initialColor = DEFAULT_READER_DOCUMENT_COLOR,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	let title = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let submitting = $state(false);
	const canImport = $derived(title.trim().length > 0 && !submitting && !importing);

	$effect(() => {
		if (visible) {
			title = initialTitle;
			color = normalizeReaderDocumentColor(initialColor);
			submitting = false;
		}
	});

	function close(): void {
		submitting = false;
		onclose();
	}

	async function submit(): Promise<void> {
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(title, color);
		close();
	}
</script>

<ReaderModalShell
	title="Import Document"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
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
