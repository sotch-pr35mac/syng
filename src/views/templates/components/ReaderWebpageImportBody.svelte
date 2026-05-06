<script lang="ts">
	import ReaderMetadataFields from '@/components/ReaderMetadataFields.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';

	type Props = {
		url: string;
		title: string;
		color: string;
		fetching?: boolean;
		canFetch?: boolean;
		fetchError?: string;
		previewTitle?: string;
		previewText?: string;
		onurlinput?: (_url: string) => void;
		ontitleinput?: (_title: string) => void;
		oncolorchange?: (_color: string) => void;
		onfetchpreview?: () => Promise<void> | void;
	};

	const {
		url,
		title,
		color,
		fetching = false,
		canFetch = false,
		fetchError = '',
		previewTitle = '',
		previewText = '',
		onurlinput = () => {},
		ontitleinput = () => {},
		oncolorchange = () => {},
		onfetchpreview = () => {},
	}: Props = $props();
</script>

<div class="reader-webpage-import__field">
	<label for="reader-webpage-import-url">URL</label>
	<div class="reader-webpage-import__url-row">
		<SyTextInput
			value={url}
			id="reader-webpage-import-url"
			size="large"
			classes={['reader-webpage-import__url-input']}
			type="text"
			inputmode="url"
			autocomplete="url"
			placeholder="https://example.com/article"
			oninput={onurlinput}
			onenter={onfetchpreview}
		/>
		<SyButton
			size="medium"
			classes={['reader-webpage-import__fetch-button']}
			disabled={!canFetch}
			onclick={onfetchpreview}
		>
			{fetching ? 'Fetching...' : 'Fetch Preview'}
		</SyButton>
	</div>
</div>
<ReaderMetadataFields
	idPrefix="reader-webpage-import"
	{title}
	{color}
	{ontitleinput}
	{oncolorchange}
/>
{#if fetchError}
	<p class="reader-webpage-import__error">{fetchError}</p>
{/if}
{#if previewText}
	<div class="reader-webpage-import__field">
		<label for="reader-webpage-import-preview">Preview</label>
		<section
			class="reader-webpage-import__preview"
			id="reader-webpage-import-preview"
			aria-label="Webpage preview"
		>
			<h3>{previewTitle}</h3>
			<p>{previewText}</p>
		</section>
	</div>
{/if}

<style>
	.reader-webpage-import__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--medium);
	}

	.reader-webpage-import__url-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sy-space--large);
	}

	:global(.reader-webpage-import__url-input) {
		box-sizing: border-box;
		flex: 1 1 var(--sy-space--none);
		margin: var(--sy-space--none);
	}

	:global(.reader-webpage-import__fetch-button) {
		margin: var(--sy-space--none);
	}

	.reader-webpage-import__error {
		margin: var(--sy-space--none);
		color: var(--sy-color--red);
	}

	.reader-webpage-import__preview {
		max-height: var(--sy-reader-import-preview-max-height);
		overflow: auto;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-inner-shadow);
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
	}

	.reader-webpage-import__preview h3,
	.reader-webpage-import__preview p {
		margin: var(--sy-space--none);
	}

	.reader-webpage-import__preview h3 {
		margin-bottom: var(--sy-space);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--large);
	}

	.reader-webpage-import__preview p {
		line-height: var(--sy-line-height--body);
		white-space: pre-wrap;
	}
</style>
