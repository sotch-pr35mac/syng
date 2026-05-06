<script lang="ts">
	import ReaderColorSwatches from '@/components/ReaderColorSwatches.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_TITLE_MAX_LENGTH,
	} from '@/utils/readerDocumentMetadata.js';

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

	const clampedTitle = $derived(title.slice(0, READER_DOCUMENT_TITLE_MAX_LENGTH));
	const atLimit = $derived(clampedTitle.length >= READER_DOCUMENT_TITLE_MAX_LENGTH);

	$effect(() => {
		if (title.length > READER_DOCUMENT_TITLE_MAX_LENGTH) {
			ontitleinput(clampedTitle);
		}
	});
</script>

<label class="reader-metadata-field">
	<span class="reader-metadata-field__title-label">
		Title
		{#if atLimit}
			<span class="reader-metadata-field__char-limit">
				{clampedTitle.length}/{READER_DOCUMENT_TITLE_MAX_LENGTH}
			</span>
		{/if}
	</span>
	<SyTextInput
		value={clampedTitle}
		id={`${idPrefix}-title`}
		size="large"
		autocomplete="off"
		placeholder={titlePlaceholder}
		maxlength={READER_DOCUMENT_TITLE_MAX_LENGTH}
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
	.reader-metadata-field__title-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.reader-metadata-field__char-limit {
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--regular);
		color: var(--sy-color--grey-1);
	}
</style>
