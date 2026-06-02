<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		currentImage: string;
		targetImage: string;
		direction: 'next' | 'previous';
		durationMs: number;
		oncomplete?: () => void;
	}

	const {
		currentImage,
		targetImage,
		direction,
		durationMs,
		oncomplete = () => {},
	}: Props = $props();

	const duration = $derived(`${durationMs}ms`);
	const animationDirection = $derived(direction === 'next' ? 'normal' : 'reverse');
	const bottomImage = $derived(direction === 'next' ? targetImage : currentImage);
	const topImage = $derived(direction === 'next' ? currentImage : targetImage);

	let didComplete = false;
	let completionTimer: ReturnType<typeof setTimeout> | undefined;

	function fireCompletion(): void {
		if (didComplete) {
			return;
		}
		didComplete = true;
		oncomplete();
	}

	onMount(() => {
		completionTimer = setTimeout(fireCompletion, durationMs);
	});

	onDestroy(() => {
		if (completionTimer !== undefined) {
			clearTimeout(completionTimer);
			completionTimer = undefined;
		}
	});
</script>

<div
	class="page-flip"
	style:--page-flip-duration={duration}
	style:--page-flip-direction={animationDirection}
	style:--page-flip-bottom={`url("${bottomImage}")`}
	style:--page-flip-top={`url("${topImage}")`}
>
	<div class="page-flip__bottom"></div>
	<div class="page-flip__cut-shadow"></div>
	<div class="page-flip__static"></div>
	<div class="page-flip__curl">
		<div class="page-flip__curl-face page-flip__curl-face--front">
			<div class="page-flip__crease page-flip__crease--front"></div>
		</div>
		<div class="page-flip__curl-face page-flip__curl-face--back">
			<div class="page-flip__crease page-flip__crease--back"></div>
		</div>
	</div>
</div>

<style>
	.page-flip {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		background: var(--sy-color--white, #fff);
		perspective: 2400px;
		perspective-origin: 30% 50%;
		pointer-events: none;
	}

	.page-flip__bottom,
	.page-flip__static,
	.page-flip__curl,
	.page-flip__curl-face {
		position: absolute;
		inset: 0;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		background-position: center;
	}

	.page-flip__bottom {
		background-image: var(--page-flip-bottom);
	}

	.page-flip__static {
		background-image: var(--page-flip-top);
		animation-name: page-flip-static;
		animation-duration: var(--page-flip-duration);
		animation-timing-function: cubic-bezier(0.45, 0.05, 0.5, 0.95);
		animation-fill-mode: forwards;
		animation-direction: var(--page-flip-direction);
	}

	@keyframes page-flip-static {
		from {
			clip-path: inset(0 0 0 0);
		}
		to {
			clip-path: inset(0 100% 0 0);
		}
	}

	.page-flip__cut-shadow {
		position: absolute;
		top: -4%;
		bottom: -4%;
		width: clamp(30px, 5%, 56px);
		pointer-events: none;
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 32%) 0%,
			rgb(0 0 0 / 14%) 35%,
			transparent 100%
		);
		animation-name: page-flip-cut-shadow;
		animation-duration: var(--page-flip-duration);
		animation-timing-function: cubic-bezier(0.45, 0.05, 0.5, 0.95);
		animation-fill-mode: forwards;
		animation-direction: var(--page-flip-direction);
	}

	@keyframes page-flip-cut-shadow {
		from {
			left: 100%;
			opacity: 0;
		}
		15% {
			opacity: 0.85;
		}
		85% {
			opacity: 0.85;
		}
		to {
			left: 0%;
			opacity: 0;
		}
	}

	.page-flip__curl {
		transform-style: preserve-3d;
		will-change: transform;
		animation:
			page-flip-curl-rotate var(--page-flip-duration) cubic-bezier(0.3, 0.7, 0.4, 1) forwards,
			page-flip-curl-origin var(--page-flip-duration) cubic-bezier(0.45, 0.05, 0.5, 0.95)
				forwards;
		animation-direction: var(--page-flip-direction);
	}

	@keyframes page-flip-curl-rotate {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(-180deg);
		}
	}

	@keyframes page-flip-curl-origin {
		from {
			transform-origin: 100% 50%;
		}
		to {
			transform-origin: 0% 50%;
		}
	}

	.page-flip__curl-face {
		backface-visibility: hidden;
		animation-duration: var(--page-flip-duration);
		animation-timing-function: cubic-bezier(0.45, 0.05, 0.5, 0.95);
		animation-fill-mode: forwards;
		animation-direction: var(--page-flip-direction);
	}

	.page-flip__curl-face--front {
		background-image: var(--page-flip-top);
		animation-name: page-flip-face-front;
	}

	.page-flip__curl-face--back {
		background:
			radial-gradient(
				ellipse at 30% 50%,
				rgb(255 255 255 / 22%) 0%,
				rgb(0 0 0 / 4%) 60%,
				rgb(0 0 0 / 12%) 100%
			),
			var(--reader-page-background, var(--sy-color--white));
		transform: rotateY(180deg);
		animation-name: page-flip-face-back;
	}

	@keyframes page-flip-face-front {
		from {
			clip-path: inset(0 0 0 100%);
		}
		to {
			clip-path: inset(0 0 0 0%);
		}
	}

	@keyframes page-flip-face-back {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}

	.page-flip__crease {
		position: absolute;
		top: 0;
		bottom: 0;
		width: clamp(28px, 5%, 60px);
		pointer-events: none;
		animation-duration: var(--page-flip-duration);
		animation-timing-function: cubic-bezier(0.45, 0.05, 0.5, 0.95);
		animation-fill-mode: forwards;
		animation-direction: var(--page-flip-direction);
	}

	.page-flip__crease--front {
		background: linear-gradient(
			90deg,
			rgb(0 0 0 / 38%) 0%,
			rgb(0 0 0 / 16%) 30%,
			rgb(255 255 255 / 50%) 80%,
			transparent 100%
		);
		animation-name: page-flip-crease-front;
	}

	.page-flip__crease--back {
		background: linear-gradient(
			270deg,
			rgb(0 0 0 / 32%) 0%,
			rgb(0 0 0 / 12%) 30%,
			rgb(255 255 255 / 40%) 80%,
			transparent 100%
		);
		animation-name: page-flip-crease-back;
	}

	@keyframes page-flip-crease-front {
		from {
			left: 100%;
		}
		to {
			left: 0%;
		}
	}

	@keyframes page-flip-crease-back {
		from {
			right: 100%;
		}
		to {
			right: 0%;
		}
	}
</style>
