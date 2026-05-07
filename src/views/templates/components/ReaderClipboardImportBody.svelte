<script lang="ts">
	import ReaderMetadataFields from '@/components/ReaderMetadataFields.svelte';

	type Props = {
		title: string;
		text: string;
		color: string;
		ontitleinput?: (_title: string) => void;
		ontextinput?: (_text: string) => void;
		oncolorchange?: (_color: string) => void;
	};

	const {
		title,
		text,
		color,
		ontitleinput = () => {},
		ontextinput = () => {},
		oncolorchange = () => {},
	}: Props = $props();

	function updateText(event: Event): void {
		if (event.currentTarget instanceof HTMLTextAreaElement) {
			ontextinput(event.currentTarget.value);
		}
	}
</script>

<ReaderMetadataFields
	idPrefix="reader-clipboard-import"
	{title}
	{color}
	{ontitleinput}
	{oncolorchange}
/>
<label class="reader-clipboard-import__field">
	<span>Text</span>
	<textarea
		value={text}
		class="reader-clipboard-import__textarea"
		placeholder="Paste text here"
		rows="10"
		oninput={updateText}
	></textarea>
</label>

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
