<script lang="ts">
	import {
		DEFAULT_READER_DOCUMENT_COLOR,
		READER_DOCUMENT_COLORS,
	} from '@/utils/readerDocument.js';

	type Props = {
		value?: string;
		onchange?: (_color: string) => void;
	};

	const { value = DEFAULT_READER_DOCUMENT_COLOR, onchange = () => {} }: Props = $props();

	const colorNames = ['White', 'Blue', 'Green', 'Orange', 'Pink', 'Lavender'];
	const isCustomColor = $derived(!READER_DOCUMENT_COLORS.includes(value));
</script>

<div class="reader-color-swatches" role="group" aria-label="Document color">
	{#each READER_DOCUMENT_COLORS as color, index (color)}
		<button
			class="reader-color-swatches__swatch"
			class:reader-color-swatches__swatch--selected={value === color}
			style:--swatch-color={color}
			type="button"
			aria-label={`Use ${colorNames[index]} document color`}
			aria-pressed={value === color}
			onclick={() => onchange(color)}
		></button>
	{/each}
	<label class="reader-color-swatches__custom-control">
		<input
			value={isCustomColor ? value : DEFAULT_READER_DOCUMENT_COLOR}
			class="reader-color-swatches__custom-input"
			type="color"
			aria-label="Custom document color"
			oninput={(event) => {
				if (event.currentTarget instanceof HTMLInputElement) {
					onchange(event.currentTarget.value);
				}
			}}
		/>
		<span
			class="reader-color-swatches__swatch reader-color-swatches__swatch--custom"
			class:reader-color-swatches__swatch--selected={isCustomColor}
			style:--swatch-color={isCustomColor ? value : undefined}
			aria-hidden="true"
		></span>
	</label>
</div>

<style>
	.reader-color-swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, 1.75rem);
		gap: var(--sy-space);
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
	}

	.reader-color-swatches__swatch {
		display: block;
		width: 1.75rem;
		height: 1.75rem;
		box-sizing: border-box;
		border: 1px solid var(--sy-control--border);
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

	.reader-color-swatches__swatch--selected {
		outline: 2px solid var(--sy-text--blue);
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

	.reader-color-swatches__custom-control {
		position: relative;
	}

	.reader-color-swatches__custom-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		clip-path: inset(50%);
		overflow: hidden;
		white-space: nowrap;
	}

	.reader-color-swatches__custom-input:focus-visible + span {
		outline: var(--sy-focus-width) solid var(--sy-focus-color);
		outline-offset: var(--sy-focus-offset);
	}

	.reader-color-swatches__custom-input:global(.sy-focus-visible) + span {
		outline: var(--sy-focus-width) solid var(--sy-focus-color);
		outline-offset: var(--sy-focus-offset);
	}
</style>
