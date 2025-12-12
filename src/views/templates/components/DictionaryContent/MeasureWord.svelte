<script>
import DictionaryLink from "./DictionaryLink.svelte";

/**
 * @typedef {Object} Props
 * @property {any} value - Required Measure Word Prop
 * @property {(detail: any) => void} [onevent] - Event callback
 */

/** @type {Props} */
let { value, onevent } = $props();

const handleOpenLink = (event) => onevent?.(event.detail);
</script>

<div class="dictionary-content--mw sy-text--selectable">
  <DictionaryLink link={value.traditional} onopen={handleOpenLink}>
    {value.simplified}
    {#if value.simplified != value.traditional}
      &nbsp;({value.traditional})
    {/if}
  </DictionaryLink>
</div>

<style>
.dictionary-content--mw {
  padding: var(--sy-space--large);
}
</style>
