<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Check,
		ChevronDown,
		ChevronUp,
		ClipboardPaste,
		FilePlus2,
		Globe2,
		Info,
		Library,
		Pencil,
		Trash2,
	} from 'lucide-svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
	import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
	import ReaderClipboardImportModal from '@/components/ReaderClipboardImportModal.svelte';
	import ReaderDocumentImportModal from '@/components/ReaderDocumentImportModal.svelte';
	import ReaderDocumentMetadataModal from '@/components/ReaderDocumentMetadataModal.svelte';
	import ReaderSupportedDocumentsModal from '@/components/ReaderSupportedDocumentsModal.svelte';
	import ReaderWebpageImportModal from '@/components/ReaderWebpageImportModal.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import { READER_SUPPORTED_DOCUMENT_FORMAT_LABEL } from '@/reader/importSupport.js';
	import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
	import type { ReaderDocument, ReaderImportPayload } from '@/types/reader.js';
	import { DROPDOWN_POSITIONS } from '@/types/dropdown.js';
	import { isIPad } from '@/utils/device.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

	const PERCENTAGE_SCALE = 100;
	const READER_IMPORT_ACTIONS = {
		FILE: 'file',
		WEBPAGE: 'webpage',
		CLIPBOARD: 'clipboard',
		SUPPORTED_DOCUMENTS: 'supported-documents',
	} as const;
	const readerImportDropdownValues = [
		{
			id: READER_IMPORT_ACTIONS.FILE,
			text: 'Import Document',
			icon: FilePlus2,
			component: TextWithIconDropdownItem,
		},
		{
			id: READER_IMPORT_ACTIONS.WEBPAGE,
			text: 'Import from Webpage',
			icon: Globe2,
			component: TextWithIconDropdownItem,
		},
		{
			id: READER_IMPORT_ACTIONS.CLIPBOARD,
			text: 'Import from Clipboard',
			icon: ClipboardPaste,
			component: TextWithIconDropdownItem,
		},
		{
			id: 'reader-import-divider',
			component: DividerDropdownItem,
		},
		{
			id: READER_IMPORT_ACTIONS.SUPPORTED_DOCUMENTS,
			text: 'Supported Documents',
			icon: Info,
			component: TextWithIconDropdownItem,
		},
	];

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	const documents = $derived(readerRoute.documents);
	const selectedDocumentIds = new SvelteSet<string>();
	const selectedDocuments = $derived(
		documents.filter((document) => selectedDocumentIds.has(document._id))
	);

	let editingLibrary = $state(false);
	let clipboardImportModalVisible = $state(false);
	let webpageImportModalVisible = $state(false);
	let supportedDocumentsModalVisible = $state(false);
	let pendingImportPayload = $state<ReaderImportPayload | undefined>(undefined);
	let editingDocument = $state<ReaderDocument | undefined>(undefined);

	onMount(() => {
		readerRoute
			.refresh()
			.then(() => {
				if (readerDocumentRouteStore.value) {
					window.location.hash = `#/read/document/${encodeURIComponent(readerDocumentRouteStore.value)}`;
				}
			})
			.catch(() => {});
	});

	$effect(() => {
		if (!documents.length && editingLibrary) {
			editingLibrary = false;
			selectedDocumentIds.clear();
		}
	});

	function toggleEditing(): void {
		editingLibrary = !editingLibrary;
		selectedDocumentIds.clear();
	}

	function openClipboardImportModal(): void {
		clipboardImportModalVisible = true;
	}

	function closeClipboardImportModal(): void {
		clipboardImportModalVisible = false;
	}

	function openWebpageImportModal(): void {
		webpageImportModalVisible = true;
	}

	function closeWebpageImportModal(): void {
		webpageImportModalVisible = false;
	}

	function openSupportedDocumentsModal(): void {
		readerRoute.trackSupportedDocumentsOpened();
		supportedDocumentsModalVisible = true;
	}

	function closeSupportedDocumentsModal(): void {
		supportedDocumentsModalVisible = false;
	}

	async function openFileImportDetails(): Promise<void> {
		const importPayload = await readerRoute.pickImportDocument();
		if (importPayload) {
			pendingImportPayload = importPayload;
		}
	}

	function handleImportSelection(id: string): void {
		if (id === READER_IMPORT_ACTIONS.CLIPBOARD) {
			openClipboardImportModal();
			return;
		}
		if (id === READER_IMPORT_ACTIONS.WEBPAGE) {
			openWebpageImportModal();
			return;
		}
		if (id === READER_IMPORT_ACTIONS.FILE) {
			void openFileImportDetails();
			return;
		}
		if (id === READER_IMPORT_ACTIONS.SUPPORTED_DOCUMENTS) {
			openSupportedDocumentsModal();
		}
	}

	function closeFileImportDetails(): void {
		pendingImportPayload = undefined;
	}

	async function importPendingDocument(title: string, color: string): Promise<void> {
		if (!pendingImportPayload) {
			return;
		}
		await readerRoute.importReaderPayload(pendingImportPayload, title, color);
		pendingImportPayload = undefined;
	}

	function openDocumentDetails(event: MouseEvent, document: ReaderDocument): void {
		event.stopPropagation();
		editingDocument = document;
	}

	function closeDocumentDetails(): void {
		editingDocument = undefined;
	}

	async function saveDocumentDetails(title: string, color: string): Promise<void> {
		if (!editingDocument) {
			return;
		}
		await readerRoute.updateDocumentMetadata(editingDocument, title, color);
		editingDocument = undefined;
	}

	function toggleDocumentSelection(document: ReaderDocument): void {
		if (selectedDocumentIds.has(document._id)) {
			selectedDocumentIds.delete(document._id);
		} else {
			selectedDocumentIds.add(document._id);
		}
	}

	function handleDocumentCardClick(document: ReaderDocument): void {
		if (editingLibrary) {
			toggleDocumentSelection(document);
			return;
		}
		window.location.hash = `#/read/document/${encodeURIComponent(document._id)}`;
	}

	function handleDocumentCardKey(event: KeyboardEvent, document: ReaderDocument): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleDocumentCardClick(document);
		}
	}

	function getDocumentProgressPercent(document: ReaderDocument): number {
		const progression = document.progress?.total_progression ?? 0;
		return Math.round(Math.max(0, Math.min(1, progression)) * PERCENTAGE_SCALE);
	}

	async function deleteSelectedDocuments(): Promise<void> {
		const removed = await readerRoute.deleteDocuments(selectedDocuments);
		if (removed) {
			selectedDocumentIds.clear();
			editingLibrary = false;
		}
	}
</script>

<div class="reader-library-route">
	<div
		class="reader-library-route__header"
		class:reader-library-route__header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<div class="reader-library-route__title-row">
			<h1>Library</h1>
		</div>
		<div class="reader-library-route__header-actions">
			{#if editingLibrary}
				<SyButton
					style="ghost"
					size="large"
					center={true}
					classes={['reader-library-route__delete-button']}
					hover="red"
					disabled={!selectedDocuments.length}
					onclick={deleteSelectedDocuments}
				>
					<Trash2 size="18" />
					Delete
				</SyButton>
			{/if}
			{#if editingLibrary || readerRoute.importing}
				<SyButton style="ghost" size="large" center={true} disabled={true}>
					{readerRoute.importing ? 'Importing...' : 'Import'}
				</SyButton>
			{:else}
				<SyDropdown
					values={readerImportDropdownValues}
					position={DROPDOWN_POSITIONS.RIGHT}
					onselection={handleImportSelection}
				>
					{#snippet children(open)}
						<SyButton style="ghost" size="large" center={true}>
							Import
							{#if open}<ChevronUp size="20" />{:else}<ChevronDown size="20" />{/if}
						</SyButton>
					{/snippet}
				</SyDropdown>
			{/if}
			{#if editingLibrary || documents.length}
				<SyButton style="ghost" size="large" onclick={toggleEditing}>
					{editingLibrary ? 'Done' : 'Edit'}
				</SyButton>
			{/if}
		</div>
	</div>

	<main class="reader-library" class:reader-library--empty={!documents.length}>
		{#if documents.length}
			<div class="reader-library__grid">
				{#each documents as document (document._id)}
					<div
						class="reader-library__book-card"
						class:reader-library__book-card--selected={selectedDocumentIds.has(
							document._id
						)}
						style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
						onclick={() => handleDocumentCardClick(document)}
						onkeyup={(event) => handleDocumentCardKey(event, document)}
						role="button"
						tabindex="0"
					>
						<div class="reader-library__book-cover">
							{#if editingLibrary}
								<span
									class="reader-library__selection-indicator"
									class:reader-library__selection-indicator--selected={selectedDocumentIds.has(
										document._id
									)}
								>
									{#if selectedDocumentIds.has(document._id)}
										<Check size="14" />
									{/if}
								</span>
								<SyButton
									style="filled"
									shape="rectangle"
									size="large"
									classes={['reader-library__metadata-button']}
									aria-label={`Edit ${document.title}`}
									onclick={(event) => openDocumentDetails(event, document)}
								>
									<Pencil size="14" />
								</SyButton>
							{/if}
							<span class="reader-library__book-title">{document.title}</span>
							<span class="reader-library__book-progress"
								>{getDocumentProgressPercent(document)}%</span
							>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="reader-library__empty">
				<div class="reader-library__empty-copy">
					<Library size="42" />
					<p>Your reading library is empty</p>
				</div>
				<div class="reader-library__empty-actions" aria-label="Import options">
					<div class="reader-library__empty-action-group">
						<SyButton
							size="large"
							classes={['reader-library__empty-action']}
							disabled={readerRoute.importing}
							onclick={openFileImportDetails}
						>
							<FilePlus2 size="20" />
							<span>{readerRoute.importing ? 'Importing...' : 'Import Document'}</span
							>
						</SyButton>
						<span class="reader-library__empty-action-hint"
							>{READER_SUPPORTED_DOCUMENT_FORMAT_LABEL}</span
						>
					</div>
					<SyButton
						size="large"
						classes={['reader-library__empty-action']}
						disabled={readerRoute.importing}
						onclick={openWebpageImportModal}
					>
						<Globe2 size="20" />
						<span>Import from Webpage</span>
					</SyButton>
					<SyButton
						size="large"
						classes={['reader-library__empty-action']}
						disabled={readerRoute.importing}
						onclick={openClipboardImportModal}
					>
						<ClipboardPaste size="20" />
						<span>Import from Clipboard</span>
					</SyButton>
				</div>
			</div>
		{/if}
	</main>
</div>

<ReaderClipboardImportModal
	visible={clipboardImportModalVisible}
	importing={readerRoute.importing}
	onclose={closeClipboardImportModal}
	onimport={readerRoute.importPlainTextDocument}
/>

<ReaderWebpageImportModal
	visible={webpageImportModalVisible}
	importing={readerRoute.importing}
	onclose={closeWebpageImportModal}
	onimport={readerRoute.importWebpageDocument}
/>

<ReaderSupportedDocumentsModal
	visible={supportedDocumentsModalVisible}
	onclose={closeSupportedDocumentsModal}
/>

<ReaderDocumentImportModal
	visible={Boolean(pendingImportPayload)}
	initialTitle={pendingImportPayload?.title ?? ''}
	initialColor={pendingImportPayload?.color}
	importing={readerRoute.importing}
	onclose={closeFileImportDetails}
	onimport={importPendingDocument}
/>

<ReaderDocumentMetadataModal
	visible={Boolean(editingDocument)}
	title="Edit Document"
	initialTitle={editingDocument?.title ?? ''}
	initialColor={editingDocument?.color}
	confirmLabel="Save"
	busy={readerRoute.importing}
	onclose={closeDocumentDetails}
	onsave={saveDocumentDetails}
/>

<style>
	.reader-library-route {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background-color: var(--sy-color--white);
	}

	.reader-library-route__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
	}

	.reader-library-route__header--ipad {
		padding-top: var(--sy-space--large);
		padding-bottom: var(--sy-space--large);
	}

	.reader-library-route__title-row,
	.reader-library-route__header-actions {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		min-width: 0;
		color: var(--sy-color--grey-4);
	}

	.reader-library-route__header-actions {
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.reader-library-route__title-row h1 {
		margin: 0;
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.reader-library-route__delete-button) {
		gap: var(--sy-space);
	}

	.reader-library {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		box-sizing: border-box;
	}

	.reader-library--empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reader-library__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: clamp(18px, 3vw, 34px);
		align-items: start;
	}

	.reader-library__book-card {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		border: 0;
		padding: 0;
		background: transparent;
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.reader-library__book-card:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 4px;
	}

	.reader-library__book-card:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.reader-library__book-cover {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 100%;
		padding: var(--sy-space--large);
		padding-left: calc(var(--sy-space--large) + 12px);
		box-sizing: border-box;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
			color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #ffffff);
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--grey-4);
		transition:
			box-shadow var(--sy-transition-duration),
			transform var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}

	@media (prefers-color-scheme: dark) {
		.reader-library__book-cover {
			background:
				linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
				color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #000000);
		}
	}

	@media (hover: hover) {
		.reader-library__book-card:hover .reader-library__book-cover {
			box-shadow: var(--sy-shadow--active);
			transform: translateY(-2px);
			transition-property: box-shadow, transform;
			transition-duration: var(--sy-transition-duration);
		}
	}

	.reader-library__book-card--selected .reader-library__book-cover {
		border-color: var(--sy-color--black);
		box-shadow: var(--sy-shadow--active);
	}

	.reader-library__book-card .reader-library__book-cover {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.reader-library__selection-indicator {
		position: absolute;
		top: var(--sy-space--large);
		right: var(--sy-space--large);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--sy-color--black);
		color: var(--sy-color--white);
		background: transparent;
	}

	.reader-library__selection-indicator--selected {
		background: var(--sy-color--black);
	}

	:global(.reader-library__metadata-button) {
		position: absolute !important;
		top: var(--sy-space--large) !important;
		left: var(--sy-space--large) !important;
	}

	.reader-library__book-title {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		padding: var(--sy-space--small) var(--sy-space) var(--sy-space--small)
			calc(var(--sy-space) + 12px);
		background: rgb(255 255 255 / 70%);
		box-shadow: 0 3px 8px rgb(0 0 0 / 14%);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.3;
		text-align: center;
		overflow-wrap: anywhere;
	}

	@media (prefers-color-scheme: dark) {
		.reader-library__book-title {
			background: rgb(0 0 0 / 50%);
		}
	}

	.reader-library__book-progress {
		position: absolute;
		left: calc(var(--sy-space--large) + 12px);
		right: var(--sy-space--large);
		bottom: var(--sy-space--large);
		margin-top: var(--sy-space--small);
		font-size: 0.78rem;
		text-align: center;
		color: var(--sy-color--black);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reader-library__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--extra-large);
		width: 100%;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: center;
	}

	.reader-library__empty-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
	}

	.reader-library__empty p {
		margin: 0;
	}

	.reader-library__empty-actions {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: var(--sy-space--large);
		max-width: 100%;
		flex-wrap: wrap;
	}

	.reader-library__empty-action-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space);
	}

	:global(.reader-library__empty-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		margin: 0;
	}

	.reader-library__empty-action-hint {
		max-width: 220px;
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--small);
		line-height: 1.4;
	}
</style>
