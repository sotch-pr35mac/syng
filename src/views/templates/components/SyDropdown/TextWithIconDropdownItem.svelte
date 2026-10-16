<script lang="ts">
	/* Icon Prop */

	/* Text Prop */

	/* Hover Prop */
	// Color of text and icon on hover
	// Defaults to blue
	// Possible Values:
	// 'blue'
	// 'green'

	/* Color Prop */
	// Color of the text and icon
	// Defaults to black
	// Possible Values:
	// 'blue'

	const {
		text = '',
		color = 'black',
		hover = 'blue',
		icon = undefined,
		disabled = false,
		onclick = () => {},
	}: {
		text?: string;
		color?: string;
		hover?: string;
		icon?: import('svelte').Component<any> | import('svelte').ComponentType;
		disabled?: boolean;
		onclick?: (_event: MouseEvent) => void;
	} = $props();

	const getClasses = () => {
		return [
			'twi-dropdown-item--container',
			`twi-dropdown-item--color--${color}`,
			`twi-dropdown-item--hover--${hover}`,
		].join(' ');
	};
	const handleClick = (event: MouseEvent) => {
		onclick(event);
	};

	const SvelteComponent = $derived(icon);
</script>

<button
	type="button"
	class={getClasses()}
	role="menuitem"
	tabindex="-1"
	{disabled}
	onclick={handleClick}
>
	{#if SvelteComponent}<SvelteComponent size="14" aria-hidden="true" />{/if}
	&nbsp;
	<span>{text}</span>
</button>

<style>
	.twi-dropdown-item--container {
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		min-width: 0;
		white-space: normal;
		display: flex;
		align-items: center;
		cursor: pointer;
		padding: var(--sy-space--large);
		transition: all ease-in-out;
		transition-duration: var(--sy-transition-duration) / 2;
	}
	.twi-dropdown-item--color--blue {
		color: var(--sy-text--blue);
	}
	.twi-dropdown-item--color--black {
		color: var(--sy-color--black);
	}
	.twi-dropdown-item--hover--blue:hover {
		color: var(--sy-text--blue);
	}
	.twi-dropdown-item--hover--green:hover {
		color: var(--sy-text--green);
	}
	.twi-dropdown-item--hover--red:hover {
		color: var(--sy-text--red);
	}
	.twi-dropdown-item--container:first-child,
	.twi-dropdown-item--container:last-child {
		border-radius: var(--sy-border-radius);
	}
	.twi-dropdown-item--container:hover {
		background-color: var(--sy-color--grey-2);
	}
</style>
