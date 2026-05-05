<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import ReaderColorSwatches from '@/components/ReaderColorSwatches.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (_title: string, _url: string, _color: string) => Promise<void> | void;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	let url = $state('');
	let title = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let titleEdited = $state(false);
	let submitting = $state(false);
	const canImport = $derived(url.trim().length > 0 && !submitting && !importing);

	function reset(): void {
		url = '';
		title = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		submitting = false;
	}

	function close(): void {
		reset();
		onclose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(titleEdited ? title : title.trim(), url, color);
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
					}}
				/>
			</label>
			<label class="reader-webpage-import__field">
				<span>Title</span>
				<SyTextInput
					value={title}
					id="reader-webpage-import-title"
					size="large"
					type="text"
					autocomplete="off"
					placeholder="Use webpage title"
					oninput={(value) => {
						title = value;
						titleEdited = true;
					}}
				/>
			</label>
			<div class="reader-webpage-import__field">
				<span>Color</span>
				<ReaderColorSwatches value={color} onchange={(nextColor) => (color = nextColor)} />
			</div>
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
					'reader-webpage-import-form'
				) as HTMLFormElement | null;
				form?.requestSubmit();
			}}
		>
			{importing || submitting ? 'Importing...' : 'Import'}
		</SyButton>
	{/snippet}
</SyModal>

<style>
	.reader-webpage-import {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(520px, 72vw);
		font-family: var(--sy-font-family);
	}

	.reader-webpage-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-size: 0.92rem;
		font-weight: var(--sy-font-weight--medium);
	}

	@media (max-width: 640px) {
		.reader-webpage-import {
			width: 100%;
		}
	}
</style>
