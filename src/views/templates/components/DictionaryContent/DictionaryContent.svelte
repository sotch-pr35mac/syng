<script>
	import { Check, Brush, Plus } from 'lucide-svelte';
	import { handleError, telemetry } from '@/utils';
	import { isMobile } from '@/utils/device.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import DefinitionItem from '@/components/DictionaryContent/DefinitionItem.svelte';
	import ExampleSentence from '@/components/DictionaryContent/ExampleSentence.svelte';
	import EntryTopline from '@/components/DictionaryContent/EntryTopline.svelte';
	import MeasureWord from '@/components/DictionaryContent/MeasureWord.svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { mobileCharacterWindowWordStore } from '@/stores/mobileCharacterWindowWord.svelte.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import { DROPDOWN_POSITIONS } from '@/types/dropdown.js';
	import { CHARACTER_SETS } from '@/types/dictionaryDisplay.js';
	import { BOOKMARK_LIST_MEMBERSHIP_OPERATIONS } from '@/types/bookmarks.js';
	import { cursorToEnd } from '@/actions/cursorToEnd.svelte.js';
	import SyTag from '@/components/SyTag/SyTag.svelte';
	import { HSK_VARIANT_LABELS } from '@/types/dictionaryDisplay.js';
	import { resolveHskLevels } from '@/utils/hsk.js';
	import {
		lexicalDisplayId,
		formatPartOfSpeech,
		lexicalDefinitions,
		lexicalExamples,
		lexicalLegacyMeasureWords,
		lexicalMeasureWords,
		lexicalPartsOfSpeech,
	} from '@/types/dictionary.js';

	/* Background Color Prop */
	/* Possible Values */
	// 'grey' - Grey Background

	/**
	 * @typedef {Object} Props
	 * @property {any} word - Word Prop
	 * @property {any} [lists] - Lists Prop
	 * @property {string} [backgroundColor] - 'white' - White Background
	 * @property {boolean} [fixedActions] - Render action dropdowns with fixed positioning
	 * @property {boolean} [separateTraditionalCharacters] - Display traditional characters on a separate line
	 * @property {(detail: any) => void} [onlink] - Callback when link is clicked
	 * @property {(event: import('@/types/bookmarks.js').BookmarkListMembershipEvent) => void} [onmembershipchange] - Callback after list membership changes
	 */

	/** @type {Props} */
	const {
		word,
		lists = [],
		backgroundColor = 'grey',
		fixedActions = false,
		separateTraditionalCharacters,
		onlink,
		onmembershipchange,
	} = $props();

	let memberLists = $state([]);
	let measureWords = $state([]);
	let dictionaryContentElement = $state();
	let previousWordId;

	// Reset the dictionary's own scroll position whenever a different word replaces
	// the current entry. Keep the position when the same entry is merely re-rendered.
	$effect(() => {
		const currentWordId = word ? lexicalDisplayId(word) : undefined;
		if (currentWordId === previousWordId) {
			return;
		}
		previousWordId = currentWordId;
		if (dictionaryContentElement) {
			dictionaryContentElement.scrollTop = 0;
		}
	});

	const updateListMembership = () => {
		const requestedWordId = word ? lexicalDisplayId(word) : undefined;
		bookmarksStore
			.inList(requestedWordId)
			.then((lists) => {
				if (!word || lexicalDisplayId(word) !== requestedWordId) {
					return undefined;
				}
				memberLists = lists;

				// After updating list membership update the 'add to bookmarks' action item icon
				// and tooltip to best reflect the new state.
				// Note: Here, the 'add to bookmarks' action item is assumed to be the first action
				actions[0].component = getBookmarkIcon();
				actions[0].tooltip = getBookmarkTooltip();
				return undefined;
			})
			.catch((e) => {
				handleError(
					'There was an error fetching list membership. Check the log for more details.',
					e
				);
			});
	};
	const _modifyListMembership = (fnName, list, word) => {
		if (!word || !lexicalDisplayId(word)) {
			handleError(
				'There was an error modifying the list membership. Check the log for more details.',
				{
					message: 'Cannot modify list membership without an active dictionary word.',
					list,
				}
			);
			return;
		}
		bookmarksStore[fnName](list, {
			lexical_id: lexicalDisplayId(word),
		})
			.then(() => {
				telemetry
					.trackEvent(fnName === 'addToList' ? 'bookmark.added' : 'bookmark.removed', {})
					.catch(() => {});
				onmembershipchange?.({
					listName: list,
					lexicalId: lexicalDisplayId(word),
					operation:
						fnName === 'addToList'
							? BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.ADDED
							: BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.REMOVED,
				});
				updateListMembership();
				return undefined;
			})
			.catch((e) => {
				handleError(
					'There was an error modifying the list membership. Check the log for more details.',
					{
						message: e instanceof Error ? e.message : String(e),
						cause: e,
						lexical_id: word ? lexicalDisplayId(word) : undefined,
						list,
					}
				);
			});
	};
	const removeListMembership = (list, word) => {
		_modifyListMembership('removeFromList', list, word);
	};
	const addListMembership = (list, word) => {
		_modifyListMembership('addToList', list, word);
	};

	// Update list membership when word changes
	$effect(() => {
		if (!word) {
			measureWords = [];
			return;
		}

		updateListMembership();
		// References retain their variety labels and can intentionally have no
		// lexical ID. Resolving them here would drop those Chinese-text fallbacks.
		const structuredMeasureWords = lexicalMeasureWords(word);
		measureWords = structuredMeasureWords.length
			? structuredMeasureWords
			: lexicalLegacyMeasureWords(word);
	});

	const getBookmarkIcon = () => (memberLists.length ? Check : Plus);
	const getBookmarkTooltip = () =>
		`${memberLists.length ? 'Remove from' : 'Add to'} ${lists.length > 1 ? 'List' : 'Bookmarks'}`;
	const actions = $derived([
		{
			component: getBookmarkIcon(),
			tooltip: getBookmarkTooltip(),
			action: () => {
				if (lists.length === 1) {
					const bookmarks = lists[0];
					if (memberLists.includes(bookmarks)) {
						removeListMembership(bookmarks, word);
					} else {
						addListMembership(bookmarks, word);
					}
				}
			},
			dropdown:
				lists.length === 1
					? undefined
					: lists.map((item) => {
							const inList = memberLists.includes(item);
							return {
								text: item,
								id: item,
								component: inList
									? TextWithIconDropdownItem
									: SimpleTextDropdownItem,
								icon: inList ? Check : undefined,
								hover: inList ? 'red' : undefined,
							};
						}),
			classes: ['sy-button--grouped--first'],
		},
		{
			component: Brush,
			tooltip: 'Write Characters',
			action: () => {
				const characterSet = dictionaryDisplaySettingsStore.settings.characterSet;
				const initialScript =
					characterSet === CHARACTER_SETS.BOTH ? undefined : characterSet;
				// isMobile() includes iPad — both iPhone and iPad navigate in-app
				// rather than opening the separate character window (desktop only).
				if (isMobile()) {
					// Set the word the characters screen renders before navigating;
					// otherwise it shows whatever word Search/Bookmarks last set.
					mobileCharacterWindowWordStore.set(word, initialScript);
					window.location.hash = '#/characters';
					telemetry.trackEvent('character_window.opened', {}).catch(() => {});
				} else {
					invoke(NATIVE_COMMANDS.WINDOW.OPEN_CHARACTER_WINDOW, {
						word: {
							traditional: word.traditional,
							simplified: word.simplified,
							...(initialScript ? { initialScript } : {}),
						},
					})
						.then(() =>
							telemetry.trackEvent('character_window.opened', {}).catch(() => {})
						)
						.catch((e) => {
							handleError(
								'An unknown error occurred while trying to open the enlarged character window. Please check the log for more details.',
								e
							);
						});
				}
			},
		},
		/*
	{
		component: MoreHorizontalIcon,
		tooltip: '',
		action: () => {
			alert('Feature Not Implemented');
		}
	}
	*/
	]);
	const handleOpenLink = (detail) => onlink?.(detail);

	let saveNotesDebounce;
	const saveNotes = () => {
		const cachedWord = word;
		clearTimeout(saveNotesDebounce);
		const DEBOUNCE_MS = 500;
		saveNotesDebounce = setTimeout(() => {
			const notes = document.getElementById('dictionary-content--notes').value.trim();
			bookmarksStore
				.updateProperty(lexicalDisplayId(cachedWord), 'notes', notes)
				.then(() => {
					cachedWord.notes = notes;
					return undefined;
				})
				.catch((e) => {
					handleError(
						'An unknown error occurred while trying to save the notes. Please check the log for more details.',
						e
					);
				});
		}, DEBOUNCE_MS);
	};

	const NOTES_KEYBOARD_SETTLE_MS = 300;
	const handleNotesFocus = (event) => {
		if (!isMobile()) {
			return;
		}
		const notesElement = event.currentTarget;
		// Wait for the on-screen keyboard to finish animating in (the layout shrinks
		// via visualViewport in MobileApp) before centering the field above it.
		setTimeout(() => {
			notesElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
		}, NOTES_KEYBOARD_SETTLE_MS);
	};

	const handleMembershipModification = (listName) => {
		if (memberLists.includes(listName)) {
			// The word is present in the selected list. The user must be
			// requesting to remove the word from this list.
			removeListMembership(listName, word);
		} else {
			// The word is not present in the selected list. The user must be
			// requesting to add the word to that list.
			addListMembership(listName, word);
		}
	};

	const getContainerClasses = () => {
		return [
			'dictionary-content-container',
			`dictionary-content--background-${backgroundColor}`,
		].join(' ');
	};
	const getHskLevels = () =>
		resolveHskLevels(word?.hsk, dictionaryDisplaySettingsStore.settings.hskVariant);
	const getPartsOfSpeech = () =>
		word && dictionaryDisplaySettingsStore.settings.showPartsOfSpeech
			? lexicalPartsOfSpeech(word)
			: [];
</script>

<div class={getContainerClasses()} bind:this={dictionaryContentElement}>
	{#if word}
		<section class="dictionary-content dictionary-content--header">
			<EntryTopline {word} {separateTraditionalCharacters} />
			<div class="dictionary-content__actions">
				<SyButtonBar>
					{#each actions as action, index (index)}
						{#if action.dropdown}
							<SyDropdown
								values={action.dropdown}
								onselection={handleMembershipModification}
								position={DROPDOWN_POSITIONS.RIGHT}
								fixed={fixedActions}
							>
								<SyButton
									grouped="true"
									classes={['sy-tooltip--container', ...action.classes]}
									onclick={action.action}
								>
									<action.component size="18" />
									{#if action.tooltip}
										<div class="sy-tooltip--body sy-tooltip--body-bottom">
											<p>
												{action.tooltip}
											</p>
										</div>
									{/if}
								</SyButton>
							</SyDropdown>
						{:else}
							<SyButton
								grouped="true"
								classes={['sy-tooltip--container', ...(action.classes ?? [])]}
								onclick={action.action}
							>
								<action.component size="18" />
								{#if action.tooltip}
									<div class="sy-tooltip--body sy-tooltip--body-bottom">
										<p>
											{action.tooltip}
										</p>
									</div>
								{/if}
							</SyButton>
						{/if}
					{/each}
				</SyButtonBar>
				{#if getHskLevels().length || getPartsOfSpeech().length}
					<div class="dictionary-content__tags">
						{#if getHskLevels().length}
							<SyTag
								variant="yellow"
								tooltip={HSK_VARIANT_LABELS[
									dictionaryDisplaySettingsStore.settings.hskVariant
								]}
							>
								HSK: {getHskLevels().join(', ')}
							</SyTag>
						{/if}
						{#each getPartsOfSpeech() as partOfSpeech (partOfSpeech.value)}
							<SyTag variant="blue">
								{formatPartOfSpeech(partOfSpeech.value)}
							</SyTag>
						{/each}
					</div>
				{/if}
			</div>
		</section>
		<section class="dictionary-content">
			<h2 class="dictionary-content--section-title">Definitions</h2>
			<SyList
				values={lexicalDefinitions(word)}
				component={DefinitionItem}
				onevent={handleOpenLink}
			/>
		</section>
		{#if measureWords.length}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">Measure Words</h2>
				<SyList values={measureWords} component={MeasureWord} onevent={handleOpenLink} />
			</section>
		{/if}
		{#if lexicalExamples(word).length}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">Examples</h2>
				<SyList
					values={lexicalExamples(word)}
					component={ExampleSentence}
					onevent={handleOpenLink}
				/>
			</section>
		{/if}
		{#if typeof word.notes === 'string'}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">Notes</h2>
				<textarea
					use:cursorToEnd
					placeholder="No Notes"
					class="dictionary-content--notes {isMobile()
						? 'dictionary-content--notes--mobile'
						: ''}"
					id="dictionary-content--notes"
					autocorrect="on"
					autocapitalize="sentences"
					onfocus={handleNotesFocus}
					oninput={saveNotes}>{word.notes}</textarea
				>
			</section>
		{/if}
	{/if}
</div>

<style>
	.dictionary-content-container {
		width: 100%;
		overflow-y: scroll;
		overflow-x: hidden;
	}
	.dictionary-content--background-grey {
		background-color: var(--sy-color--grey-2);
	}
	.dictionary-content--background-white {
		background-color: var(--sy-color--white);
	}
	.dictionary-content {
		padding: var(--sy-space--extra-large);
	}
	.dictionary-content--header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	.dictionary-content__tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--sy-space--small);
		margin-left: auto;
		padding: var(--sy-space--large);
	}
	.dictionary-content__actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.dictionary-content--section-title {
		font-size: 1.8em;
		font-weight: 400;
		margin: var(--sy-space--small) var(--sy-space--large);
		color: var(--sy-color--grey-4);
	}
	.dictionary-content--notes {
		display: block;
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		border: var(--sy-border);
		box-sizing: border-box;
		padding: var(--sy-space--extra-large);
		margin: var(--sy-space--extra-large);
		font-size: var(--sy-font--size);
		color: var(--sy-color--black);
		height: auto;
		width: calc(100% - calc(var(--sy-space--extra-large) + var(--sy-space--extra-large)));
	}
	.dictionary-content--notes--mobile {
		margin: var(--sy-mobile-space--medium) 0;
		width: 100%;
		border: var(--sy-mobile-surface-border);
		box-shadow: none;
	}
</style>
