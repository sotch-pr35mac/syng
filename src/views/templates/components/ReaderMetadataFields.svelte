<script lang="ts">
	import ReaderColorSwatches from '@/components/ReaderColorSwatches.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';

	type Props = {
		idPrefix: string;
		title: string;
		color: string;
		titlePlaceholder?: string;
		ontitleinput?: (_title: string) => void;
		oncolorchange?: (_color: string) => void;
	};

	const {
		idPrefix,
		title,
		color = DEFAULT_READER_DOCUMENT_COLOR,
		titlePlaceholder = 'Document title',
		ontitleinput = () => {},
		oncolorchange = () => {},
	}: Props = $props();
</script>

<label class="reader-metadata-field">
	<span>Title</span>
	<SyTextInput
		value={title}
		id={`${idPrefix}-title`}
		size="large"
		autocomplete="off"
		placeholder={titlePlaceholder}
		oninput={ontitleinput}
	/>
</label>
<div class="reader-metadata-field">
	<span>Color</span>
	<ReaderColorSwatches value={color} onchange={oncolorchange} />
</div>

<style>
	.reader-metadata-field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--medium);
	}
</style>
