<script lang="ts">
	import { ask } from '@tauri-apps/plugin-dialog';
	import ReaderModalShell from '@/components/Reader/ReaderModalShell.svelte';
	import ReaderMetadataFields from '@/components/Reader/ReaderMetadataFields.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import type { ReaderImportPayload, ReaderImportResult } from '@/types/reader.js';
	import { handleError } from '@/utils/error.js';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		invokePrepareReaderImport,
		LARGE_HTML_IMPORT_CANCELED_MESSAGE,
		parseLargeHtmlImportError,
		type PrepareReaderImportInvokeArgs,
	} from '@/utils/readerDocument.js';
	import { networkStatus } from '@/utils/networkStatus.svelte.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (
			_title: string,
			_url: string,
			_color: string,
			_preparedPayload?: ReaderImportPayload
		) => Promise<ReaderImportResult> | ReaderImportResult;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => ({ status: 'cancelled' }),
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
	let importError = $state('');
	let importRequest = 0;
	let previewRequest = 0;
	let preparedUrl = $state('');
	let preparedPayload = $state<ReaderImportPayload | undefined>(undefined);
	const preparedPayloadIsValid = $derived(Boolean(preparedPayload && preparedUrl === url.trim()));
	// A prepared preview is already local, so it remains saveable after connectivity drops.
	const canImport = $derived(
		(networkStatus.isOnline || preparedPayloadIsValid) &&
			url.trim().length > 0 &&
			!fetching &&
			!submitting &&
			!importing
	);
	const canFetch = $derived(
		networkStatus.isOnline && url.trim().length > 0 && !fetching && !submitting && !importing
	);
	const offlineImportUnavailable = $derived(networkStatus.isOffline && !preparedPayloadIsValid);
	const disabledImportTooltip = $derived(
		offlineImportUnavailable
			? 'You are offline. Fetch a preview while online before importing.'
			: ''
	);
	const previewText = $derived(preparedPayload?.text.trim().slice(0, PREVIEW_TEXT_LIMIT) ?? '');

	function reset(): void {
		url = '';
		title = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		submitting = false;
		fetching = false;
		fetchError = '';
		importError = '';
		preparedUrl = '';
		preparedPayload = undefined;
	}

	function close(): void {
		importRequest += 1;
		previewRequest += 1;
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
		const request = ++previewRequest;
		const requestedUrl = url.trim();
		try {
			const nextPayload = await prepareWithLargeHtmlConfirmation({
				url: requestedUrl,
				title: titleEdited ? title : undefined,
			});
			if (request !== previewRequest || requestedUrl !== url.trim()) {
				return;
			}
			preparedPayload = nextPayload;
			preparedUrl = requestedUrl;
			if (!titleEdited) {
				title = nextPayload.title;
			}
		} catch (error) {
			if (request !== previewRequest || requestedUrl !== url.trim()) {
				return;
			}
			if (error instanceof Error && error.message === LARGE_HTML_IMPORT_CANCELED_MESSAGE) {
				fetchError = '';
				return;
			}
			fetchError =
				error instanceof Error ? error.message : 'Could not fetch webpage preview.';
		} finally {
			if (request === previewRequest) {
				fetching = false;
			}
		}
	}

	async function submit(): Promise<void> {
		if (!canImport) {
			return;
		}
		submitting = true;
		importError = '';
		const request = ++importRequest;
		try {
			const result = await onimport(
				titleEdited ? title : title.trim(),
				url.trim(),
				color,
				preparedPayloadIsValid ? preparedPayload : undefined
			);
			if (request !== importRequest) {
				return;
			}
			if (result.status === 'success') {
				close();
			} else if (result.status === 'error') {
				importError = result.message;
			}
		} catch (error) {
			const message = 'There was an error importing the webpage.';
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
	title="Import from Webpage"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
	errorMessage={importError}
	disabledConfirmTooltip={disabledImportTooltip}
	onclose={close}
	onconfirm={submit}
>
	{#snippet body()}
		<div class="reader-webpage-import__field">
			<label for="reader-webpage-import-url">URL</label>
			<div class="reader-webpage-import__url-row">
				<SyTextInput
					value={url}
					id="reader-webpage-import-url"
					aria-describedby={fetchError
						? 'reader-webpage-import-error'
						: networkStatus.isOffline
							? 'reader-webpage-import-offline'
							: undefined}
					size="large"
					classes={['reader-webpage-import__url-input']}
					type="text"
					inputmode="url"
					autocomplete="url"
					placeholder="https://example.com/article"
					oninput={(value) => {
						url = value;
						fetchError = '';
					}}
					onenter={fetchPreview}
				/>
				{#if networkStatus.isOffline}
					<span class="sy-tooltip--container">
						<SyButton
							size="medium"
							classes={['reader-webpage-import__fetch-button']}
							disabled={!canFetch}
							onclick={fetchPreview}
						>
							{fetching ? 'Fetching...' : 'Fetch Preview'}
						</SyButton>
						<span class="sy-tooltip--body sy-tooltip--body-top"
							><p>
								You are offline. Connect to the internet to fetch a preview.
							</p></span
						>
					</span>
				{:else}
					<SyButton
						size="medium"
						classes={['reader-webpage-import__fetch-button']}
						disabled={!canFetch}
						onclick={fetchPreview}
					>
						{fetching ? 'Fetching...' : 'Fetch Preview'}
					</SyButton>
				{/if}
			</div>
		</div>
		{#if networkStatus.isOffline}
			<p
				class="reader-webpage-import__offline-status"
				role="status"
				id="reader-webpage-import-offline"
			>
				You are offline. Connect to the internet to fetch a preview before importing.
			</p>
		{/if}
		<ReaderMetadataFields
			idPrefix="reader-webpage-import"
			{title}
			{color}
			ontitleinput={(value) => {
				title = value;
				titleEdited = true;
			}}
			oncolorchange={(nextColor) => (color = nextColor)}
		/>
		{#if fetchError}
			<p class="reader-webpage-import__error" role="alert" id="reader-webpage-import-error">
				{fetchError}
			</p>
		{/if}
		<span class="sy-sr-only" role="status"
			>{fetching
				? 'Fetching webpage preview…'
				: preparedPayloadIsValid
					? 'Webpage preview ready.'
					: ''}</span
		>
		{#if preparedPayloadIsValid && previewText}
			<div class="reader-webpage-import__field">
				<span>Preview</span>
				<section
					class="reader-webpage-import__preview"
					id="reader-webpage-import-preview"
					aria-label="Webpage preview"
				>
					<h3>{preparedPayload?.title}</h3>
					<p>{previewText}</p>
				</section>
			</div>
		{/if}
	{/snippet}
</ReaderModalShell>

<style>
	.reader-webpage-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-webpage-import__url-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sy-space--large);
	}

	:global(.reader-webpage-import__url-input) {
		box-sizing: border-box;
		flex: 1 1 12rem;
		min-width: 0;
		margin: var(--sy-space--none);
	}

	:global(.reader-webpage-import__fetch-button) {
		margin: var(--sy-space--none);
	}

	.reader-webpage-import__error {
		margin: var(--sy-space--none);
		color: var(--sy-text--red);
	}

	.reader-webpage-import__offline-status {
		margin: var(--sy-space--none);
		color: var(--sy-text--muted);
	}

	@media (hover: hover) {
		.reader-webpage-import__offline-status {
			position: absolute;
			width: 1px;
			height: 1px;
			clip-path: inset(50%);
			overflow: hidden;
		}
	}

	.reader-webpage-import__preview {
		max-height: var(--sy-reader-import-preview-max-height);
		overflow: auto;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		color: var(--sy-text--muted);
		box-shadow: var(--sy-inner-shadow);
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
	}

	.reader-webpage-import__preview h3,
	.reader-webpage-import__preview p {
		margin: var(--sy-space--none);
	}

	.reader-webpage-import__preview h3 {
		margin-bottom: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
	}

	.reader-webpage-import__preview p {
		line-height: var(--sy-line-height--body);
		white-space: pre-wrap;
	}
</style>
