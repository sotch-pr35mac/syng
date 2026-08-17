<script lang="ts">
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';

	interface Props {
		script: CharacterScript;
		variant?: 'display' | 'inline';
	}

	const { script, variant = 'display' }: Props = $props();
	const text = $derived(script === CHARACTER_SETS.SIMPLIFIED ? '简' : '繁');
	const description = $derived(
		script === CHARACTER_SETS.SIMPLIFIED ? 'Simplified Chinese' : 'Traditional Chinese'
	);
</script>

<abbr
	class="character-set-label"
	class:character-set-label--inline={variant === 'inline'}
	title={description}
	aria-label={description}
	style="user-select: none; -webkit-user-select: none;"
	data-testid={`character-set-label-${script}`}>{text}</abbr
>

<style>
	.character-set-label {
		flex: none;
		margin-right: var(--sy-space);
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--character-set-label);
		font-weight: var(--sy-font-weight--normal);
		line-height: 1;
		text-decoration: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.character-set-label:not(.character-set-label--inline) {
		/* Match the visible bottoms of differently sized CJK glyphs, not their line boxes. */
		transform: translateY(0.2em);
	}
	.character-set-label--inline {
		margin-right: var(--sy-space--small);
		font-size: var(--sy-font-size--character-set-label-inline);
	}
</style>
