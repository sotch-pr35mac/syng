<script>
/* Checked Prop */
/* Possible Values */
// true - The toggle is in the 'on' position

/* ID Prop */

/* Value Prop */

/**
 * @typedef {Object} Props
 * @property {boolean} [checked] - false - The toggle is in the 'off' position
 * @property {any} [id] - HTML ID for reference
 * @property {any} value - The value property for the HTML checkbox
 * @property {(checked: boolean) => void} [onchange] - Change handler
 */

/** @type {Props} */
const { checked = false, id = crypto.randomUUID(), value, onchange } = $props();
</script>

<span class="sy-toggle--container">
  <input
    type="checkbox"
    {id}
    class="sy-toggle"
    {value}
    {checked}
    onchange={(e) => onchange?.(e.target.checked)}
  />
  <label for={id} class="sy-toggle--label">Toggle</label>
</span>

<style>
.sy-toggle--container {
  display: flex;
}
.sy-toggle {
  height: 0;
  width: 0;
  visibility: hidden;
}
.sy-toggle:checked + .sy-toggle--label {
  background: var(--sy-color--blue);
}
.sy-toggle:checked + .sy-toggle--label:after {
  left: calc(100% - 1.5625px);
  transform: translateX(-100%);
}
.sy-toggle--label {
  cursor: pointer;
  text-indent: -9999px;
  width: 62.5px;
  height: 31.125px;
  border-radius: 31.125px;
  background: var(--sy-color--grey-4);
  display: block;
  position: relative;
}
.sy-toggle--label:after {
  content: "";
  position: absolute;
  top: 1.5625px;
  left: 1.5625px;
  width: 28.125px;
  height: 28.125px;
  border-radius: 28.125px;
  background: var(--sy-color--white);
  transition: var(--sy-transition-duration);
}
.sy-toggle--label:active:after {
  width: 40.625px;
}
</style>
