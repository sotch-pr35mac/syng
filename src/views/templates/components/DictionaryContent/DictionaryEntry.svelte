<script>
	/**
	 * Reusable dictionary entry body: definitions, pronunciation, and entry actions.
	 * DictionaryContent owns layout and navigation between this body and breakdowns;
	 * lookup/breakdown callbacks let the same body render inside nested views.
	 */
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import { onDestroy } from 'svelte';

	import { Check, Brush, Plus, Blocks } from 'lucide-svelte';
	import { handleError, telemetry } from '@/utils';
	import { isMobile } from '@/utils/device.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import Awa from '@/components/Awa/Awa.svelte';
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
	 * @property {() => void} [onbreakdown]
	 * @property {boolean} [breakdownOpen]
	 * @property {any} word - Word Prop
	 * @property {any} [lists] - Lists Prop
	 * @property {string} [backgroundColor] - 'white' - White Background
	 * @property {boolean} [fixedActions] - Render action dropdowns with fixed positioning
	 * @property {boolean} [showEmptyState] - Show Awa in an unselected page detail pane
	 * @property {'search' | 'collect' | 'dictionary'} [emptyStatePose] - Match Awa to the page's empty state
	 * @property {string} [emptyStateMessage] - Optional guidance below Awa
	 * @property {import('svelte').Snippet} [emptyStateActions] - Optional actions below the empty-state guidance
	 * @property {boolean} [separateTraditionalCharacters] - Display traditional characters on a separate line
	 * @property {(detail: any) => void} [onlink] - Callback when link is clicked
	 * @property {(event: import('@/types/bookmarks.js').BookmarkListMembershipEvent) => void} [onmembershipchange] - Callback after list membership changes
	 */

	/** @type {Props} */
	const {
		word,
		onbreakdown,
		breakdownOpen = false,
		lists = [],
		backgroundColor = 'grey',
		fixedActions = false,
		showEmptyState = false,
		emptyStatePose = 'dictionary',
		emptyStateMessage = '',
		emptyStateActions,
		separateTraditionalCharacters,
		onlink,
		onmembershipchange,
	} = $props();

	const componentId = $props.id();
	const notesLabelId = `${componentId}-notes-label`;
	const notesInputId = `${componentId}-notes`;
	let membershipPending = $state(0);
	let membershipStatus = $state('');
	let memberLists = $state([]);
	let measureWords = $state([]);
	let dictionaryContentElement = $state();
	let previousWordId;
	let destroyed = false;
	onDestroy(() => {
		destroyed = true;
	});
	export function scrollPosition(value) {
		if (value !== undefined && dictionaryContentElement) {
			dictionaryContentElement.scrollTop = value;
		}
		return dictionaryContentElement?.scrollTop ?? 0;
	}

	// Reset the dictionary's own scroll position whenever a different word replaces
	// the current entry. Keep the position when the same entry is merely re-rendered.
	$effect(() => {
		const currentWordId = word ? lexicalDisplayId(word) : undefined;
		if (currentWordId === previousWordId) {
			return;
		}
		previousWordId = currentWordId;
		membershipStatus = '';
		if (dictionaryContentElement) {
			dictionaryContentElement.scrollTop = 0;
		}
	});

	const updateListMembership = () => {
		if (destroyed) {
			return;
		}
		const requestedWordId = word ? lexicalDisplayId(word) : undefined;
		bookmarksStore
			.inList(requestedWordId)
			.then((lists) => {
				// A lookup can finish after navigation has destroyed this entry.
				if (destroyed || !word || lexicalDisplayId(word) !== requestedWordId) {
					return undefined;
				}
				memberLists = lists;

				// The action icon and tooltip derive from memberLists automatically.
				return undefined;
			})
			.catch((e) => {
				if (destroyed) {
					return;
				}
				handleError(
					'There was an error fetching list membership. Check the log for more details.',
					e
				);
			});
	};
	const _modifyListMembership = (fnName, list, selectedWord) => {
		if (!selectedWord || !lexicalDisplayId(selectedWord)) {
			handleError(
				'There was an error modifying the list membership. Check the log for more details.',
				{
					message: 'Cannot modify list membership without an active dictionary word.',
					list,
				}
			);
			return undefined;
		}
		membershipPending += 1;
		membershipStatus = '';
		return bookmarksStore[fnName](list, {
			lexical_id: lexicalDisplayId(selectedWord),
		})
			.then(() => {
				if (word && lexicalDisplayId(word) === lexicalDisplayId(selectedWord)) {
					membershipStatus = `${fnName === 'addToList' ? 'Added to' : 'Removed from'} ${list}.`;
				}
				telemetry
					.trackEvent(fnName === 'addToList' ? 'bookmark.added' : 'bookmark.removed', {})
					.catch(() => {});
				onmembershipchange?.({
					listName: list,
					lexicalId: lexicalDisplayId(selectedWord),
					operation:
						fnName === 'addToList'
							? BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.ADDED
							: BOOKMARK_LIST_MEMBERSHIP_OPERATIONS.REMOVED,
				});
				updateListMembership();
				return undefined;
			})
			.catch((error) => {
				handleError(
					'There was an error modifying the list membership. Check the log for more details.',
					{
						message: error instanceof Error ? error.message : String(error),
						cause: error,
						lexical_id: selectedWord ? lexicalDisplayId(selectedWord) : undefined,
						list,
					}
				);
			})
			.finally(() => {
				membershipPending -= 1;
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
				walkthroughStore.suspend();
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
		{
			component: Blocks,
			tooltip: 'Character Breakdown',
			action: () => {
				if (!breakdownOpen) {
					walkthroughStore.suspend();
				}
				onbreakdown?.();
			},
		},
	]);
	const handleOpenLink = (detail) => onlink?.(detail);

	let saveNotesDebounce;
	const saveNotes = (event) => {
		const cachedWord = word;
		const notes = event.currentTarget.value.trim();
		clearTimeout(saveNotesDebounce);
		const DEBOUNCE_MS = 500;
		saveNotesDebounce = setTimeout(() => {
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
			notesElement.scrollIntoView({
				block: 'center',
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
					? 'auto'
					: 'smooth',
			});
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

<div
	use:walkthroughTarget={word ? 'dictionary-entry' : undefined}
	class={getContainerClasses()}
	bind:this={dictionaryContentElement}
>
	<p class="sy-sr-only" role="status" aria-atomic="true">{membershipStatus}</p>
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
								{#snippet children(_open, triggerProps)}
									<SyButton
										{...triggerProps}
										guideTarget="dictionary-save"
										grouped={true}
										classes={['sy-tooltip--container', ...action.classes]}
										aria-label="Choose bookmark lists"
										disabled={membershipPending > 0}
									>
										<action.component size="18" />
										<span
											class="sy-tooltip--body sy-tooltip--body-bottom"
											aria-hidden="true">{action.tooltip}</span
										>
									</SyButton>
								{/snippet}
							</SyDropdown>
						{:else}
							<SyButton
								guideTarget={index === 0
									? 'dictionary-save'
									: index === 1
										? 'dictionary-characters'
										: 'dictionary-breakdown'}
								grouped={true}
								classes={['sy-tooltip--container', ...(action.classes ?? [])]}
								onclick={action.action}
								aria-label={action.tooltip}
								aria-pressed={index === 0
									? memberLists.length > 0
									: index === 2
										? breakdownOpen
										: undefined}
								disabled={index === 0 && membershipPending > 0}
							>
								<action.component size="18" />
								{#if action.tooltip}
									<span
										class="sy-tooltip--body sy-tooltip--body-bottom"
										aria-hidden="true">{action.tooltip}</span
									>
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
				<h2 id={notesLabelId} class="dictionary-content--section-title">Notes</h2>
				<textarea
					use:walkthroughTarget={'dictionary-notes'}
					aria-label="Word notes"
					use:cursorToEnd
					placeholder="No Notes"
					class="dictionary-content--notes {isMobile()
						? 'dictionary-content--notes--mobile'
						: ''}"
					id={notesInputId}
					aria-labelledby={notesLabelId}
					autocorrect="on"
					autocapitalize="sentences"
					onfocus={handleNotesFocus}
					oninput={saveNotes}>{word.notes}</textarea
				>
			</section>
		{/if}
	{:else if showEmptyState}
		<div class="dictionary-content__empty">
			<Awa pose={emptyStatePose} />
			{#if emptyStateMessage}
				<p>{emptyStateMessage}</p>
			{/if}
			{@render emptyStateActions?.()}
		</div>
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
	.dictionary-content__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--large);
		min-height: 100%;
		padding: var(--sy-space--extra-large);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: center;
	}
	.dictionary-content__empty p {
		margin: 0;
	}
	.dictionary-content {
		padding: var(--sy-space--extra-large);
	}
	.dictionary-content--header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: var(--sy-space);
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
		margin-left: auto;
	}
	.dictionary-content--section-title {
		font-size: 1.8em;
		font-weight: 400;
		margin: var(--sy-space--small) var(--sy-space--large);
		color: var(--sy-text--muted);
	}
	.dictionary-content--notes {
		display: block;
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		border: var(--sy-border);
		box-sizing: border-box;
		padding: var(--sy-space--extra-large);
		margin: var(--sy-space--extra-large);
		font-size: var(--sy-font-size--medium);
		color: var(--sy-color--black);
		height: auto;
		width: calc(100% - calc(var(--sy-space--extra-large) + var(--sy-space--extra-large)));
	}
	.dictionary-content--notes::placeholder {
		color: var(--sy-text--placeholder);
		opacity: 1;
	}
	.dictionary-content--notes:where(textarea) {
		border: var(--sy-input--border);
	}
	.dictionary-content--notes--mobile {
		margin: var(--sy-mobile-space--medium) 0;
		width: 100%;
		border: var(--sy-input--border-mobile);
		box-shadow: none;
	}
</style>
