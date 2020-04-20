<script>
	/* Headline Prop */
	export let headline = '';
	
	/* Subtitle Prop */
	export let subtitle = '';

	/* Content Prop */
	export let content = '';

	/* Active Prop */
	export let active = false;

	const truncateContent = text => text.length > 25 ? `${ text.slice(0, 22) }...` : text ;
	const getClasses = () => {
		let classes = ['sy-list-preview-item-container'];

		if(active) {
			classes.push('sy-list-preview-item-container--active');
		}
	
		return classes.join(' ');
	};
</script>

<style>
.sy-list-preview-item-container {
	display: flex;
	margin: 0;
	padding: var(--sy-space--large) var(--sy-space);
	flex-direction: column;
	width: 100%;
	height: fit-content;
	cursor: pointer;
	color: var(--sy-color--grey-4);
}
.sy-list-preview-item-container--active {
	color: var(--sy-color--grey-3);
	background-color: var(--sy-color--grey-2);
	transition-property: background-color, color;
	transition-duration: var(--sy-transition-duration);
}
.sy-list-preview-item-container:hover {
	color: var(--sy-color--grey-4);
	background-color: var(--sy-color--grey-2);
	transition-property: background-color, color;
	transition-duration: var(--sy-transition-duration);
}
.sy-list-preview-item--text {
	margin: var(--sy-space--small);
}
.sy-list-preview-item--headline {
	font-size: 1em;
}
.sy-list-preview-item--subtitle {
	font-size: 0.8em;
}
.sy-list-preview-item--content {
	font-size: 0.8em;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}
</style>

<div class="{getClasses()}">
	<p class="sy-list-preview-item--text sy-list-preview-item--headline">{ headline }</p>
	<p class="sy-list-preview-item--text sy-list-preview-item--subtitle">{ subtitle }</p>
	<p class="sy-list-preview-item--text sy-list-preview-item--content">{ truncateContent(content) }</p>
</div>
