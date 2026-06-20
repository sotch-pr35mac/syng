<script lang="ts">
	import ReaderModalShell from '@/components/Reader/ReaderModalShell.svelte';
	import ReaderMetadataFields from '@/components/Reader/ReaderMetadataFields.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		inferPlainTextReaderTitle,
	} from '@/utils/readerDocument.js';
	import { cursorToEnd } from '@/actions/cursorToEnd.svelte.js';

	type Props = {
		visible?: boolean;
		importing?: boolean;
		onclose?: () => void;
		onimport?: (_title: string, _text: string, _color: string) => Promise<void> | void;
	};

	const {
		visible = false,
		importing = false,
		onclose = () => {},
		onimport = () => {},
	}: Props = $props();

	let title = $state('');
	let text = $state('');
	let color = $state(DEFAULT_READER_DOCUMENT_COLOR);
	let titleEdited = $state(false);
	let submitting = $state(false);
	const canImport = $derived(
		title.trim().length > 0 && text.trim().length > 0 && !submitting && !importing
	);

	function reset(): void {
		title = '';
		text = '';
		color = DEFAULT_READER_DOCUMENT_COLOR;
		titleEdited = false;
		submitting = false;
	}

	function close(): void {
		reset();
		onclose();
	}

	function updateText(event: Event): void {
		if (!(event.currentTarget instanceof HTMLTextAreaElement)) {
			return;
		}
		text = event.currentTarget.value;
		if (!titleEdited) {
			title = inferPlainTextReaderTitle(text);
		}
	}

	async function submit(): Promise<void> {
		if (!canImport) {
			return;
		}
		submitting = true;
		await onimport(title, text, color);
		close();
	}
</script>

<ReaderModalShell
	title="Import from Clipboard"
	{visible}
	disabled={!canImport}
	busy={importing || submitting}
	onclose={close}
	onconfirm={submit}
>
	{#snippet body()}
		<ReaderMetadataFields
			idPrefix="reader-clipboard-import"
			{title}
			{color}
			ontitleinput={(value) => {
				title = value;
				titleEdited = true;
			}}
			oncolorchange={(nextColor) => (color = nextColor)}
		/>
		<label class="reader-clipboard-import__field">
			<span>Text</span>
			<!-- Reader paste field is an autocorrect exception; "on" is the browser default. -->
			<textarea
				use:cursorToEnd
				value={text}
				class="reader-clipboard-import__textarea"
				placeholder="Paste text here"
				rows="10"
				oninput={updateText}
			></textarea>
		</label>
	{/snippet}
</ReaderModalShell>

<style>
	.reader-clipboard-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-clipboard-import__textarea {
		min-height: var(--sy-reader-import-textarea-min-height);
		resize: vertical;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
		background-color: var(--sy-color--white);
		box-sizing: border-box;
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
	}

	.reader-clipboard-import__textarea::placeholder {
		color: var(--sy-color--grey-1);
	}
</style>
