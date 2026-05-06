<script lang="ts">
	import ReaderMetadataFields from '@/components/ReaderMetadataFields.svelte';
	import ReaderModalFooter from '@/components/ReaderModalFooter.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
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
			<ReaderMetadataFields
				idPrefix="reader-document-metadata"
				title={documentTitle}
				color={documentColor}
				ontitleinput={(value) => {
					documentTitle = value;
				}}
				oncolorchange={(nextColor) => (documentColor = nextColor)}
			/>
		</div>
	{/snippet}
	{#snippet footer()}
		<ReaderModalFooter
			disabled={!canSave}
			{confirmLabel}
			busyLabel="Saving..."
			busy={busy || submitting}
			oncancel={onclose}
			onconfirm={save}
		/>
	{/snippet}
</SyModal>

<style>
	.reader-document-metadata {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(420px, 68vw);
	}

	@media (max-width: 640px) {
		.reader-document-metadata {
			width: 100%;
		}
	}
</style>
