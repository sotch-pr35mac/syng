<script>
import SyTextInput from "../SyTextInput/SyTextInput.svelte";
import SyListPreviewItem from "./SyListPreviewItem.svelte";

const id = Math.floor(Math.random() * 100);

/**
 * @typedef {Object} Props
 * @property {any} [values] - Values Prop
 * @property {boolean} [highlight] - Highlight Prop
 * @property {boolean} [filterable] - Filterable Prop
 * @property {any} [component] - Suppress the unexpected prop warning
 * @property {(detail: any) => void} [onselection] - Selection callback
 * @property {(detail: any) => void} [onevent] - Event callback
 */

/** @type {Props} */
let {
  values = [],
  highlight = true,
  filterable = false,
  component: _component = undefined,
  onselection,
  onevent,
} = $props();

let activeIndex = $state();
let filteredValues = $state([]);

// Reset filtered values when values prop changes
$effect(() => {
  if (values) {
    filteredValues = values;

    // Reset the filter text field
    if (filterable) {
      const filterInput = document.getElementById(id);
      if (filterInput) {
        filterInput.value = "";
      }
    }
  }
});

const handleSelection = (event) => {
  activeIndex = event.detail;
  onselection?.({
    index: values.indexOf(filteredValues[activeIndex]),
    value: filteredValues[activeIndex],
  });
};
const handleFilter = (text) => {
  text = text.detail;
  filteredValues = values.filter((item) => {
    return (
      item.content.includes(text) ||
      item.headline.includes(text) ||
      item.subtitle.includes(text)
    );
  });
};
</script>

{#if filterable}
  <SyTextInput
    spellcheck={false}
    placeholder="Filter"
    size="large"
    {id}
    onkeyup={handleFilter}
  />
{/if}
{#each filteredValues as value, index}
  <SyListPreviewItem
    headline={value.headline}
    subtitle={value.subtitle}
    content={value.content}
    active={activeIndex === index}
    {index}
    {highlight}
    onclick={handleSelection}
    {onevent}
  />
{/each}
