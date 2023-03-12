<script>
import { createEventDispatcher } from 'svelte';
import { XIcon } from 'svelte-feather-icons';
import SyButton from '../SyButton/SyButton.svelte';

/* Visible Prop */
// Whether or not the modal is visible
export let visible = false;

/* Title Prop */
// The text to display in the modal header
export let title = '';

const dispatch = createEventDispatcher();
</script>

<style>
.sy-modal--active {
	display: block !important;
}
.sy-modal--container {
	display: none;
	position: absolute;
	top: 25vh;
	left: 60vh;
	transition: all ease var(--sy-transition-duration);
}
.sy-modal--backdrop {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: var(--sy-color--black--transparency);
	z-index: var(--sy-z-index--top-2);
}
.sy-modal--content {
	position: fixed;
	background-color: var(--sy-color--white);
	box-shadow: var(--sy-shadow--active);
	border-radius: var(--sy-border-radius);
	padding: var(--sy-space--large);
	z-index: var(--sy-z-index--top-1);
}
.sy-modal--header {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}
.sy-modal--title {
	margin: var(--sy-space) 0px;
}
.sy-modal--body {
	padding: var(--sy-space);
}
.sy-modal--footer {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-end;
}
</style>

<div class="sy-modal--container" class:sy-modal--active="{ visible }">
	<div class="sy-modal--content">
		<div class="sy-modal--header">
			<h2 class="sy-modal--title">{ title }</h2>
			<SyButton style="ghost" on:click="{ e => { dispatch('close', e); } }">
				<XIcon size="14" />
			</SyButton>
		</div>
		<div class="sy-modal--body">
			<slot name="body"></slot>
		</div>
		<div class="sy-modal--footer">
			<slot name="footer"></slot>
		</div>
	</div>
	<div class="sy-modal--backdrop"></div>
</div>