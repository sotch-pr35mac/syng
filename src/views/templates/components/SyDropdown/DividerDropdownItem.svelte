<script>
import { suppressUnusedExportLet } from '../../utils/';


	/**
	 * @typedef {Object} Props
	 * @property {any} [text] - Suppress the unexpected prop warning
	 * @property {any} [icon]
	 */

	/** @type {Props} */
	let { text = undefined, icon = undefined } = $props();
suppressUnusedExportLet(text);
suppressUnusedExportLet(icon);
</script>

<style>
.sy-dropdown--divider {
	border: 0.5px solid var(--sy-color--grey-2);  
	margin: var(--sy-space) 0px;
}
</style>

<hr class="sy-dropdown--divider" />