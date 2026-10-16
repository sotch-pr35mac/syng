<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronLeft, Pause, Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import { createCharacterAnimation } from '@/composables/characterAnimation.svelte.js';
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';

	const animation = createCharacterAnimation();
	let activeScript = $state<CharacterScript>(
		mobileCharacterWindowWordStore.initialScript ?? CHARACTER_SETS.SIMPLIFIED
	);
	const word = $derived(mobileCharacterWindowWordStore.value);
	const characters = $derived(word?.[activeScript] ?? '');

	function switchScript(script: CharacterScript): void {
		activeScript = script;
	}

	function handleSwipeBack(): void {
		// Users reach /characters from Search via a hash push, so history.back() is the
		// normal path. Fall back to the Search route if the screen was cold-loaded and
		// there's nothing to go back to.
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.hash = '#/';
		}
	}

	$effect(() => {
		void animation.load(characters);
	});

	onMount(() => {
		const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		function handleColorSchemeChange() {
			void animation.load(characters);
		}
		colorSchemeQuery.addEventListener('change', handleColorSchemeChange);

		return () => {
			animation.stop();
			colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
		};
	});
</script>

<div class="mobile-characters" use:swipeBack={{ onBack: handleSwipeBack }}>
	<div class="mobile-characters__header" class:mobile-characters__header--ipad={isIPad()}>
		<div class="mobile-characters__nav">
			<SyButton
				style="ghost"
				shape="circle"
				center={true}
				classes={['mobile-characters__icon-button']}
				onclick={handleSwipeBack}
			>
				<ChevronLeft size="22" />
				<span class="mobile-characters__button-label">Back</span>
			</SyButton>
		</div>

		<div class="mobile-characters__script-selector">
			<SyButton
				style="ghost"
				size="large"
				onclick={() => switchScript(CHARACTER_SETS.SIMPLIFIED)}
				aria-pressed={activeScript === CHARACTER_SETS.SIMPLIFIED}
			>
				<span class:script-selector--active={activeScript === CHARACTER_SETS.SIMPLIFIED}
					>Simplified</span
				>
			</SyButton>
			<SyButton
				style="ghost"
				size="large"
				onclick={() => switchScript(CHARACTER_SETS.TRADITIONAL)}
				aria-pressed={activeScript === CHARACTER_SETS.TRADITIONAL}
			>
				<span class:script-selector--active={activeScript === CHARACTER_SETS.TRADITIONAL}
					>Traditional</span
				>
			</SyButton>
		</div>

		<div class="mobile-characters__controls">
			{#if word && !animation.characterNotFound}
				<SyButton
					shape="circle"
					center={true}
					classes={['mobile-characters__icon-button', 'sy-tooltip--container']}
					onclick={animation.toggle}
					aria-label={animation.active
						? 'Pause stroke order'
						: animation.paused
							? 'Resume stroke order'
							: 'Play stroke order'}
				>
					<span class="animate-button--icon-container" data-testid="control-button">
						{#if !animation.active}
							<Play size="18" aria-hidden="true" />
						{:else}
							<Pause size="18" aria-hidden="true" />
						{/if}
					</span>
					<div class="sy-tooltip--body sy-tooltip--body-bottom" aria-hidden="true">
						<p data-testid="tooltip-text">
							{#if animation.active}
								Pause
							{:else if animation.paused}
								Resume
							{:else}
								Play Stroke Order
							{/if}
						</p>
					</div>
				</SyButton>
			{/if}
		</div>
	</div>

	<div class="mobile-characters__content">
		{#if !word}
			<div class="mobile-characters__empty">
				<p>Select a word from Search to view stroke order</p>
			</div>
		{:else if animation.characterNotFound}
			<div class="mobile-characters__not-found">
				<h1>Character Data Not Found</h1>
				<p>
					The stroke order data cannot be found for at least one of the characters in this
					word.
				</p>
			</div>
		{:else}
			<div class="mobile-characters__character-container">
				<div id="character-target" data-testid="character-target"></div>
			</div>
		{/if}
	</div>
</div>

<style>
	.mobile-characters {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-characters__header {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) 56px;
		align-items: center;
		padding: var(--sy-space) var(--sy-space--large);
		background-color: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
		flex-shrink: 0;
	}

	.mobile-characters__header--ipad {
		padding-top: max(var(--sy-space), env(safe-area-inset-top, 0px));
	}

	.mobile-characters__nav {
		display: flex;
		align-items: center;
		justify-self: start;
	}

	.mobile-characters__script-selector {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		min-width: 0;
	}

	.script-selector--active {
		text-decoration: underline;
		text-underline-position: under;
	}

	.mobile-characters__controls {
		display: flex;
		align-items: center;
		justify-self: end;
		min-width: var(--sy-mobile-touch-target);
	}

	.animate-button--icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sy-space);
	}

	:global(.mobile-characters__icon-button) {
		margin: 0;
		width: var(--sy-mobile-touch-target);
		height: var(--sy-mobile-touch-target);
		padding: 0;
	}

	.mobile-characters__button-label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.mobile-characters__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.mobile-characters__empty,
	.mobile-characters__not-found {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: 100%;
		text-align: center;
		padding: var(--sy-space--large);
		color: var(--sy-text--muted);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.mobile-characters__not-found h1 {
		font-size: var(--sy-font-size--mobile-extra-large);
		margin-bottom: var(--sy-space);
	}

	.mobile-characters__character-container {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: 100%;
		padding: var(--sy-space--large);
	}

	#character-target {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		min-width: 0;
		max-width: 100%;
	}

	#character-target :global(svg) {
		max-width: 100%;
		height: auto;
	}
</style>
