<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import ReaderColorSwatches from '@/components/ReaderColorSwatches.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
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
			<label class="reader-document-metadata__field">
				<span>Title</span>
				<SyTextInput
					value={documentTitle}
					id="reader-document-metadata-title"
					size="large"
					autocomplete="off"
					placeholder="Document title"
					oninput={(value) => {
						documentTitle = value;
					}}
				/>
			</label>
			<div class="reader-document-metadata__field">
				<span>Color</span>
				<ReaderColorSwatches
					value={documentColor}
					allowCustom
					onchange={(nextColor) => (documentColor = nextColor)}
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

	@media (max-width: 640px) {
		.reader-document-metadata {
			width: 100%;
		}
	}
</style>
