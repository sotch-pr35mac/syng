<script lang="ts">
	import { onMount } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { databaseMigrationStore, MIGRATION_STATUS } from '@/stores/databaseMigration.svelte.js';
	import {
		MIGRATION_MESSAGES,
		MESSAGE_ROTATION_INTERVAL_MS,
		randomMessageIndex,
	} from '@/components/DatabaseMigrationScreen/messages.js';

	let messageIndex = $state(randomMessageIndex(MIGRATION_MESSAGES.length));

	onMount(() => {
		const timer = window.setInterval(() => {
			messageIndex = randomMessageIndex(MIGRATION_MESSAGES.length, messageIndex);
		}, MESSAGE_ROTATION_INTERVAL_MS);

		return () => window.clearInterval(timer);
	});
</script>

<div class="migration-screen" data-testid="database-migration-screen">
	<div class="migration-screen__content">
		<div class="migration-screen__brand" aria-hidden="true">Syng | 词应</div>

		{#if databaseMigrationStore.status === MIGRATION_STATUS.RUNNING}
			<div
				class="migration-screen__loader"
				role="progressbar"
				aria-label="Bookmark update in progress"
			>
				<span></span>
				<span></span>
			</div>
			<div class="migration-screen__status" role="status" aria-live="polite">
				<h1>{databaseMigrationStore.title}</h1>
				<p>{databaseMigrationStore.detail}</p>
			</div>
		{:else}
			<div class="migration-screen__status migration-screen__status--error" role="alert">
				<h1>Bookmarks couldn’t be updated.</h1>
				<p>{databaseMigrationStore.errorMessage}</p>
				<p>Your bookmark lists and notes are safe. Quit and reopen Syng to try again.</p>
			</div>
		{/if}

		<p class="migration-screen__joke" aria-hidden="true">
			{MIGRATION_MESSAGES[messageIndex]}
		</p>

		{#if databaseMigrationStore.isPreview}
			<div class="migration-screen__preview-controls">
				<SyButton size="large" onclick={() => databaseMigrationStore.closePreview()}>
					Close preview
				</SyButton>
			</div>
		{/if}
	</div>
</div>

<style>
	.migration-screen {
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

	.migration-screen__content {
		display: flex;
		width: min(100%, 480px);
		min-height: 420px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.migration-screen__brand {
		margin-bottom: var(--sy-space--extra-large);
		font-size: clamp(2.5rem, 10vw, 4rem);
		font-weight: var(--sy-font-weight--light);
		letter-spacing: -0.04em;
	}

	.migration-screen__loader {
		position: relative;
		width: 112px;
		height: 112px;
		margin: var(--sy-space--extra-large) 0;
	}

	.migration-screen__loader span {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		border: 4px solid currentColor;
		border-radius: 50%;
		opacity: 0;
		animation: migration-ripple 3s ease-out infinite;
	}

	.migration-screen__loader span:last-child {
		animation-delay: 1.5s;
	}

	.migration-screen__status h1 {
		margin: 0;
		font-size: clamp(1.35rem, 5vw, 1.8rem);
		font-weight: var(--sy-font-weight--medium);
	}

	.migration-screen__status p {
		margin: var(--sy-space--large) 0 0;
		font-size: var(--sy-font-size--normal);
		line-height: 1.5;
	}

	.migration-screen__status--error {
		max-width: 420px;
		padding: var(--sy-space--extra-large);
		border: 1px solid rgb(255 255 255 / 45%);
		border-radius: var(--sy-border-radius);
		background: rgb(90 0 30 / 20%);
	}

	.migration-screen__joke {
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
		animation: migration-shimmer 2.2s linear infinite;
	}

	.migration-screen__preview-controls {
		margin-top: var(--sy-space--large);
	}

	@keyframes migration-ripple {
		0% {
			width: 0;
			height: 0;
			margin: 0;
			opacity: 0;
		}
		33% {
			width: 56px;
			height: 56px;
			margin: -28px 0 0 -28px;
			opacity: 1;
		}
		100% {
			width: 112px;
			height: 112px;
			margin: -56px 0 0 -56px;
			opacity: 0;
		}
	}

	@keyframes migration-shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.migration-screen__loader span {
			animation-duration: 6s;
		}

		.migration-screen__joke {
			background: none;
			color: var(--sy-color--white);
			animation: none;
		}
	}
</style>
