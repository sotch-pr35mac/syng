<script lang="ts">
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';

	interface Props {
		script?: CharacterScript;
		label?: string;
		description?: string;
		testId?: string;
		variant?: 'display' | 'inline';
	}

	const {
		script,
		label,
		description: providedDescription,
		testId,
		variant = 'display',
	}: Props = $props();
	const text = $derived(
		label ??
			(script === CHARACTER_SETS.SIMPLIFIED
				? '简'
				: script === CHARACTER_SETS.TRADITIONAL
					? '繁'
					: '')
	);
	const description = $derived(
		providedDescription ??
			(script === CHARACTER_SETS.SIMPLIFIED
				? 'Simplified Chinese'
				: script === CHARACTER_SETS.TRADITIONAL
					? 'Traditional Chinese'
					: undefined)
	);
</script>

<abbr
	class="character-set-label"
	class:character-set-label--inline={variant === 'inline'}
	title={description}
	aria-label={description ?? text}
	style="user-select: none; -webkit-user-select: none;"
	data-testid={testId ?? (script ? `character-set-label-${script}` : undefined)}>{text}</abbr
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
