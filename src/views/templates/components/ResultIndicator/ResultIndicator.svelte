<script>
	import { fade, slide } from 'svelte/transition';
	import { Check, X } from 'lucide-svelte';
	import SyTimer from '@/components/SyTimer/SyTimer.svelte';
	import { QUIZ_RESULT_DISPLAY_TIME } from '@/composables/study.js';

	/* Is Correct Prop */
	/* Possible Values */
	// true

	/* Show Prop */
	/* Possible Values */
	// true

	/* On Complete Prop */

	/* Chosen Answer Prop */

	/* Timer Prop */

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [isCorrect] - false
	 * @property {boolean} [show] - false
	 * @property {any} [onComplete] - Callback function when the timer completes
	 * @property {string} [chosenAnswer] - The answer that was chosen by the user
	 * @property {any} [timer] - Timer component reference for external control (bindable)
	 * @property {'x' | 'y'} [slideAxis] - Axis used for the slide transition
	 * @property {boolean} [timerVisible] - Render the built-in result countdown timer
	 * @property {boolean} [suspended] - Suspend the result countdown for instructions
	 */

	/* eslint-disable prefer-const -- timer uses $bindable() which requires let for the entire destructuring */
	/** @type {Props} */
	let {
		isCorrect = true,
		show = false,
		onComplete = () => {},
		chosenAnswer = '',
		timer = $bindable(),
		slideAxis = 'x',
		timerVisible = true,
		suspended = false,
	} = $props();
	/* eslint-enable prefer-const */

	/**
	 * @param {HTMLElement} node
	 * @param {import('svelte/transition').SlideParams} parameters
	 */
	function slideFeedback(node, parameters) {
		const transition = slide(node, parameters);
		if (parameters.axis !== 'x') {
			return transition;
		}

		// Keep the text layout steady while the outer box clips it. The width
		// returns to auto after the transition so long answers can still reflow.
		const contentWidth = getComputedStyle(node).width;
		return {
			...transition,
			css: (progress, inverse) =>
				`${transition.css(progress, inverse)}; --quiz-feedback-content-width: ${contentWidth};`,
		};
	}
</script>

{#if show}
	<div class="result-container">
		<!-- Result badge with slide animation -->
		<div
			class="result-indicator"
			in:slideFeedback|global={{ duration: 250, axis: slideAxis }}
			out:slideFeedback|global={{ duration: 250, axis: slideAxis }}
		>
			<div class="indicator-content">
				{#if isCorrect}
					<div class="icon-container" class:correct={isCorrect}>
						<Check size="20" aria-hidden="true" />
					</div>
					<span class="text">Correct!</span>
				{:else}
					<span class="text answer-text">{chosenAnswer} |</span>
					<div class="icon-container" class:incorrect={!isCorrect}>
						<X size="20" aria-hidden="true" />
					</div>
					<span class="text">Incorrect</span>
				{/if}
			</div>
		</div>

		<!-- Timer with fade animation -->
		{#if timerVisible}
			<div class="timer-wrapper" in:fade|global={{ duration: 250 }}>
				<!-- eslint-disable @typescript-eslint/no-magic-numbers -->
				<SyTimer
					{suspended}
					bind:this={timer}
					duration={QUIZ_RESULT_DISPLAY_TIME}
					size={32}
					autoStart={true}
					oncomplete={onComplete}
				/>
				<!-- eslint-enable no-magic-numbers -->
			</div>
		{/if}
	</div>
{/if}

<style>
	.result-container {
		display: flex;
		align-items: center;
		gap: var(--sy-space);
		height: 100%;
		overflow: hidden;
	}
	.result-indicator {
		position: relative;
		min-width: 0;
		flex-shrink: 1;
	}
	.indicator-content {
		display: flex;
		width: var(--quiz-feedback-content-width, auto);
		align-items: center;
		gap: var(--sy-space);
		flex-wrap: wrap;
		color: var(--sy-color--black);
	}
	.icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: calc(var(--sy-space) * 0.5);
		border-radius: var(--sy-border-radius);
	}
	.correct {
		background-color: var(--sy-fill--green);
		color: var(--sy-text--on-fill);
	}
	.incorrect {
		background-color: var(--sy-fill--red);
		color: var(--sy-text--on-fill);
	}
	.text {
		font-size: var(--sy-font-size--result-caption);
		font-family: var(--sy-font-family);
	}
	.answer-text {
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.timer-wrapper {
		margin-left: var(--sy-space);
		flex-shrink: 0;
	}
</style>
