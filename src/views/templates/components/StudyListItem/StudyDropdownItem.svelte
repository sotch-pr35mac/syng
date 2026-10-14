<script lang="ts">
	const {
		text,
		description = '',
		disabled = false,
		onclick = () => {},
	} = $props<{
		text: string;
		description?: string;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
	}>();
</script>

<button class="study-dropdown-item" {disabled} {onclick}>
	{text}
	{#if description}<small>{description}</small>{/if}
</button>

<style>
	.study-dropdown-item {
		border: none;
		background: none;
		text-align: left;
		font: inherit;
		color: var(--sy-color--black);
		padding: var(--sy-space--large);
		cursor: pointer;
	}
	.study-dropdown-item:hover:not(:disabled) {
		background-color: var(--sy-color--grey-2);
		color: var(--sy-color--blue);
	}
	.study-dropdown-item:disabled {
		color: var(--sy-color--grey-5);
		cursor: default;
	}
	.study-dropdown-item small {
		display: block;
		max-width: 15rem;
		white-space: normal;
		font-size: var(--sy-font-size--small);
		margin-top: var(--sy-space);
	}
</style>
