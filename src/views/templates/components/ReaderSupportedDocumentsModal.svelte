<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import {
		READER_SUPPORTED_DOCUMENT_FORMAT_LABEL,
		READER_SUPPORTED_TEXT_ENCODING_LABEL,
	} from '@/reader/importSupport.js';

	type Props = {
		visible?: boolean;
		onclose?: () => void;
	};

	const { visible = false, onclose = () => {} }: Props = $props();
</script>

<SyModal title="Supported Documents" {visible} {onclose}>
	{#snippet body()}
		<div class="reader-supported-documents">
			<section class="reader-supported-documents__section">
				<h3>File Types</h3>
				<p>{READER_SUPPORTED_DOCUMENT_FORMAT_LABEL}</p>
			</section>
			<section class="reader-supported-documents__section">
				<h3>Text Encodings</h3>
				<p>{READER_SUPPORTED_TEXT_ENCODING_LABEL}</p>
			</section>
			<section class="reader-supported-documents__section">
				<h3>Notes</h3>
				<ul>
					<li>
						PDFs need extractable text. Scanned or image-only PDFs may not import useful
						text.
					</li>
					<li>EPUB imports focus on readable book text.</li>
					<li>Please use Import from Webpage for online articles and pages.</li>
					<li>Imports preserve readable text and basic document structure.</li>
					<li>Please use Import from Clipboard for unsupported documents.</li>
					<li>Images may not display properly.</li>
				</ul>
			</section>
		</div>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={onclose}>Close</SyButton>
	{/snippet}
</SyModal>

<style>
	.reader-supported-documents {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: min(460px, 68vw);
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
	}

	.reader-supported-documents__section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
	}

	.reader-supported-documents h3,
	.reader-supported-documents p,
	.reader-supported-documents ul {
		margin: 0;
	}

	.reader-supported-documents h3 {
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-supported-documents p,
	.reader-supported-documents li {
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}

	.reader-supported-documents ul {
		padding-left: var(--sy-space--extra-large);
	}

	@media (max-width: 640px) {
		.reader-supported-documents {
			width: 100%;
		}
	}
</style>
