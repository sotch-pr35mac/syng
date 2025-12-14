<script>
import DictionaryLink from './DictionaryLink.svelte';

/**
 * @typedef {Object} Props
 * @property {any} value - Required Value Prop
 * @property {(detail: any) => void} [onevent] - Optional callback when link event occurs
 */

/** @type {Props} */
const { value, onevent } = $props();

const pattern = /\s\S+\[(\S|\s\S)+.\]/g;
const findPattern = (text) => {
	const matches = text.match(pattern);
	return matches ? matches[0] : null;
};
const getCharactersFromMatch = (text) => {
	const characters = text.split('[')[0];
	const breakdown = characters.split('|');
	return {
		traditional: breakdown[0],
		simplified: breakdown[1] || breakdown[0],
	};
};
const getDisplayValue = (text) => {
	const characters = getCharactersFromMatch(text);
	return characters.traditional === characters.simplified
		? `${characters.traditional}`
		: `${characters.simplified} (${characters.traditional})`;
};
const getLink = (text) => {
	const characters = getCharactersFromMatch(text);
	return characters.traditional;
};
const handleOpenLink = (event) => onevent?.(event.detail);
</script>

<div class="dictionary-content--definition-item sy-text--selectable">
  {#if pattern.test(value)}
    {value.split(findPattern(value))}&nbsp;
    <DictionaryLink link={getLink(findPattern(value))} onopen={handleOpenLink}>
      {getDisplayValue(findPattern(value))}
    </DictionaryLink>
  {:else}
    {value}
  {/if}
</div>

<style>
.dictionary-content--definition-item {
  padding: var(--sy-space--large);
}
</style>
