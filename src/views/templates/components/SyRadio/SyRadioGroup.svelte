<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';

	interface Props {
		/** The value controlled by the group's native SyRadio inputs. */
		selectedValue: string;
		/** Labels containing SyRadio followed by their visible text. */
		children: Snippet;
		variant?: 'desktop' | 'mobile';
		class?: string;
	}

	/* eslint-disable prefer-const -- Svelte props must be declared with let to remain reactive. */
	let { selectedValue, children, variant = 'desktop', class: className }: Props = $props();
	/* eslint-enable prefer-const */
	let track = $state<HTMLDivElement>();
	let indicator = $state<HTMLSpanElement>();
	let reducedMotion: MediaQueryList | undefined;
	let position = 0;
	let velocity = 0;
	let target = 0;
	let shape = 0;
	let shapeVelocity = 0;
	let shapeKicked = false;
	let animationFrame = 0;
	let lastTime = 0;
	let pointerSelection = false;

	const positionStiffness = 410;
	const positionDamping = 35;
	const shapeStiffness = 180;
	const shapeDamping = 15;
	const shapeLimit = 0.07;
	const shapeHeightCompensation = 0.65;
	const millisecondsPerSecond = 1000;
	const targetFramesPerSecond = 60;
	const maximumFrameSeconds = 2 / targetFramesPerSecond;
	const initialFrameSeconds = 1 / targetFramesPerSecond;
	const impactDistance = 6;
	const impactImpulse = 0.85;
	const restingDistance = 0.2;
	const restingVelocity = 0.8;
	const restingShape = 0.002;
	const restingShapeVelocity = 0.02;

	function paint(): void {
		if (!indicator) {
			return;
		}
		const boundedShape = Math.max(-shapeLimit, Math.min(shapeLimit, shape));
		indicator.style.transform = `translate3d(${position}px, 0, 0) scale(${1 + boundedShape}, ${1 - boundedShape * shapeHeightCompensation})`;
	}

	function animate(time: number): void {
		const delta = lastTime
			? Math.min((time - lastTime) / millisecondsPerSecond, maximumFrameSeconds)
			: initialFrameSeconds;
		lastTime = time;
		velocity += (positionStiffness * (target - position) - positionDamping * velocity) * delta;
		position += velocity * delta;
		if (!shapeKicked && Math.abs(target - position) < impactDistance) {
			shapeVelocity += Math.sign(velocity) * impactImpulse;
			shapeKicked = true;
		}
		shapeVelocity += (-shapeStiffness * shape - shapeDamping * shapeVelocity) * delta;
		shape += shapeVelocity * delta;
		if (
			Math.abs(target - position) < restingDistance &&
			Math.abs(velocity) < restingVelocity &&
			Math.abs(shape) < restingShape &&
			Math.abs(shapeVelocity) < restingShapeVelocity
		) {
			position = target;
			velocity = 0;
			shape = 0;
			shapeVelocity = 0;
			animationFrame = 0;
			lastTime = 0;
		} else {
			animationFrame = requestAnimationFrame(animate);
		}
		paint();
	}

	function measure(snap: boolean): void {
		const checkedInput = track?.querySelector<HTMLInputElement>('input[type="radio"]:checked');
		const choice = checkedInput?.closest<HTMLLabelElement>('label');
		if (!choice || !indicator) {
			return;
		}
		target = choice.offsetLeft;
		indicator.style.width = `${choice.offsetWidth}px`;
		if (snap || reducedMotion?.matches || typeof requestAnimationFrame === 'undefined') {
			if (animationFrame && typeof cancelAnimationFrame !== 'undefined') {
				cancelAnimationFrame(animationFrame);
			}
			animationFrame = 0;
			lastTime = 0;
			position = target;
			velocity = 0;
			shape = 0;
			shapeVelocity = 0;
			paint();
		} else if (!animationFrame) {
			shapeKicked = false;
			animationFrame = requestAnimationFrame(animate);
		}
	}

	function pulseSelected(event: MouseEvent): void {
		if (
			!pointerSelection ||
			reducedMotion?.matches ||
			typeof requestAnimationFrame === 'undefined'
		) {
			return;
		}
		if (!(event.target instanceof HTMLInputElement)) {
			return;
		}
		if (event.target.value !== selectedValue || !event.target.checked) {
			return;
		}
		pointerSelection = false;
		shapeKicked = true;
		shapeVelocity += impactImpulse;
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(animate);
		}
	}

	function handlePointerDown(event: PointerEvent): void {
		const label =
			event.target instanceof Element
				? event.target.closest<HTMLLabelElement>('label')
				: null;
		const input = label?.querySelector<HTMLInputElement>('input[type="radio"]');
		pointerSelection = !!input && !input.disabled;
	}

	$effect(() => {
		const currentValue = selectedValue;
		if (!track || !indicator) {
			return undefined;
		}
		let cancelled = false;
		void tick().then(() => {
			if (!cancelled && currentValue === selectedValue) {
				measure(!pointerSelection);
				pointerSelection = false;
			}
			return undefined;
		});
		return () => {
			cancelled = true;
		};
	});

	onMount(() => {
		if (!track) {
			return undefined;
		}
		reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		const observer =
			typeof ResizeObserver === 'undefined'
				? undefined
				: new ResizeObserver(() => measure(true));
		const snap = () => measure(true);
		observer?.observe(track);
		reducedMotion?.addEventListener('change', snap);
		measure(true);
		return () => {
			observer?.disconnect();
			reducedMotion?.removeEventListener('change', snap);
			if (animationFrame && typeof cancelAnimationFrame !== 'undefined') {
				cancelAnimationFrame(animationFrame);
			}
		};
	});
</script>

<!-- The wrapper observes events from native radios; it is not an interactive target. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={track}
	class={['sy-radio-group', className]}
	class:sy-radio-group--mobile={variant === 'mobile'}
	onpointerdown={handlePointerDown}
	onpointercancel={() => (pointerSelection = false)}
	onkeydown={() => (pointerSelection = false)}
	onclick={pulseSelected}
>
	<span class="sy-radio-group__indicator" bind:this={indicator} aria-hidden="true"></span>
	{@render children()}
</div>

<style>
	.sy-radio-group {
		position: relative;
		box-sizing: border-box;
		display: flex;
		width: min(100%, 480px);
		max-width: 100%;
		padding: 3px;
		border: var(--sy-surface-border);
		border-radius: 15px;
		background: var(--sy-surface--well);
		box-shadow: var(--sy-inner-shadow);
	}
	.sy-radio-group__indicator {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 0;
		border-radius: 11px;
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
		pointer-events: none;
		transform-origin: center;
		will-change: transform;
	}
	.sy-radio-group :global(label) {
		position: relative;
		z-index: 1;
		display: flex;
		min-width: 0;
		flex: 1 1 0;
		cursor: pointer;
	}
	.sy-radio-group :global(label > input[type='radio']) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}
	.sy-radio-group :global(label > input[type='radio']::before) {
		display: none;
	}
	.sy-radio-group :global(label > span) {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 36px;
		padding: 4px 6px;
		border-radius: 11px;
		color: var(--sy-text--secondary);
		font: var(--sy-radio-choice-font, var(--sy-type--body));
		text-align: center;
	}
	.sy-radio-group :global(label > input[type='radio']:checked + span) {
		color: var(--sy-text--blue);
	}
	.sy-radio-group :global(label > input[type='radio']:focus-visible + span) {
		outline: 2px solid var(--sy-focus-color);
		outline-offset: -2px;
	}
	.sy-radio-group :global(label > input[type='radio']:disabled + span) {
		opacity: 0.5;
	}
	.sy-radio-group :global(label > input[type='radio']:disabled) {
		cursor: default;
	}
	.sy-radio-group--mobile :global(label > span) {
		min-height: var(--sy-mobile-touch-target);
		font: var(--sy-type--body-mobile);
	}
	@media (prefers-reduced-motion: reduce) {
		.sy-radio-group__indicator {
			will-change: auto;
		}
	}
	@media (forced-colors: active) {
		.sy-radio-group {
			gap: 8px;
			flex-wrap: wrap;
			padding: 0;
			border: 0;
			background: Canvas;
			box-shadow: none;
		}
		.sy-radio-group__indicator {
			display: none;
		}
		.sy-radio-group :global(label) {
			display: flex;
			align-items: center;
			flex: 0 1 auto;
		}
		.sy-radio-group :global(label > input[type='radio']) {
			position: static;
			width: 18px;
			height: 18px;
			opacity: 1;
			appearance: auto;
		}
		.sy-radio-group :global(label > span) {
			color: CanvasText;
		}
	}
</style>
