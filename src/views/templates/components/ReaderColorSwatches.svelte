<script lang="ts">
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
	} from '@/utils/readerDocumentMetadata.js';

	type Props = {
		value?: string;
		onchange?: (_color: string) => void;
		allowCustom?: boolean;
	};

	const {
		value = DEFAULT_READER_DOCUMENT_COLOR,
		onchange = () => {},
		allowCustom = false,
	}: Props = $props();
</script>

<div class="reader-color-swatches">
	{#each READER_DOCUMENT_COLORS as color (color)}
		<button
			class="reader-color-swatches__swatch"
			class:reader-color-swatches__swatch--selected={value === color}
			style:background-color={color}
			type="button"
			aria-label={`Use ${color}`}
			aria-pressed={value === color}
			onclick={() => onchange(color)}
		></button>
	{/each}
</div>
{#if allowCustom}
	<!-- Native color input keeps custom document colors accessible without adding a bespoke picker. -->
	<input
		{value}
		class="reader-color-swatches__custom"
		type="color"
		aria-label="Custom color"
		oninput={(event) => {
			if (event.currentTarget instanceof HTMLInputElement) {
				onchange(event.currentTarget.value);
			}
		}}
	/>
{/if}

<style>
	.reader-color-swatches {
		display: grid;
		grid-template-columns: repeat(8, 28px);
		gap: var(--sy-space);
	}

	.reader-color-swatches__swatch {
		width: 28px;
		height: 28px;
		border: 1px solid rgb(0 0 0 / 16%);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		cursor: pointer;
	}

	.reader-color-swatches__swatch--selected {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	.reader-color-swatches__custom {
		width: 44px;
		height: 32px;
		border: 0;
		padding: 0;
		background: transparent;
	}

	@media (max-width: 640px) {
		.reader-color-swatches {
			grid-template-columns: repeat(4, 28px);
		}
	}
</style>
