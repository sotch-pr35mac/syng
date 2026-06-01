<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ChevronDown,
		ChevronUp,
		ClipboardPaste,
		FilePlus2,
		Globe2,
		Library,
		Trash2,
	} from 'lucide-svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import ReaderBookCard from '@/components/ReaderBookCard.svelte';
	import ReaderClipboardImportModal from '@/components/ReaderClipboardImportModal.svelte';
	import ReaderDocumentImportModal from '@/components/ReaderDocumentImportModal.svelte';
	import ReaderDocumentMetadataModal from '@/components/ReaderDocumentMetadataModal.svelte';
	import ReaderSupportedDocumentsModal from '@/components/ReaderSupportedDocumentsModal.svelte';
	import ReaderWebpageImportModal from '@/components/ReaderWebpageImportModal.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import {
		createReaderLibrary,
		readerImportDropdownValues,
	} from '@/composables/readerLibrary.svelte.js';
	import { READER_SUPPORTED_DOCUMENT_FORMAT_LABEL } from '@/reader/importSupport.js';
	import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
	import { DROPDOWN_POSITIONS } from '@/types/dropdown.js';
	import { isIPad } from '@/utils/device.js';

	const library = createReaderLibrary();
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();

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
			{#if library.editingLibrary}
				<SyButton
					style="ghost"
					size="large"
					center={true}
					classes={['reader-library-route__delete-button']}
					hover="red"
					disabled={!library.selectedDocuments.length}
					onclick={library.deleteSelectedDocuments}
				>
					<Trash2 size="18" />
					Delete
				</SyButton>
			{/if}
			{#if library.editingLibrary || readerRoute.importing}
				<SyButton style="ghost" size="large" center={true} disabled={true}>
					{readerRoute.importing ? 'Importing...' : 'Import'}
				</SyButton>
			{:else}
				<SyDropdown
					values={readerImportDropdownValues}
					position={DROPDOWN_POSITIONS.RIGHT}
					onselection={library.handleImportSelection}
				>
					{#snippet children(open)}
						<SyButton style="ghost" size="large" center={true}>
							Import
							{#if open}<ChevronUp size="20" />{:else}<ChevronDown size="20" />{/if}
						</SyButton>
					{/snippet}
				</SyDropdown>
			{/if}
			{#if library.editingLibrary || library.documents.length}
				<SyButton style="ghost" size="large" onclick={library.toggleEditing}>
					{library.editingLibrary ? 'Done' : 'Edit'}
				</SyButton>
			{/if}
		</div>
	</div>

	<main class="reader-library" class:reader-library--empty={!library.documents.length}>
		{#if library.documents.length}
			<div class="reader-library__grid">
				{#each library.documents as document (document._id)}
					<ReaderBookCard
						{document}
						editing={library.editingLibrary}
						selected={library.selectedDocumentIds.has(document._id)}
						onclick={() => library.handleDocumentCardClick(document)}
						onkeyup={(event) => library.handleDocumentCardKey(event, document)}
						onedit={(event) => library.openDocumentDetails(event, document)}
					/>
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
							onclick={library.openFileImportDetails}
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
						onclick={library.openWebpageImportModal}
					>
						<Globe2 size="20" />
						<span>Import from Webpage</span>
					</SyButton>
					<SyButton
						size="large"
						classes={['reader-library__empty-action']}
						disabled={readerRoute.importing}
						onclick={library.openClipboardImportModal}
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
	visible={library.clipboardImportModalVisible}
	importing={readerRoute.importing}
	onclose={library.closeClipboardImportModal}
	onimport={readerRoute.importPlainTextDocument}
/>

<ReaderWebpageImportModal
	visible={library.webpageImportModalVisible}
	importing={readerRoute.importing}
	onclose={library.closeWebpageImportModal}
	onimport={readerRoute.importWebpageDocument}
/>

<ReaderSupportedDocumentsModal
	visible={library.supportedDocumentsModalVisible}
	onclose={library.closeSupportedDocumentsModal}
/>

<ReaderDocumentImportModal
	visible={Boolean(library.pendingImportPayload)}
	initialTitle={library.pendingImportPayload?.title ?? ''}
	initialColor={library.pendingImportPayload?.color}
	importing={readerRoute.importing}
	onclose={library.closeFileImportDetails}
	onimport={library.importPendingDocument}
/>

<ReaderDocumentMetadataModal
	visible={Boolean(library.editingDocument)}
	title="Edit Document"
	initialTitle={library.editingDocument?.title ?? ''}
	initialColor={library.editingDocument?.color}
	confirmLabel="Save"
	busy={readerRoute.importing}
	onclose={library.closeDocumentDetails}
	onsave={library.saveDocumentDetails}
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
