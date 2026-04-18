<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [headline] - Headline Prop
	 * @property {string} [subtitle] - Subtitle Prop
	 * @property {string} [content] - Content Prop
	 * @property {any} index - Index Prop
	 * @property {boolean} [active] - Active Prop
	 * @property {any} highlight - Highlight Prop
	 * @property {(detail: any) => void} [onclick] - Click callback
	 * @property {(detail: any) => void} [onevent] - Event callback
	 */

	/** @type {Props} */
	import { isMobile } from '../../utils/device.js';

	// Optimized for mobile: larger touch targets and row height.
	const mobile = isMobile();

	const {
		headline = '',
		subtitle = '',
		content = '',
		index,
		active = false,
		highlight,
		onclick,
		onevent: _onevent,
	} = $props();
	const ENTER_KEY_CODE = 13;
	const MAX_CONTENT_LENGTH = 25;
	const MAX_TRUNCATION_LENGTH = 22;

	const truncateContent = (text = '') =>
		text.length > MAX_CONTENT_LENGTH ? `${text.slice(0, MAX_TRUNCATION_LENGTH)}...` : text;
	const getClasses = () =>
		[
			'sy-list-preview-item-container',
			mobile ? 'sy-list-preview-item-container--mobile' : '',
		].join(' ');
	const handleKeyup = (e) => {
		if (e.key === 'Enter' || e.keyCode === ENTER_KEY_CODE) {
			onclick?.({ detail: index });
		}
	};
	const handleClick = () => onclick?.({ detail: index });
</script>

<div
	class:sy-list-preview-item-container--active={active && highlight}
	class={getClasses()}
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeyup={handleKeyup}
>
	{#if mobile}
		<p class="sy-list-preview-item--text sy-list-preview-item--topline">
			<span class="sy-list-preview-item--headline">{headline}</span>
			{#if subtitle}
				<span class="sy-list-preview-item--subtitle">{subtitle}</span>
			{/if}
		</p>
		<p class="sy-list-preview-item--text sy-list-preview-item--content">
			{truncateContent(content)}
		</p>
	{:else}
		<p class="sy-list-preview-item--text sy-list-preview-item--headline">
			{headline}
		</p>
		<p class="sy-list-preview-item--text sy-list-preview-item--subtitle">
			{subtitle}
		</p>
		<p class="sy-list-preview-item--text sy-list-preview-item--content">
			{truncateContent(content)}
		</p>
	{/if}
</div>

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
	.sy-list-preview-item-container--mobile {
		box-sizing: border-box;
		min-height: var(--sy-mobile-list-item-min-height);
		padding: calc(var(--sy-mobile-space--small) * 3) var(--sy-mobile-space--large);
		justify-content: center;
		color: var(--sy-color--black);
		background-color: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
	}
	.sy-list-preview-item-container--mobile:last-child {
		border-bottom: none;
	}
	.sy-list-preview-item-container--mobile:hover {
		color: var(--sy-color--black);
		background-color: var(--sy-color--white);
	}
	.sy-list-preview-item-container--mobile:active {
		background-color: var(--sy-mobile-state-pressed);
	}
	.sy-list-preview-item-container--mobile.sy-list-preview-item-container--active {
		color: var(--sy-color--black);
		background-color: var(--sy-mobile-state-pressed);
	}
	.sy-list-preview-item-container--mobile .sy-list-preview-item--text {
		margin: 0;
	}
	.sy-list-preview-item-container--mobile .sy-list-preview-item--topline {
		display: flex;
		align-items: baseline;
		gap: var(--sy-mobile-space--medium);
		min-width: 0;
	}
	.sy-list-preview-item-container--mobile .sy-list-preview-item--headline {
		flex: 0 1 auto;
		min-width: 0;
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--mobile-extra-large);
		font-weight: var(--sy-font-weight--medium);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sy-list-preview-item-container--mobile .sy-list-preview-item--subtitle {
		flex: 1 1 auto;
		min-width: 0;
		color: var(--sy-color--grey-3);
		font-size: var(--sy-font-size--mobile-small);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sy-list-preview-item-container--mobile .sy-list-preview-item--content {
		margin-top: var(--sy-mobile-space--extra-small);
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--mobile-small);
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
