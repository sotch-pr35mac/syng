<script lang="ts">
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import {
		LOADING_MESSAGES,
		MESSAGE_ROTATION_INTERVAL_MS,
		randomMessageIndex,
	} from '@/components/LoadingScreen/messages.js';

	type LoadingState = 'loading' | 'error';

	type Props = {
		title: string;
		detail?: string;
		secondaryDetail?: string;
		status?: LoadingState;
		messages?: readonly string[];
		actionLabel?: string;
		onaction?: () => void;
		testId?: string;
	};

	const {
		title,
		detail,
		secondaryDetail,
		status = 'loading',
		messages = LOADING_MESSAGES,
		actionLabel,
		onaction,
		testId = 'loading-screen',
	}: Props = $props();

	let messageIndex = $state(0);

	onMount(() => {
		messageIndex = randomMessageIndex(messages.length);
		let timer: number | undefined;
		if (messages.length >= 2) {
			timer = window.setInterval(() => {
				messageIndex = randomMessageIndex(messages.length, messageIndex);
			}, MESSAGE_ROTATION_INTERVAL_MS);
		}

		return () => {
			if (timer !== undefined) {
				window.clearInterval(timer);
			}
		};
	});
</script>

<div class="loading-screen" data-testid={testId}>
	<div class="loading-screen__content">
		<div class="loading-screen__brand" aria-hidden="true">Syng | 词应</div>

		<div
			class:loading-screen__status--error={status === 'error'}
			class="loading-screen__status"
			role={status === 'error' ? 'alert' : 'status'}
			aria-live={status === 'error' ? 'assertive' : 'polite'}
		>
			<h1>{title}</h1>
			{#if detail}<p>{detail}</p>{/if}
			{#if secondaryDetail}<p>{secondaryDetail}</p>{/if}
		</div>

		{#if messages.length > 0}
			<p class="loading-screen__message" aria-hidden="true">
				{messages[messageIndex]}
			</p>
		{/if}

		{#if actionLabel && onaction}
			<div class="loading-screen__controls">
				<SyButton size="large" onclick={onaction}>{actionLabel}</SyButton>
			</div>
		{/if}
	</div>
</div>

<style>
	.loading-screen {
		position: fixed;
		inset: 0;
		z-index: var(--sy-z-index--top);
		display: grid;
		place-items: center;
		box-sizing: border-box;
		padding: max(var(--sy-space--extra-large), env(safe-area-inset-top))
			var(--sy-space--extra-large)
			max(var(--sy-space--extra-large), env(safe-area-inset-bottom));
		background: linear-gradient(#ff8a00, #ef1063, #9d29ad);
		color: var(--sy-color--white);
		font-family: var(--sy-font-family);
		text-align: center;
	}

	.loading-screen__content {
		display: flex;
		width: min(100%, 480px);
		min-height: 420px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.loading-screen__brand {
		margin-bottom: var(--sy-space--extra-large);
		font-size: clamp(2.5rem, 10vw, 4rem);
		font-weight: var(--sy-font-weight--light);
		letter-spacing: -0.04em;
	}

	.loading-screen__status h1 {
		margin: 0;
		font-size: clamp(1.35rem, 5vw, 1.8rem);
		font-weight: var(--sy-font-weight--medium);
	}

	.loading-screen__status p {
		margin: var(--sy-space--large) 0 0;
		font-size: var(--sy-font-size--normal);
		line-height: 1.5;
	}

	.loading-screen__status--error {
		max-width: 420px;
		padding: var(--sy-space--extra-large);
		border: 1px solid rgb(255 255 255 / 45%);
		border-radius: var(--sy-border-radius);
		background: rgb(90 0 30 / 20%);
	}

	.loading-screen__message {
		min-height: 1.5em;
		margin: var(--sy-space--extra-large) 0 0;
		background: linear-gradient(
			100deg,
			rgb(255 255 255 / 62%) 20%,
			var(--sy-color--white) 50%,
			rgb(255 255 255 / 62%) 80%
		);
		-webkit-background-clip: text;
		background-clip: text;
		background-size: 200% 100%;
		color: transparent;
		font-size: var(--sy-font-size--normal);
		line-height: 1.5;
		animation: loading-shimmer 2.2s linear infinite;
	}

	.loading-screen__controls {
		margin-top: var(--sy-space--large);
	}

	@media (prefers-color-scheme: dark) {
		.loading-screen__message {
			background-image: linear-gradient(
				100deg,
				rgb(35 35 35 / 56%) 20%,
				rgb(35 35 35 / 78%) 50%,
				rgb(35 35 35 / 56%) 80%
			);
		}
	}

	@keyframes loading-shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-screen__message {
			background: none;
			color: var(--sy-color--white);
			animation: none;
		}
	}
</style>
