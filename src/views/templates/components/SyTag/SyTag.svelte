<script lang="ts">
	interface Props {
		variant?: 'blue' | 'green' | 'yellow' | 'red';
		tooltip?: string;
		children?: import('svelte').Snippet;
	}
	const { variant = 'blue', tooltip, children }: Props = $props();
</script>

<span class="sy-tag sy-tag--{variant} sy-tooltip--container" title={tooltip}
	>{@render children?.()}{#if tooltip}<span class="sy-tooltip--body sy-tooltip--body-bottom"
			><p>{tooltip}</p></span
		>{/if}</span
>

<style>
	.sy-tag {
		display: inline-flex;
		align-items: center;
		padding: var(--sy-space--small) var(--sy-space--large);
		border-radius: var(--sy-border-radius);
		color: var(--sy-color--white);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
	}
	.sy-tag--blue {
		background: var(--sy-color--blue);
	}
	.sy-tag--green {
		background: var(--sy-color--green);
	}
	.sy-tag--yellow {
		background: var(--sy-color--yellow);
	}
	.sy-tag--red {
		background: var(--sy-color--red);
	}
</style>
