<script>
	import { createEventDispatcher } from 'svelte';

	/* Style Prop */
	/* Possible Values */
	// 'ghost' - 'Invisible' text box
	// 'standard' - Standard text box styling
	export let style = 'standard';

	/* Size Prop */
	/* Possible Values */
	// 'small' - Small text field
	// 'medium' - Medium text field (Default Value)
	// 'large' - Large text field
	// 'extra-large' - Extra large text field
	export let size = 'medium';

	/* Placeholder Prop */
	export let placeholder = '';

	/* Type Prop */
	export let type = 'text';

	/* ID Prop */
	export let id;

	const dispatch = createEventDispatcher();
	const getClasses = () => {
		return ['sy-text-input',
			`sy-text-input--${style}`,
			`sy-text-input--${size}`].join(' ');
	};
</script>

<style>
.sy-text-input {
	border: none;
	padding: var(--sy-space--large) var(--sy-space);
	margin: var(--sy-space--small);
    background-color: var(--sy-color--white);
    color: var(--sy-color--black);
}
.sy-text-input::placeholder {
	color: var(--sy-color--grey-1);
}
.sy-text-input--standard {

}
.sy-text-input--ghost {
	height: 100%;
	display: flex;
	flex: 1;
}
.sy-text-input--ghost:focus {
	outline: none;
}
.sy-text-input--small {
	/* TODO */	
}
.sy-text-input--medium {
	/* TODO */
}
.sy-text-input--large {
	font-size: 16px;
}
.sy-text-input--extra-large {
	font-size: 18px;
}
</style>

<input placeholder="{placeholder}" type="{type}" class="{getClasses()}" id={id} on:change={ e => dispatch('change', e.srcElement.value) } on:keyup={ e => dispatch('keyup', e.srcElement.value) }/>
