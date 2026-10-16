<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { isAndroid, isMobile } from '@/utils/device.js';
	import { cursorToEnd } from '@/actions/cursorToEnd.svelte.js';

	interface Props extends Omit<
		HTMLInputAttributes,
		'style' | 'size' | 'value' | 'onchange' | 'onkeyup' | 'oninput'
	> {
		style?: string;
		size?: string;
		value?: string;
		ariaDescribedby?: string;
		classes?: string[];
		onchange?: (value: string) => void;
		onkeyup?: (value: string) => void;
		oninput?: (value: string) => void;
		onenter?: (event: KeyboardEvent) => void;
	}

	type InputKeyboardEvent = KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement };
	type InputValueEvent = Event & {
		currentTarget: EventTarget & HTMLInputElement;
		isComposing?: boolean;
	};
	type InputCompositionEvent = CompositionEvent & {
		currentTarget: EventTarget & HTMLInputElement;
	};

	// Optimized for mobile: 16px minimum font size prevents iOS auto-zoom on focus.
	const mobile = isMobile();
	const android = isAndroid();

	const {
		style = 'standard',
		size = 'medium',
		placeholder = '',
		value = '',
		type = 'text',
		autocomplete = undefined,
		// Default to disabling autocorrect/autocapitalize so the keyboard stops
		// "correcting" pinyin into English. Exceptions (e.g. reader titles) opt back in.
		autocorrect = 'off',
		autocapitalize = 'off',
		inputmode = undefined,
		id,
		name = undefined,
		required = false,
		ariaDescribedby = undefined,
		'aria-describedby': nativeDescribedby = undefined,
		maxlength = undefined,
		spellcheck = false,
		classes = [],
		class: className,
		onchange = () => {},
		onkeyup = () => {},
		oninput = () => {},
		onenter = () => {},
		onkeydown,
		oncompositionstart,
		oncompositionend,
		...restProps
	}: Props = $props();
	const getClasses = () => {
		return classes
			.concat([
				'sy-text-input',
				`sy-text-input--${style}`,
				`sy-text-input--${size}`,
				mobile ? 'sy-text-input--mobile' : '',
			])
			.join(' ');
	};
	// An Input Method Editor (e.g. Chinese pinyin) uses Enter to confirm a candidate.
	// 229 is the legacy IME-processing key code, a fallback for composition event ordering
	// where isComposing alone is insufficient. Confirmation must not also select a result.
	const IME_KEY_CODE = 229;
	const ENTER_KEY_CODE = 13;
	let composing = false;
	let suppressCompositionEnter = false;
	const handleKeyup = (event: InputKeyboardEvent) => {
		if (composing || event.isComposing || event.keyCode === IME_KEY_CODE) {
			return;
		}
		if (event.key === 'Enter' || event.code === 'Enter' || event.keyCode === ENTER_KEY_CODE) {
			if (suppressCompositionEnter) {
				return;
			}
			if (android) {
				event.currentTarget.blur();
			}
			onenter(event);
		} else {
			onkeyup(event.currentTarget.value);
		}
	};
	const handleInput = (event: InputValueEvent) => {
		if (composing || event.isComposing) {
			return;
		}
		oninput(event.currentTarget.value);
	};
	const handleCompositionEnd = (event: InputCompositionEvent) => {
		composing = false;
		suppressCompositionEnter = true;
		oninput(event.currentTarget.value);
		oncompositionend?.(event);
	};
</script>

<input
	use:cursorToEnd
	{...restProps}
	{placeholder}
	{value}
	{type}
	{autocomplete}
	{autocorrect}
	{autocapitalize}
	{inputmode}
	class={[getClasses(), className]}
	{id}
	{name}
	{required}
	aria-describedby={nativeDescribedby ?? ariaDescribedby}
	{maxlength}
	{spellcheck}
	onchange={(event) => onchange(event.currentTarget.value)}
	oninput={handleInput}
	oncompositionstart={(event) => {
		composing = true;
		oncompositionstart?.(event);
	}}
	oncompositionend={handleCompositionEnd}
	onkeydown={(event) => {
		if (!composing && !event.isComposing) {
			suppressCompositionEnter = false;
		}
		onkeydown?.(event);
	}}
	onkeyup={handleKeyup}
/>

<style>
	.sy-text-input {
		border: none;
		padding: 0px;
		margin: calc(var(--sy-space--small) + var(--sy-space--large))
			calc(var(--sy-space--small) + var(--sy-space));
		background-color: var(--sy-color--white);
		color: var(--sy-color--black);
		font-size: 0.833333rem;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
	}
	.sy-text-input::placeholder {
		color: var(--sy-text--placeholder);
		opacity: 1;
	}
	.sy-text-input--standard {
		border-radius: var(--sy-border-radius);
		border: var(--sy-input--border);
		padding: var(--sy-space);
		box-shadow: var(--sy-inner-shadow);
	}
	.sy-text-input--ghost {
		height: 100%;
		display: flex;
		flex: 1;
	}
	/* Ghost fields are intentionally unbounded; retain their caret without a focus box. */
	.sy-text-input--ghost:focus,
	.sy-text-input--ghost:global(.sy-focus-visible) {
		outline: none;
	}
	.sy-text-input--large {
		font-size: 1rem;
	}
	.sy-text-input--extra-large {
		font-size: 1.125rem;
	}
	.sy-text-input--mobile {
		font-size: var(--sy-font-size--mobile-large);
		min-height: var(--sy-mobile-touch-target);
	}
	.sy-text-input--mobile.sy-text-input--standard {
		border: var(--sy-input--border-mobile);
		box-shadow: none;
	}
</style>
