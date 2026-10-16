<script lang="ts">
	/* Text Prop */

	/* Color Prop */
	// Color of the text
	// Possible Values:

	/* Hover Prop */
	// Color of the text on hover
	// Possible Values:

	const {
		text = '',
		color = 'black',
		hover = 'blue',
		icon: _icon = undefined,
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
			'st-dropdown-item--container',
			`st-dropdown-item--color--${color}`,
			`st-dropdown-item--hover--${hover}`,
		].join(' ');
	};

	const handleClick = (event: MouseEvent) => {
		onclick(event);
	};
</script>

<button
	type="button"
	class={getClasses()}
	role="menuitem"
	tabindex="-1"
	{disabled}
	onclick={handleClick}
>
	{text}
</button>

<style>
	.st-dropdown-item--container {
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		min-width: 0;
		white-space: normal;
		cursor: pointer;
		padding: var(--sy-space--large);
		transition: all ease-in-out;
		transition-duration: var(--sy-transition-duration) / 2;
	}
	.st-dropdown-item--container:first-child,
	.st-dropdown-item--container:last-child {
		border-radius: var(--sy-border-radius);
	}
	.st-dropdown-item--container:hover {
		background-color: var(--sy-color--grey-2);
	}
	.st-dropdown-item--color--black {
		color: var(--sy-color--black);
	}
	.st-dropdown-item--hover--blue:hover {
		color: var(--sy-text--blue);
	}
</style>
