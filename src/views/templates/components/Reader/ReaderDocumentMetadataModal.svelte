<script lang="ts">
	import ReaderModalShell from '@/components/Reader/ReaderModalShell.svelte';
	import ReaderMetadataFields from '@/components/Reader/ReaderMetadataFields.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		normalizeReaderDocumentColor,
	} from '@/utils/readerDocument.js';

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

<ReaderModalShell
	{title}
	{visible}
	{confirmLabel}
	busyLabel="Saving..."
	disabled={!canSave}
	busy={busy || submitting}
	width="min(420px, 68vw)"
	{onclose}
	onconfirm={save}
>
	{#snippet body()}
		<ReaderMetadataFields
			idPrefix="reader-document-metadata"
			title={documentTitle}
			color={documentColor}
			ontitleinput={(value) => {
				documentTitle = value;
			}}
			oncolorchange={(nextColor) => (documentColor = nextColor)}
		/>
	{/snippet}
</ReaderModalShell>
