<script lang="ts">
	import { onMount, tick } from 'svelte';
	import HanziWriter from 'hanzi-writer';
	import { ChevronLeft, Pause, Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import { handleError } from '@/utils/error.js';

	const LIGHT_MODE_TEXT_COLOR = '#474C5A';
	const LIGHT_MODE_OUTLINE_COLOR = '#DDDDDD';
	const DARK_MODE_TEXT_COLOR = '#FFFFFF';
	const DARK_MODE_OUTLINE_COLOR = '#999999';
	const CHARACTER_SIZE = 200;
	const CHARACTER_PADDING = 5;

	let activeScript = $state<'simplified' | 'traditional'>('simplified');
	let activeAnimation = $state(false);
	let pausedAnimation = $state(false);
	let currentlyAnimating = 0;
	let characterWriters: HanziWriter[] = [];
	let characterNotFound = $state(false);

	const word = $derived(mobileCharacterWindowWordStore.value);
	const characters = $derived(
		word ? (activeScript === 'simplified' ? word.simplified : word.traditional).split('') : []
	);

	const inDarkMode = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

	function loadCharacter(character: string): void {
		const writer = HanziWriter.create('character-target', character, {
			width: CHARACTER_SIZE,
			height: CHARACTER_SIZE,
			padding: CHARACTER_PADDING,
			strokeColor: inDarkMode() ? DARK_MODE_TEXT_COLOR : LIGHT_MODE_TEXT_COLOR,
			outlineColor: inDarkMode() ? DARK_MODE_OUTLINE_COLOR : LIGHT_MODE_OUTLINE_COLOR,
			charDataLoader: (char, onComplete) => {
				fetch(`resources/hanzi-writer-data/data/${char}.json`)
					.then((file) => file.json())
					.then((data) => {
						onComplete(data);
						return undefined;
					})
					.catch((error) => {
						characterNotFound = true;
						console.log(error);
					});
			},
		});
		characterWriters.push(writer);
	}

	function loadAllCharacters(chars: string[]): void {
		characterNotFound = false;
		activeAnimation = false;
		pausedAnimation = false;
		tick()
			.then(() => {
				const target = document.getElementById('character-target');
				if (target) {
					target.innerHTML = '';
				}
				characterWriters = [];
				for (const char of chars) {
					loadCharacter(char);
				}
				return undefined;
			})
			.catch((error) => {
				handleError('Error loading characters.', error, { silent: true });
			});
	}

	function animateCharacter(index: number, isInitialCall: boolean): void {
		if (isInitialCall) {
			activeAnimation = true;
			for (const writer of characterWriters) {
				writer.hideCharacter();
			}
		}
		if (index >= 0 && index < characterWriters.length) {
			currentlyAnimating = index;
			characterWriters[index].animateCharacter({
				onComplete: () => animateCharacter(index + 1, false),
			});
		} else {
			activeAnimation = false;
			pausedAnimation = false;
		}
	}

	function handleControlButtonClick(): void {
		if (activeAnimation) {
			pausedAnimation = true;
			activeAnimation = false;
			characterWriters[currentlyAnimating].pauseAnimation();
		} else if (pausedAnimation) {
			pausedAnimation = false;
			activeAnimation = true;
			characterWriters[currentlyAnimating].resumeAnimation();
		} else {
			animateCharacter(0, true);
		}
	}

	function switchScript(script: 'simplified' | 'traditional'): void {
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
		loadAllCharacters(characters);
	});

	onMount(() => {
		const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		function handleColorSchemeChange() {
			loadAllCharacters(characters);
		}
		colorSchemeQuery.addEventListener('change', handleColorSchemeChange);

		return () => {
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
			<SyButton style="ghost" size="large" onclick={() => switchScript('simplified')}>
				<span class:script-selector--active={activeScript === 'simplified'}>Simplified</span
				>
			</SyButton>
			<SyButton style="ghost" size="large" onclick={() => switchScript('traditional')}>
				<span class:script-selector--active={activeScript === 'traditional'}
					>Traditional</span
				>
			</SyButton>
		</div>

		<div class="mobile-characters__controls">
			{#if word && !characterNotFound}
				<SyButton
					shape="circle"
					center={true}
					classes={['mobile-characters__icon-button', 'sy-tooltip--container']}
					onclick={handleControlButtonClick}
				>
					<span class="animate-button--icon-container" data-testid="control-button">
						{#if !activeAnimation}
							<Play size="18" />
						{:else}
							<Pause size="18" />
						{/if}
					</span>
					<div class="sy-tooltip--body sy-tooltip--body-bottom">
						<p data-testid="tooltip-text">
							{#if activeAnimation}
								Pause
							{:else if pausedAnimation}
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
		{:else if characterNotFound}
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
		padding-top: env(safe-area-inset-top, 0px);
	}

	.mobile-characters__nav {
		display: flex;
		align-items: center;
		justify-self: start;
	}

	.mobile-characters__script-selector {
		display: flex;
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
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.mobile-characters__empty,
	.mobile-characters__not-found {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--sy-space--large);
		color: var(--sy-color--grey-4);
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
		height: 100%;
	}

	#character-target {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
