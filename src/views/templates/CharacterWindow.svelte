<script>
import HanziWriter from 'hanzi-writer';
import { tick } from 'svelte';
import { PauseIcon, PlayIcon } from 'svelte-feather-icons';
import SyButton from './components/SyButton/SyButton.svelte';
import { platform } from '@tauri-apps/plugin-os';

// Constants
const LIGHT_MODE_TEXT_COLOR = '#474C5A';
const LIGHT_MODE_OUTLINE_COLOR = '#DDDDDD';
const DARK_MODE_TEXT_COLOR = '#FFFFFF';
const DARK_MODE_OUTLINE_COLOR = '#999999';
const CHARACTER_SIZE = 200;
const CHARACTER_PADDING = 5;

// Variables
let enableDrag = platform() === 'macos';
let word;
let activeCharacters = [];
let activeScript = 'simplified';
let activeAnimation = false;
let pausedAnimation = false;
let currentlyAnimating; // The index of the character currently being animated
let characterWriter;
let characterNotFound = false;

// Functions
const inDarkMode = () =>
	window.matchMedia('(prefers-color-scheme: dark)').matches;
const switchScript = (script) => {
	activeScript = script;
	activeAnimation = false;
	pausedAnimation = false;
	loadAllCharacters(word[activeScript]);
};
const loadCharacter = (character) => {
	characterWriter = HanziWriter.create('character-target', character, {
		width: CHARACTER_SIZE,
		height: CHARACTER_SIZE,
		padding: CHARACTER_PADDING,
		strokeColor: inDarkMode() ? DARK_MODE_TEXT_COLOR : LIGHT_MODE_TEXT_COLOR,
		outlineColor: inDarkMode()
			? DARK_MODE_OUTLINE_COLOR
			: LIGHT_MODE_OUTLINE_COLOR,
		charDataLoader: (char, onComplete) => {
			fetch(`resources/hanzi-writer-data/data/${char}.json`)
				.then((file) => file.json())
				.then((data) => {
					onComplete(data);
				})
				.catch((error) => {
					characterNotFound = true;
					console.log(error);
				});
		},
	});
	activeCharacters.push(characterWriter);
};
const loadAllCharacters = (characters) => {
	characterNotFound = false;
	// Wait for the DOM to finish updating from the change from the line above before proceeding
	tick().then(() => {
		const target = document.getElementById('character-target');
		if (target) {
			target.innerHTML = '';
		}
		activeCharacters = [];
		for (let i = 0; i < characters.length; i++) {
			loadCharacter(characters[i]);
		}
	});
};
const animateCharacter = (index, is_initial_call) => {
	if (is_initial_call) {
		activeAnimation = true;
		for (let i = 0; i < activeCharacters.length; i++) {
			activeCharacters[i].hideCharacter();
		}
	}
	if (index >= 0 && index < activeCharacters.length) {
		currentlyAnimating = index;
		activeCharacters[index].animateCharacter({
			onComplete: () => animateCharacter(index + 1, false),
		});
	} else {
		activeAnimation = false;
		pausedAnimation = false;
	}
};
const handleControlButtonClick = () => {
	if (activeAnimation) {
		// Pause the animation
		pausedAnimation = true;
		activeAnimation = false;
		activeCharacters[currentlyAnimating].pauseAnimation();
	} else if (pausedAnimation) {
		// Resume a previosly playing animation
		pausedAnimation = false;
		activeAnimation = true;
		activeCharacters[currentlyAnimating].resumeAnimation();
	} else {
		// Start the animation
		animateCharacter(0, true);
	}
};

// Event Listeners
window.__TAURI__.event.listen('display-characters', (requestedWord) => {
	word = requestedWord.payload;
	loadAllCharacters(word[activeScript]);
});
window
	.matchMedia('(prefers-color-scheme: dark)')
// eslint-disable-next-line no-unused-vars
	.addEventListener('change', (e) => {
		loadAllCharacters(word[activeScript]);
	});
</script>

<div class="character-window-container">
  <div
    class="script-selector-container"
    data-tauri-drag-region={enableDrag ? true : undefined}
  >
    <SyButton
      style="ghost"
      size="large"
      on:click={() => switchScript('simplified')}
    >
      <span class:script-selector--active={activeScript == 'simplified'}>
        Simplified
      </span>
    </SyButton>
    <SyButton
      style="ghost"
      size="large"
      on:click={() => switchScript('traditional')}
    >
      <span class:script-selector--active={activeScript == 'traditional'}>
        Traditional
      </span>
    </SyButton>
  </div>
  <div class="character-window--content">
    {#if characterNotFound}
      <div class="character-window--character-not-found--container">
        <h1>Character Data Not Found</h1>
        <p>
          The stroke order data cannot be found for at least one of the
          characters in this word.
        </p>
      </div>
    {:else}
      <div class="character-actions">
        <SyButton
          classes={['sy-tooltip--container']}
          on:click={() => handleControlButtonClick()}
        >
          <span
            class="animate-button--icon-container"
            data-testid="control-button"
          >
            {#if !activeAnimation}
              <PlayIcon size="18" />
            {:else}
              <PauseIcon size="18" />
            {/if}
          </span>
          <div class="sy-tooltip--body sy-tooltip--body-bottom">
            <p data-testid="tooltip-text">
              {#if activeAnimation}
                <!-- An animation is currently playing -->
                Pause
              {:else if pausedAnimation}
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
