<script>
	/* Style Prop */
	/* Possible Values */
	// 'ghost' - No background or shadow
	// 'filled' - With background and shadow
	export let style = 'filled';

	/* Size Prop */
	/* Possible Values */
	// 'small' - Small button
	// 'medium' - Medium button
	// 'large' - Large button
	export let size = 'medium';

	/* Shape Prop */
	/* Possible Values */
	// 'rectangle' - Rectangular
	// 'circle' - Circular
	export let shape = 'rectangle';

	let getClasses = () => {
		return ['sy-button', 
			`sy-button--${style}`,
			`sy-button--${size}`,
			`sy-button--${shape}`].join(' ');
	}
</script>

<style>
.sy-button {
	margin: 0;
	padding: var(--sy-space);
	border: none;
	cursor: pointer;
	color: var(--sy-color--black);
	font-family: var(--sy-font-family);
}
.sy-button--filled {
	box-shadow: var(--sy-shadow);
}
.sy-button--ghost {
	
}
.sy-button--small {
	font-size: 10px;
}
.sy-button--medium {
	font-size: 13px;
}
.sy-button--large {
	font-size: 16px;
}
.sy-button--rectangle {
	border-radius: var(--sy-border-radius);
}
.sy-button--circle {
	border-radius: 50%;
}
</style>

<button class="{getClasses()}">
	<slot></slot>
</button>
