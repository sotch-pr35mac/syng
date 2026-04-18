<script>
	import { Check, Brush, Plus } from 'lucide-svelte';
	import { handleError, telemetry } from '../../utils/';
	import { isMobile } from '../../utils/device.js';
	import SyButton from '../SyButton/SyButton.svelte';
	import SyButtonBar from '../SyButtonBar/SyButtonBar.svelte';
	import SimpleTextDropdownItem from '../SyDropdown/SimpleTextDropdownItem.svelte';
	import SyDropdown from '../SyDropdown/SyDropdown.svelte';
	import TextWithIconDropdownItem from '../SyDropdown/TextWithIconDropdownItem.svelte';
	import SyList from '../SyList/SyList.svelte';
	import DefinitionItem from './DefinitionItem.svelte';
	import EntryTopline from './EntryTopline.svelte';
	import MeasureWord from './MeasureWord.svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { bookmarksStore } from '../../stores/bookmarks.svelte.js';
	import { NATIVE_COMMANDS } from '../../types/nativeCommands.js';
	import { DROPDOWN_POSITIONS } from '../../types/dropdown.js';

	/* Background Color Prop */
	/* Possible Values */
	// 'grey' - Grey Background

	/**
	 * @typedef {Object} Props
	 * @property {any} word - Word Prop
	 * @property {any} [lists] - Lists Prop
	 * @property {string} [backgroundColor] - 'white' - White Background
	 * @property {(detail: any) => void} [onlink] - Callback when link is clicked
	 */

	/** @type {Props} */
	const { word, lists = [], backgroundColor = 'grey', onlink } = $props();

	let memberLists = $state([]);

	const updateListMembership = () => {
		bookmarksStore
			.inList(word.hash)
			.then((lists) => {
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
		bookmarksStore[fnName](list, word)
			.then(() => {
				updateListMembership();
				return undefined;
			})
			.catch((e) => {
				handleError(
					'There was an error modifying the list membership. Check the log for more details.',
					{
						e,
						word,
						list,
					}
				);
			});
	};
	const removeListMembership = (list, word) => {
		telemetry.trackEvent('bookmark.removed', {}).catch(() => {});
		_modifyListMembership('removeFromList', list, word);
	};
	const addListMembership = (list, word) => {
		telemetry.trackEvent('bookmark.added', {}).catch(() => {});
		_modifyListMembership('addToList', list, word);
	};

	// Update list membership when word changes
	$effect(() => {
		if (word) {
			updateListMembership();
		}
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
				telemetry.trackEvent('character_window.opened', {}).catch(() => {});
				// isMobile() includes iPad — both iPhone and iPad navigate in-app
				// rather than opening the separate character window (desktop only).
				if (isMobile()) {
					window.location.hash = '#/characters';
				} else {
					invoke(NATIVE_COMMANDS.WINDOW.OPEN_CHARACTER_WINDOW, {
						word: {
							traditional: word.traditional,
							simplified: word.simplified,
						},
					}).catch((e) => {
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
				.updateProperty(cachedWord.hash, 'notes', notes)
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
</script>

<div class={getContainerClasses()}>
	{#if word}
		<section class="dictionary-content dictionary-content--header">
			<EntryTopline {word} />
			<SyButtonBar>
				{#each actions as action, index (index)}
					{#if action.dropdown}
						<SyDropdown
							values={action.dropdown}
							onselection={handleMembershipModification}
							position={DROPDOWN_POSITIONS.RIGHT}
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
		</section>
		<section class="dictionary-content">
			<h2 class="dictionary-content--section-title">Definitions</h2>
			<SyList values={word.english} component={DefinitionItem} onevent={handleOpenLink} />
		</section>
		{#if word.measure_words.length}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">Measure Words</h2>
				<SyList
					values={word.measure_words}
					component={MeasureWord}
					onevent={handleOpenLink}
				/>
			</section>
		{/if}
		{#if typeof word.notes === 'string'}
			<section class="dictionary-content">
				<h2 class="dictionary-content--section-title">Notes</h2>
				<textarea
					placeholder="No Notes"
					class="dictionary-content--notes {isMobile()
						? 'dictionary-content--notes--mobile'
						: ''}"
					id="dictionary-content--notes"
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
