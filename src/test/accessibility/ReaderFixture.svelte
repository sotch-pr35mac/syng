<script lang="ts">
	import ReaderBookCard from '@/components/Reader/ReaderBookCard.svelte';
	import ReaderClipboardImportModal from '@/components/Reader/ReaderClipboardImportModal.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { createPlainTextReaderImportPayload } from '@/utils/readerDocument.js';
	import type { ReaderDocument } from '@/types/reader.js';
	let importVisible = $state(false);
	let selected = $state(false);
	let status = $state('');
	const failImport = new URLSearchParams(location.search).has('importError');
	const book: ReaderDocument = {
		...createPlainTextReaderImportPayload('A long book title for enlarged text', '你好世界'),
		_id: 'fixture-book',
		imported_at: '',
		updated_at: '',
		reading_order: [],
		progress: {
			resource_href: 'text',
			position: 1,
			total_progression: 0.25,
			page_index: 0,
			text_position: { start: 1, end: 1 },
			text_quote: { exact: '', prefix: '', suffix: '' },
			updated_at: '',
		},
	};
</script>

<section aria-label="Reader controls">
	<h2>Reader library</h2>
	<div class="book">
		<ReaderBookCard
			document={book}
			editing
			{selected}
			onclick={() => (selected = !selected)}
			onedit={() => (status = 'Editing book')}
		/>
	</div>
	<p role="status">{status}</p>
	<SyButton onclick={() => (importVisible = true)}>Import text</SyButton>
</section>
<ReaderClipboardImportModal
	visible={importVisible}
	onclose={() => (importVisible = false)}
	onimport={() => {
		if (failImport) {
			return { status: 'error', message: 'Could not save the document. Please try again.' };
		}
		status = 'Imported text';
		return { status: 'success' };
	}}
/>

<style>
	.book {
		width: min(100%, 14rem);
	}
</style>
