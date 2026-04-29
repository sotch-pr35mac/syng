<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Pause, Play } from 'lucide-svelte';

	interface Props {
		duration?: number;
		size?: number;
		autoStart?: boolean;
		progressColor?: string;
		oncomplete?: () => void;
	}

	const {
		duration = 10,
		size = 44,
		autoStart = false,
		progressColor = 'var(--sy-color--blue)',
		oncomplete = () => {},
	}: Props = $props();

	const STROKE_WIDTH = 4;
	const CENTER = 20;
	const RADIUS = 17;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const FRAME_INTERVAL_MS = 16;
	const MS_PER_SECOND = 1000;

	let progress = $state(0);
	let isPaused = $state(false);
	let intervalId: ReturnType<typeof setInterval> | undefined;
	let startTime = 0;
	let pausedTime = 0;
	let completed = false;

	const dashOffset = $derived(CIRCUMFERENCE * (1 - progress));
	const label = $derived(isPaused ? 'Resume timer' : 'Pause timer');

	export function pause(): void {
		if (isPaused || completed) {
			return;
		}
		isPaused = true;
		pausedTime = Date.now() - startTime;
		stopTimer();
	}

	export function resume(): void {
		if (!isPaused || completed) {
			return;
		}
		isPaused = false;
		startTime = Date.now() - pausedTime;
		startTimer();
	}

	function stopTimer(): void {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = undefined;
		}
	}

	function startTimer(): void {
		stopTimer();
		intervalId = setInterval(() => {
			const elapsed = Date.now() - startTime;
			progress = Math.min(elapsed / (duration * MS_PER_SECOND), 1);

			if (progress >= 1) {
				completed = true;
				stopTimer();
				oncomplete();
			}
		}, FRAME_INTERVAL_MS);
	}

	function toggle(event: MouseEvent | KeyboardEvent): void {
		event.stopPropagation();
		if ('key' in event && event.key !== 'Enter' && event.key !== ' ') {
			return;
		}
		if ('key' in event) {
			event.preventDefault();
		}
		if (isPaused) {
			resume();
		} else {
			pause();
		}
	}

	onMount(() => {
		if (autoStart) {
			startTime = Date.now();
			startTimer();
		}
	});

	onDestroy(stopTimer);
</script>

<button
	class="mobile-timer"
	style="width: {size}px; height: {size}px;"
	type="button"
	aria-label={label}
	onclick={toggle}
	onkeydown={toggle}
>
	<svg class="mobile-timer__ring" viewBox="0 0 40 40" aria-hidden="true">
		<circle
			class="mobile-timer__track"
			cx={CENTER}
			cy={CENTER}
			r={RADIUS}
			stroke-width={STROKE_WIDTH}
		/>
		<circle
			class="mobile-timer__progress"
			cx={CENTER}
			cy={CENTER}
			r={RADIUS}
			stroke-width={STROKE_WIDTH}
			stroke={progressColor}
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={dashOffset}
		/>
	</svg>
	<span class="mobile-timer__icon">
		{#if isPaused}
			<Play size="17" />
		{:else}
			<Pause size="17" />
		{/if}
	</span>
</button>

<style>
	.mobile-timer {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border-radius: 50%;
		background-color: var(--sy-color--white);
		color: var(--sy-color--grey-6);
		border: var(--sy-mobile-surface-border);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.mobile-timer:active {
		background-color: var(--sy-color--blue-1);
	}

	.mobile-timer:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 2px;
	}

	.mobile-timer__ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.mobile-timer__track,
	.mobile-timer__progress {
		fill: none;
	}

	.mobile-timer__track {
		stroke: var(--sy-color--grey-2);
	}

	.mobile-timer__progress {
		stroke-linecap: round;
		transition: stroke-dashoffset 80ms linear;
	}

	.mobile-timer__icon {
		position: relative;
		z-index: var(--sy-z-index--base);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
