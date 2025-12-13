<script>
import { fade, slide } from "svelte/transition";
import { CheckIcon, XIcon } from "svelte-feather-icons";
import SyTimer from "../SyTimer/SyTimer.svelte";

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
 * @property {any} timer - Timer component reference for external control (bindable)
 */

/** @type {Props} */
let {
  isCorrect = true,
  show = false,
  onComplete = () => {},
  chosenAnswer = "",
  timer = $bindable(),
} = $props();

const RESULT_DISPLAY_TIME = 10;
</script>

{#if show}
  <div class="result-container">
    <!-- Result badge with slide animation -->
    <div
      class="result-indicator"
      in:slide|global={{ duration: 250, axis: "x" }}
    >
      <div class="indicator-content">
        {#if isCorrect}
          <div class="icon-container" class:correct={isCorrect}>
            <CheckIcon size="20" />
          </div>
          <span class="text">Correct!</span>
        {:else}
          <span class="text answer-text">{chosenAnswer} |</span>
          <div class="icon-container" class:incorrect={!isCorrect}>
            <XIcon size="20" />
          </div>
          <span class="text">Incorrect</span>
        {/if}
      </div>
    </div>

    <!-- Timer with fade animation -->
    <div class="timer-wrapper" in:fade|global={{ duration: 250 }}>
      <SyTimer
        bind:this={timer}
        duration={RESULT_DISPLAY_TIME}
        size={32}
        autoStart={true}
        oncomplete={onComplete}
      />
    </div>
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
  flex-shrink: 0;
}
.indicator-content {
  display: flex;
  align-items: center;
  gap: var(--sy-space);
  white-space: nowrap;
  color: var(--sy-color--grey-dark);
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
  background-color: var(--sy-color--green);
  color: var(--sy-color--white);
}
.incorrect {
  background-color: var(--sy-color--red);
  color: var(--sy-color--white);
}
.text {
  font-size: 14px;
  font-family: var(--sy-font-family);
}
.answer-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.timer-wrapper {
  margin-left: var(--sy-space);
  flex-shrink: 0;
}
</style>
