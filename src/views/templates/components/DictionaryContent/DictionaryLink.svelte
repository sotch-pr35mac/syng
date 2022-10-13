<script>
import { createEventDispatcher } from 'svelte';

/* Required Link Prop */
export let link;

const dispatch = createEventDispatcher();
const openLink = () => dispatch('open', link);
</script>

<style>
.dictionary-link {
	cursor: pointer;
	color: var(--sy-color--blue);
}
.dictionary-link:hover {
	color: var(--sy-color--blue-2);
}
</style>

<a href="javascript:void(0)" class="dictionary-link" on:click={ () => openLink() } data-testid="dictionary-link">
	<slot></slot>
</a>
