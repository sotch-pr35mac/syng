<script lang="ts">
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
	} from '@/utils/readerDocumentMetadata.js';

	type Props = {
		value?: string;
		onchange?: (_color: string) => void;
	};

	const { value = DEFAULT_READER_DOCUMENT_COLOR, onchange = () => {} }: Props = $props();

	let colorInputElement: HTMLInputElement | undefined = $state();

	const isCustomColor = $derived(!READER_DOCUMENT_COLORS.includes(value));
</script>

<div class="reader-color-swatches">
	{#each READER_DOCUMENT_COLORS as color (color)}
		<button
			class="reader-color-swatches__swatch"
			class:reader-color-swatches__swatch--selected={value === color}
			style:--swatch-color={color}
			type="button"
			aria-label={`Use ${color}`}
			aria-pressed={value === color}
			onclick={() => onchange(color)}
		></button>
	{/each}
	<button
		class="reader-color-swatches__swatch reader-color-swatches__swatch--custom"
		class:reader-color-swatches__swatch--selected={isCustomColor}
		style:--swatch-color={isCustomColor ? value : undefined}
		type="button"
		aria-label="Custom color"
		onclick={() => colorInputElement?.click()}
	>
		<input
			bind:this={colorInputElement}
			value={isCustomColor ? value : DEFAULT_READER_DOCUMENT_COLOR}
			class="reader-color-swatches__custom-input"
			type="color"
			tabindex={-1}
			aria-hidden="true"
			oninput={(event) => {
				if (event.currentTarget instanceof HTMLInputElement) {
					onchange(event.currentTarget.value);
				}
			}}
		/>
	</button>
</div>

<style>
	.reader-color-swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, 28px);
		gap: var(--sy-space);
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
	}

	.reader-color-swatches__swatch {
		width: 28px;
		height: 28px;
		border: var(--sy-border);
		border-radius: 50%;
		box-shadow: var(--sy-shadow);
		cursor: pointer;
		transition: box-shadow var(--sy-transition-duration);
		background-color: color-mix(in srgb, var(--swatch-color) 70%, #ffffff);
	}

	@media (prefers-color-scheme: dark) {
		.reader-color-swatches__swatch {
			background-color: color-mix(in srgb, var(--swatch-color) 70%, #000000);
		}
	}

	.reader-color-swatches__swatch:hover {
		box-shadow: var(--sy-shadow--active);
	}

	.reader-color-swatches__swatch:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	.reader-color-swatches__swatch--selected {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	.reader-color-swatches__swatch--custom {
		position: relative;
		background: conic-gradient(
			hsl(0 80% 65%),
			hsl(60 80% 65%),
			hsl(120 80% 65%),
			hsl(180 80% 65%),
			hsl(240 80% 65%),
			hsl(300 80% 65%),
			hsl(360 80% 65%)
		);
		overflow: hidden;
	}

	@media (prefers-color-scheme: dark) {
		.reader-color-swatches__swatch--custom {
			background: conic-gradient(
				hsl(0 55% 45%),
				hsl(60 55% 45%),
				hsl(120 55% 45%),
				hsl(180 55% 45%),
				hsl(240 55% 45%),
				hsl(300 55% 45%),
				hsl(360 55% 45%)
			);
		}
	}

	.reader-color-swatches__custom-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
</style>
