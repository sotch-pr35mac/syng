import { SvelteSet } from 'svelte/reactivity';
import { ClipboardPaste, FilePlus2, Globe2, Info } from 'lucide-svelte';
import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
import { readerRoute } from '@/composables/reader.svelte.js';
import type { ReaderDocument, ReaderImportPayload } from '@/types/reader.js';

const READER_IMPORT_ACTIONS = {
	FILE: 'file',
	WEBPAGE: 'webpage',
	CLIPBOARD: 'clipboard',
	SUPPORTED_DOCUMENTS: 'supported-documents',
} as const;

export const readerImportDropdownValues = [
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

/**
 * Shared reader-library view logic for the desktop (`Reader/Library.svelte`) and
 * mobile (`mobile/Reader/MobileReader.svelte`) pages. Call once during component
 * script init; the returned object exposes the reactive library state (as getters)
 * and the handlers both pages bind to. Platform-specific concerns (route restore,
 * settings loading, device flags) stay in the individual components.
 */
export function createReaderLibrary() {
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

	async function deleteSelectedDocuments(): Promise<void> {
		const removed = await readerRoute.deleteDocuments(selectedDocuments);
		if (removed) {
			selectedDocumentIds.clear();
			editingLibrary = false;
		}
	}

	return {
		get documents(): ReaderDocument[] {
			return documents;
		},
		selectedDocumentIds,
		get selectedDocuments(): ReaderDocument[] {
			return selectedDocuments;
		},
		get editingLibrary(): boolean {
			return editingLibrary;
		},
		get clipboardImportModalVisible(): boolean {
			return clipboardImportModalVisible;
		},
		get webpageImportModalVisible(): boolean {
			return webpageImportModalVisible;
		},
		get supportedDocumentsModalVisible(): boolean {
			return supportedDocumentsModalVisible;
		},
		get pendingImportPayload(): ReaderImportPayload | undefined {
			return pendingImportPayload;
		},
		get editingDocument(): ReaderDocument | undefined {
			return editingDocument;
		},
		toggleEditing,
		openClipboardImportModal,
		closeClipboardImportModal,
		openWebpageImportModal,
		closeWebpageImportModal,
		openSupportedDocumentsModal,
		closeSupportedDocumentsModal,
		openFileImportDetails,
		handleImportSelection,
		closeFileImportDetails,
		importPendingDocument,
		openDocumentDetails,
		closeDocumentDetails,
		saveDocumentDetails,
		toggleDocumentSelection,
		handleDocumentCardClick,
		handleDocumentCardKey,
		deleteSelectedDocuments,
	};
}
