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
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import { DROPDOWN_POSITIONS } from '@/types/dropdown.js';

	const library = createReaderLibrary();

	onMount(() => {
		readerRoute.refresh().catch(() => {});
		readerSettingsStore.loadSettings().catch(() => {});
	});
</script>

<div class="mobile-reader">
	{#if library.documents.length || library.editingLibrary}
		<div class="mobile-reader__library-header">
			<span class="mobile-reader__library-title">Library</span>
			<div class="mobile-reader__library-actions">
				{#if library.editingLibrary}
					<SyButton
						style="ghost"
						size="small"
						hover="red"
						disabled={!library.selectedDocuments.length}
						onclick={library.deleteSelectedDocuments}
					>
						<Trash2 size="18" />
					</SyButton>
				{/if}
				{#if library.editingLibrary || readerRoute.importing}
					<SyButton style="ghost" size="small" center={true} disabled={true}>
						{readerRoute.importing ? 'Importing...' : 'Import'}
					</SyButton>
				{:else}
					<SyDropdown
						values={readerImportDropdownValues}
						position={DROPDOWN_POSITIONS.RIGHT}
						onselection={library.handleImportSelection}
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
				{#if library.editingLibrary || library.documents.length}
					<SyButton style="ghost" size="small" onclick={library.toggleEditing}>
						{library.editingLibrary ? 'Done' : 'Edit'}
					</SyButton>
				{/if}
			</div>
		</div>
	{/if}
	<main
		class="mobile-reader__library"
		class:mobile-reader__library--empty={!library.documents.length}
		class:mobile-reader__library--full-height={!library.documents.length &&
			!library.editingLibrary}
	>
		{#if library.documents.length}
			<div class="mobile-reader__library-grid">
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
						onclick={library.openFileImportDetails}
					>
						<FilePlus2 size="20" />
						<span>{readerRoute.importing ? 'Importing...' : 'Document'}</span>
					</SyButton>
					<SyButton
						size="small"
						classes={['mobile-reader__empty-action']}
						disabled={readerRoute.importing}
						onclick={library.openWebpageImportModal}
					>
						<Globe2 size="20" />
						<span>Webpage</span>
					</SyButton>
					<SyButton
						size="small"
						classes={['mobile-reader__empty-action']}
						disabled={readerRoute.importing}
						onclick={library.openClipboardImportModal}
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

	.mobile-reader__library--full-height {
		height: 100%;
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
