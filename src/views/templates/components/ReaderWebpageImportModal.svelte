<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
	} from '@/utils/readerDocumentMetadata.js';
	import { fetchReadableWebpage } from '@/utils/readerWebpageImport.js';
	import { handleError } from '@/utils/error.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (
			_title: string,
			_html: string,
			_color: string,
			_sourceUrl: string
		) => Promise<void> | void;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	let url = $state('');
	let loadedUrl = $state('');
	let title = $state('');
	let html = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let titleEdited = $state(false);
	let loading = $state(false);
	let submitting = $state(false);
	const hasLoadedCurrentUrl = $derived(Boolean(html) && loadedUrl === url.trim());
	const canFetch = $derived(url.trim().length > 0 && !loading && !importing && !submitting);
	const canImport = $derived(
		canFetch && hasLoadedCurrentUrl && title.trim().length > 0 && html.trim().length > 0
	);
	const canSubmit = $derived(hasLoadedCurrentUrl ? canImport : canFetch);

	function reset(): void {
		url = '';
		loadedUrl = '';
		title = '';
		html = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		loading = false;
		submitting = false;
	}

	function close(): void {
		reset();
		onclose();
	}

	async function loadWebpage(): Promise<void> {
		if (!canFetch) {
			return;
		}
		loading = true;
		try {
			const webpage = await fetchReadableWebpage(url);
			loadedUrl = url.trim();
			html = webpage.html;
			if (!titleEdited) {
				title = webpage.title;
			}
			url = webpage.sourceUrl;
			loadedUrl = webpage.sourceUrl;
		} catch (error) {
			handleError('There was an error importing the webpage.', error);
		} finally {
			loading = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!hasLoadedCurrentUrl) {
			await loadWebpage();
		}
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(title, html, color, url);
		close();
	}
</script>

<SyModal title="Import From Webpage" {visible} onclose={close}>
	{#snippet body()}
		<form class="reader-webpage-import" id="reader-webpage-import-form" onsubmit={submit}>
			<label class="reader-webpage-import__field">
				<span>URL</span>
				<div class="reader-webpage-import__url-row">
					<input
						bind:value={url}
						class="reader-webpage-import__input"
						type="text"
						inputmode="url"
						autocomplete="url"
						placeholder="https://example.com/article"
						oninput={() => {
							html = '';
							loadedUrl = '';
						}}
					/>
					<SyButton size="large" disabled={!canFetch} onclick={loadWebpage}>
						{loading ? 'Fetching...' : 'Fetch'}
					</SyButton>
				</div>
			</label>
			<label class="reader-webpage-import__field">
				<span>Title</span>
				<input
					bind:value={title}
					class="reader-webpage-import__input"
					type="text"
					autocomplete="off"
					placeholder="Document title"
					oninput={() => {
						titleEdited = true;
					}}
				/>
			</label>
			<div class="reader-webpage-import__field">
				<span>Color</span>
				<div class="reader-webpage-import__swatches">
					{#each READER_DOCUMENT_COLORS as swatchColor (swatchColor)}
						<button
							class="reader-webpage-import__swatch"
							class:reader-webpage-import__swatch--selected={color === swatchColor}
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
		</form>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={close}>Cancel</SyButton>
		<SyButton
			size="large"
			color="green"
			disabled={!canSubmit}
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

	.reader-webpage-import__url-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--sy-space);
		align-items: center;
	}

	.reader-webpage-import__input {
		min-width: 0;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
		box-sizing: border-box;
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: 16px;
	}

	.reader-webpage-import__swatches {
		display: grid;
		grid-template-columns: repeat(8, 28px);
		gap: var(--sy-space);
	}

	.reader-webpage-import__swatch {
		width: 28px;
		height: 28px;
		border: 1px solid rgb(0 0 0 / 16%);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		cursor: pointer;
	}

	.reader-webpage-import__swatch--selected {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	@media (max-width: 640px) {
		.reader-webpage-import {
			width: 100%;
		}

		.reader-webpage-import__url-row {
			grid-template-columns: 1fr;
		}

		.reader-webpage-import__swatches {
			grid-template-columns: repeat(4, 28px);
		}
	}
</style>
