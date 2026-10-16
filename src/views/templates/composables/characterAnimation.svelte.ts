import HanziWriter from 'hanzi-writer';
import { tick } from 'svelte';
import { handleError } from '@/utils/error.js';

/** Owns one word's writers and playback callbacks for desktop and mobile. */
export function createCharacterAnimation() {
	let writers: HanziWriter[] = [];
	let generation = 0;
	let playback = 0;
	let currentlyAnimating = 0;
	let loadingController: AbortController | undefined;
	let active = $state(false);
	let paused = $state(false);
	let characterNotFound = $state(false);

	function stop(): void {
		// Invalidate callbacks before canceling: HanziWriter calls onComplete even
		// when another mutation cancels an animation.
		generation += 1;
		playback += 1;
		active = false;
		paused = false;
		currentlyAnimating = 0;
		loadingController?.abort();
		loadingController = undefined;
		for (const writer of writers) {
			// A zero-duration hide cancels the main-character animation, including
			// paused mutations, without leaving an animation running offscreen.
			try {
				void Promise.resolve(writer.hideCharacter({ duration: 0 })).catch(() => {});
			} catch {
				// A writer whose data failed to load throws synchronously here. It has
				// no animation to cancel; still clean up the remaining writers and
				// allow the caller to show the missing-data state.
			}
		}
		writers = [];
	}

	async function load(characters: string): Promise<void> {
		stop();
		characterNotFound = false;
		const currentGeneration = generation;
		const controller = new AbortController();
		loadingController = controller;
		await tick();
		if (currentGeneration !== generation) {
			return;
		}
		const target = document.getElementById('character-target');
		if (!target) {
			return;
		}
		target.replaceChildren();
		const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		try {
			for (const character of characters) {
				writers.push(
					HanziWriter.create('character-target', character, {
						width: 200,
						height: 200,
						padding: 5,
						strokeColor: darkMode ? '#FFFFFF' : '#474C5A',
						outlineColor: darkMode ? '#999999' : '#DDDDDD',
						charDataLoader: async (requestedCharacter) => {
							const response = await fetch(
								`resources/hanzi-writer-data/data/${requestedCharacter}.json`,
								{
									signal: controller.signal,
								}
							);
							if (!response.ok) {
								throw new Error(
									`Character data request failed (${response.status}).`
								);
							}
							const data = await response.json();
							if (currentGeneration !== generation) {
								throw new Error('Character loading was canceled.');
							}
							return data;
						},
						onLoadCharDataError: (error) => {
							if (currentGeneration !== generation) {
								return;
							}
							stop();
							characterNotFound = true;
							handleError('Error loading characters.', error, { silent: true });
						},
					})
				);
			}
		} catch (error) {
			if (currentGeneration !== generation) {
				return;
			}
			stop();
			characterNotFound = true;
			handleError('Error loading characters.', error, { silent: true });
		}
	}

	function watchOperation(
		operation: ReturnType<HanziWriter['animateCharacter']> | Promise<void | undefined>,
		currentPlayback: number
	): void {
		void Promise.resolve(operation).catch((error) => {
			if (currentPlayback !== playback) {
				return;
			}
			stop();
			handleError('Error animating characters.', error, { silent: true });
		});
	}

	function animateCharacter(
		index: number,
		currentPlayback: number,
		sequence: HanziWriter[]
	): void {
		if (currentPlayback !== playback) {
			return;
		}
		if (index >= sequence.length) {
			active = false;
			paused = false;
			return;
		}
		currentlyAnimating = index;
		watchOperation(
			sequence[index].animateCharacter({
				onComplete: (result) => {
					if (currentPlayback !== playback) {
						return;
					}
					if (result?.canceled) {
						active = false;
						paused = false;
						playback += 1;
						return;
					}
					animateCharacter(index + 1, currentPlayback, sequence);
				},
			}),
			currentPlayback
		);
	}

	function toggle(): void {
		if (!writers.length || characterNotFound) {
			return;
		}
		if (active) {
			paused = true;
			active = false;
			watchOperation(writers[currentlyAnimating].pauseAnimation(), playback);
		} else if (paused) {
			paused = false;
			active = true;
			watchOperation(writers[currentlyAnimating].resumeAnimation(), playback);
		} else {
			const currentPlayback = ++playback;
			active = true;
			const sequence = [...writers];
			for (const writer of sequence) {
				watchOperation(writer.hideCharacter({ duration: 0 }), currentPlayback);
			}
			animateCharacter(0, currentPlayback, sequence);
		}
	}

	return {
		get active() {
			return active;
		},
		get paused() {
			return paused;
		},
		get characterNotFound() {
			return characterNotFound;
		},
		load,
		stop,
		toggle,
	};
}
