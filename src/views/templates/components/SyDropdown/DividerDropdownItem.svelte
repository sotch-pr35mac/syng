<script>
import { suppressUnusedExportLet } from '../../utils/';

// Suppress the unexpected prop warning
export let text = undefined;
export let icon = undefined;
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