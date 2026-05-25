<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		CheckCircle2,
		ChevronDown,
		ChevronUp,
		Circle,
		ClipboardPaste,
		FilePlus2,
		Globe2,
		Library,
		Pencil,
		Trash2,
	} from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
	import ReaderClipboardImportModal from '@/components/ReaderClipboardImportModal.svelte';
	import ReaderDocumentImportModal from '@/components/ReaderDocumentImportModal.svelte';
	import ReaderDocumentMetadataModal from '@/components/ReaderDocumentMetadataModal.svelte';
	import ReaderWebpageImportModal from '@/components/ReaderWebpageImportModal.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import type {
		ReaderDocument,
		ReaderImportPayload,
	} from '@/types/reader.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import { DROPDOWN_POSITIONS } from '@/types/dropdown.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

	const PERCENTAGE_SCALE = 100;
	const READER_IMPORT_ACTIONS = {
		FILE: 'file',
		WEBPAGE: 'webpage',
		CLIPBOARD: 'clipboard',
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
	];
	const documents = $derived(readerRoute.documents);
	let editingLibrary = $state(false);
	let clipboardImportModalVisible = $state(false);
	let webpageImportModalVisible = $state(false);
	let pendingImportPayload = $state<ReaderImportPayload | undefined>(undefined);
	let editingDocument = $state<ReaderDocument | undefined>(undefined);
	const selectedDocumentIds = new SvelteSet<string>();
	const selectedDocuments = $derived(
		documents.filter((document) => selectedDocumentIds.has(document._id))
	);

	onMount(() => {
		readerRoute.refresh().catch(() => {});
		readerSettingsStore.loadSettings().catch(() => {});
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

<div class="mobile-reader">
	<div class="mobile-reader__library-header">
		<span class="mobile-reader__library-title">Library</span>
		<div class="mobile-reader__library-actions">
			{#if editingLibrary}
				<SyButton
					style="ghost"
					size="small"
					hover="red"
					disabled={!selectedDocuments.length}
					onclick={deleteSelectedDocuments}
				>
					<Trash2 size="18" />
				</SyButton>
			{/if}
			{#if editingLibrary || readerRoute.importing}
				<SyButton style="ghost" size="small" center={true} disabled={true}>
					{readerRoute.importing ? 'Importing...' : 'Import'}
				</SyButton>
			{:else}
				<SyDropdown
					values={readerImportDropdownValues}
					position={DROPDOWN_POSITIONS.RIGHT}
					onselection={handleImportSelection}
				>
					{#snippet children(open)}
						<SyButton style="ghost" size="small" center={true}>
							Import
							{#if open}<ChevronUp size="18" />{:else}<ChevronDown
									size="18"
								/>{/if}
						</SyButton>
					{/snippet}
				</SyDropdown>
			{/if}
			{#if editingLibrary || documents.length}
				<SyButton style="ghost" size="small" onclick={toggleEditing}>
					{editingLibrary ? 'Done' : 'Edit'}
				</SyButton>
			{/if}
		</div>
	</div>
	<main
		class="mobile-reader__library"
		class:mobile-reader__library--empty={!documents.length}
	>
		{#if documents.length}
			<div class="mobile-reader__library-grid">
				{#each documents as document (document._id)}
					<div
						class="mobile-reader__book"
						class:mobile-reader__book--selected={selectedDocumentIds.has(
							document._id
						)}
						style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
						onclick={() => handleDocumentCardClick(document)}
						onkeyup={(event) => handleDocumentCardKey(event, document)}
						role="button"
						tabindex="0"
					>
						{#if editingLibrary}
							<span class="mobile-reader__selection-indicator">
								{#if selectedDocumentIds.has(document._id)}
									<CheckCircle2 size="22" />
								{:else}
									<Circle size="22" />
								{/if}
							</span>
							<button
								class="mobile-reader__metadata-button"
								type="button"
								aria-label={`Edit ${document.title}`}
								onclick={(event) => openDocumentDetails(event, document)}
							>
								<Pencil size="15" />
							</button>
						{/if}
						<span class="mobile-reader__book-name">{document.title}</span>
						<span class="mobile-reader__book-meta">
							{getDocumentProgressPercent(document)}% · {document.file_name}
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<div class="mobile-reader__empty">
				<div class="mobile-reader__empty-copy">
					<Library size="38" />
					<p>Your reading library is empty</p>
				</div>
				<div class="mobile-reader__empty-actions" aria-label="Import options">
					<SyButton
						size="small"
						classes={['mobile-reader__empty-action']}
						disabled={readerRoute.importing}
						onclick={openFileImportDetails}
					>
						<FilePlus2 size="20" />
						<span>{readerRoute.importing ? 'Importing...' : 'Document'}</span>
					</SyButton>
					<SyButton
						size="small"
						classes={['mobile-reader__empty-action']}
						disabled={readerRoute.importing}
						onclick={openWebpageImportModal}
					>
						<Globe2 size="20" />
						<span>Webpage</span>
					</SyButton>
					<SyButton
						size="small"
						classes={['mobile-reader__empty-action']}
						disabled={readerRoute.importing}
						onclick={openClipboardImportModal}
					>
						<ClipboardPaste size="20" />
						<span>Clipboard</span>
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
	.mobile-reader {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--grey-2);
		font-family: var(--sy-font-family);
	}

	.mobile-reader__library-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 54px;
		padding: 0 var(--sy-mobile-space--large);
		background: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
	}

	.mobile-reader__library-actions {
		display: flex;
		align-items: center;
	}

	.mobile-reader__library-title {
		min-width: 0;
		overflow: hidden;
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--bold);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mobile-reader__library {
		height: calc(100% - 54px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: var(--sy-mobile-space--large);
		padding-bottom: calc(var(--sy-mobile-space--large) + env(safe-area-inset-bottom));
	}

	.mobile-reader__library--empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-reader__library-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sy-mobile-space--large);
	}

	.mobile-reader__book {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		aspect-ratio: 2 / 3;
		padding: var(--sy-mobile-space--medium);
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 10px, transparent 10px),
			color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #ffffff);
		box-shadow: var(--sy-shadow);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	@media (prefers-color-scheme: dark) {
		.mobile-reader__book {
			background:
				linear-gradient(90deg, rgb(0 0 0 / 12%) 0 10px, transparent 10px),
				color-mix(in srgb, var(--reader-book-color, var(--sy-color--white)) 70%, #000000);
		}
	}

	.mobile-reader__book {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.mobile-reader__book--selected {
		border-color: var(--sy-color--blue);
	}

	.mobile-reader__book:disabled {
		opacity: 0.7;
	}

	.mobile-reader__selection-indicator {
		position: absolute;
		top: var(--sy-mobile-space--medium);
		right: var(--sy-mobile-space--medium);
		color: var(--sy-color--blue);
	}

	.mobile-reader__metadata-button {
		position: absolute;
		top: var(--sy-mobile-space--medium);
		left: var(--sy-mobile-space--medium);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 86%);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-shadow);
	}

	.mobile-reader__book-name,
	.mobile-reader__book-meta {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mobile-reader__book-name {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		line-clamp: 3;
		max-width: 100%;
		padding: var(--sy-mobile-space--extra-small) var(--sy-mobile-space--small);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 78%);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.mobile-reader__book-meta {
		position: absolute;
		left: var(--sy-mobile-space--medium);
		right: var(--sy-mobile-space--medium);
		bottom: var(--sy-mobile-space--medium);
		margin-top: var(--sy-mobile-space--extra-small);
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--mobile-small);
		white-space: nowrap;
	}

	.mobile-reader__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--large);
		width: 100%;
		color: var(--sy-color--grey-4);
		text-align: center;
	}

	.mobile-reader__empty-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-mobile-space--medium);
	}

	.mobile-reader__empty p {
		margin: 0;
	}

	.mobile-reader__empty-actions {
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
		width: 100%;
	}

	:global(.mobile-reader__empty-action) {
		display: inline-flex;
		flex: 1 1 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--small);
		min-width: 0;
		margin: 0;
	}
</style>
