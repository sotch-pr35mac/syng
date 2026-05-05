<script lang="ts">
	import ReaderColorSwatches from '@/components/ReaderColorSwatches.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { DEFAULT_READER_DOCUMENT_COLOR } from '@/utils/readerDocumentMetadata.js';

	type Props = {
		idPrefix: string;
		title: string;
		color: string;
		titlePlaceholder?: string;
		allowCustomColor?: boolean;
		ontitleinput?: (_title: string) => void;
		oncolorchange?: (_color: string) => void;
	};

	const {
		idPrefix,
		title,
		color = DEFAULT_READER_DOCUMENT_COLOR,
		titlePlaceholder = 'Document title',
		allowCustomColor = false,
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
	<ReaderColorSwatches
		value={color}
		allowCustom={allowCustomColor}
		onchange={oncolorchange}
	/>
</div>

<style>
	.reader-metadata-field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
	}
</style>
