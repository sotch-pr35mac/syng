<script lang="ts">
	import ReaderMetadataFields from '@/components/ReaderMetadataFields.svelte';

	type Props = {
		title: string;
		color: string;
		ontitleinput?: (_title: string) => void;
		oncolorchange?: (_color: string) => void;
	};

	const { title, color, ontitleinput = () => {}, oncolorchange = () => {} }: Props = $props();
</script>

<ReaderMetadataFields
	idPrefix="reader-document-import"
	{title}
	{color}
	{ontitleinput}
	{oncolorchange}
/>
