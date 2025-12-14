<script>
/**
 * This component renders a divider in a dropdown menu.
 * It accepts but ignores text/icon props for compatibility with other dropdown items.
 */

// Accept and ignore props that other dropdown items use
const { text: _text = undefined, icon: _icon = undefined, ..._rest } = $props();
</script>

<hr class="sy-dropdown--divider" />

<style>
.sy-dropdown--divider {
  border: 0.5px solid var(--sy-color--grey-2);
  margin: var(--sy-space) 0px;
}
</style>
