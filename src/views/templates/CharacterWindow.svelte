<script lang="ts">
	import { onMount } from 'svelte';
	import { Pause, Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';
	import { handleError } from '@/utils/error.js';
	import { createCharacterAnimation } from '@/composables/characterAnimation.svelte.js';

	type CharacterWindowWord = {
		simplified: string;
		traditional: string;
		initialScript?: CharacterScript;
	};

	const enableDrag = platform() === 'macos';
	const animation = createCharacterAnimation();
	let word: CharacterWindowWord | undefined;
	let activeScript = $state<CharacterScript>(CHARACTER_SETS.SIMPLIFIED);

	function switchScript(script: CharacterScript): void {
		activeScript = script;
		if (word) {
			void animation.load(word[activeScript]);
		}
	}

	onMount(() => {
		let disposed = false;
		const unlisteners: UnlistenFn[] = [];
		function register(subscription: Promise<UnlistenFn>): void {
			subscription
				.then((unlisten) => {
					if (disposed) {
						unlisten();
					} else {
						unlisteners.push(unlisten);
					}
					return undefined;
				})
				.catch((error) => {
					handleError('Error listening for character window changes.', error, {
						silent: true,
					});
				});
		}
		register(
			listen<CharacterWindowWord>('display-characters', (event) => {
				if (disposed) {
					return;
				}
				word = event.payload;
				if (word.initialScript) {
					activeScript = word.initialScript;
				}
				void animation.load(word[activeScript]);
			})
		);
		register(
			listen('character-window-hidden', () => {
				animation.stop();
				word = undefined;
			})
		);
		const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleColorSchemeChange = () => {
			if (word) {
				void animation.load(word[activeScript]);
			}
		};
		colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
		return () => {
			disposed = true;
			animation.stop();
			for (const unlisten of unlisteners) {
				unlisten();
			}
			colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
		};
	});
</script>

<div class="character-window-container">
	<div class="script-selector-container" data-tauri-drag-region={enableDrag ? true : undefined}>
		<SyButton
			style="ghost"
			size="large"
			onclick={() => switchScript(CHARACTER_SETS.SIMPLIFIED)}
		>
			<span class:script-selector--active={activeScript === CHARACTER_SETS.SIMPLIFIED}>
				Simplified
			</span>
		</SyButton>
		<SyButton
			style="ghost"
			size="large"
			onclick={() => switchScript(CHARACTER_SETS.TRADITIONAL)}
		>
			<span class:script-selector--active={activeScript === CHARACTER_SETS.TRADITIONAL}>
				Traditional
			</span>
		</SyButton>
	</div>
	<div class="character-window--content">
		{#if animation.characterNotFound}
			<div class="character-window--character-not-found--container">
				<h1>Character Data Not Found</h1>
				<p>
					The stroke order data cannot be found for at least one of the characters in this
					word.
				</p>
			</div>
		{:else}
			<div class="character-actions">
				<SyButton classes={['sy-tooltip--container']} onclick={animation.toggle}>
					<span class="animate-button--icon-container" data-testid="control-button">
						{#if !animation.active}
							<Play size="18" />
						{:else}
							<Pause size="18" />
						{/if}
					</span>
					<div class="sy-tooltip--body sy-tooltip--body-bottom">
						<p data-testid="tooltip-text">
							{#if animation.active}
								<!-- An animation is currently playing -->
								Pause
							{:else if animation.paused}
								<!-- No animation is playing, but a previous animation has been paused -->
								Resume
							{:else}
								<!-- No animation is playing and no animation is paused -->
								Play Stroke Order
							{/if}
						</p>
					</div>
				</SyButton>
			</div>
			<div class="character-container">
				<div id="character-target" data-testid="character-target"></div>
			</div>
		{/if}
	</div>
</div>

<style>
	.character-window-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.script-selector-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
	}
	.script-selector--active {
		text-decoration: underline;
		text-underline-position: under;
	}
	.character-window--content {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--sy-color--grey-2);
	}
	.character-window--character-not-found--container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 80%;
	}
	.character-actions {
		display: flex;
		justify-content: flex-end;
		margin: var(--sy-space--extra-large);
	}
	.animate-button--icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sy-space);
	}
	.character-container {
		display: flex;
		align-items: center;
		height: 65%;
	}
	#character-target {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 190%;
	}
</style>
