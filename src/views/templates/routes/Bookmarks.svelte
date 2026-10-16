<script>
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	import {
		ChevronDown,
		ChevronUp,
		FolderDown,
		Trash2,
		FolderUp,
		SquareStack,
		Award,
	} from 'lucide-svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { getStudyEligibility, studyHref } from '@/composables/study.js';
	import { router } from 'svelte-spa-router';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { onMount } from 'svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';
	import {
		bookmarksRoute,
		CREATE_NEW_LIST_ID,
		DEFAULT_BOOKMARKS_LIST,
	} from '@/composables/bookmarks.svelte.js';
	import { createClickPositionTracker } from '@/composables/clickPosition.svelte.js';
	import { normalizeDictionaryLookupRequest } from '@/composables/dictionaryPopover.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();

	const activeList = $derived(bookmarksRoute.activeList);
	const activeWord = $derived(bookmarksRoute.activeWord);
	const lists = $derived(bookmarksRoute.lists);
	const dropdownList = $derived(bookmarksRoute.dropdownList);
	const wordList = $derived(bookmarksRoute.wordList);
	const studyEligibility = $derived(
		getStudyEligibility(wordList.length, bookmarksRoute.contentStatus)
	);
	let filterValue = $state('');
	let visibleWordList = $state([]);

	onMount(() => {
		const requestedList = new URLSearchParams(router.querystring).get('list');
		const cancelInitialization = bookmarksRoute.initialize(requestedList);
		return cancelInitialization;
	});

	// Handle active list selection
	const handleListSelection = (id) => {
		if (id === CREATE_NEW_LIST_ID) {
			bookmarksRoute.clearCreationError();
			createNewModalVisible = true;
			return;
		}
		filterValue = '';
		bookmarksRoute.setActiveList(id).catch(() => {});
	};

	// Create New List modal
	let createNewModalVisible = $state(false);
	let createNewButtonDisabled = $state(false);
	let newListName = $state('');
	let createNewFormVersion = 0;

	function closeNewModal() {
		createNewModalVisible = false;
		newListName = '';
		createNewFormVersion += 1;
		bookmarksRoute.clearCreationError();
	}

	function handleNewListName(value) {
		newListName = value;
		bookmarksRoute.clearCreationError();
	}

	async function createNewList() {
		if (createNewButtonDisabled) {
			return;
		}
		createNewButtonDisabled = true;
		const submittedName = newListName.trim();
		const submittedFormVersion = createNewFormVersion;
		try {
			const created = await bookmarksRoute.createList(submittedName);
			if (submittedFormVersion !== createNewFormVersion) {
				bookmarksRoute.clearCreationError();
				return;
			}
			if (created) {
				filterValue = '';
				closeNewModal();
				await bookmarksRoute.setActiveList(submittedName);
			} else if (submittedName !== newListName.trim()) {
				bookmarksRoute.clearCreationError();
			}
		} finally {
			createNewButtonDisabled = false;
		}
	}

	// Word Selection
	const handleSelection = (data) => {
		bookmarksRoute.selectWord(data);
	};
	const handleVisibleWordListChange = (values) => {
		visibleWordList = values;
	};
	const handleMembershipChange = (event) => {
		bookmarksRoute
			.reconcileMembershipChange(event, visibleWordList)
			.then(({ clearFilter }) => {
				if (clearFilter) {
					filterValue = '';
				}
				return undefined;
			})
			.catch(() => {});
	};

	// Actions
	let disableDeleteButton = $state(false);
	const deleteActiveList = () => {
		disableDeleteButton = true;
		bookmarksRoute
			.confirmDeleteActiveList()
			.then(() => {
				disableDeleteButton = false;
				return undefined;
			})
			.catch(() => {
				disableDeleteButton = false;
			});
	};
	const exportActiveList = () => bookmarksRoute.exportActiveList();
	const importList = () =>
		bookmarksRoute.importList().then((imported) => {
			if (imported) {
				filterValue = '';
			}
			return imported;
		});

	const clickTracker = createClickPositionTracker();
	const handleDictionaryLink = (request) => {
		const lookup = normalizeDictionaryLookupRequest(request);
		bookmarksRoute.lookupPopoverWord({
			...lookup,
			anchor: lookup.anchor ?? clickTracker.lastClickRect,
		});
	};

	const actions = $derived([
		{
			icon: SquareStack,
			action: () => {
				if (studyEligibility.flashcards) {
					window.location.hash = studyHref('flashcards', activeList, 'bookmarks');
				}
			},
			tooltip: 'Flashcards',
			description: studyEligibility.flashcards ? '' : studyEligibility.message,
			exclude: [],
			disabled: !studyEligibility.flashcards,
		},
		{
			icon: Award,
			action: () => {
				if (studyEligibility.quiz) {
					window.location.hash = studyHref('quiz', activeList, 'bookmarks');
				}
			},
			tooltip: 'Quiz',
			description: studyEligibility.quiz ? '' : studyEligibility.message,
			exclude: [],
			disabled: !studyEligibility.quiz,
		},
		{
			icon: FolderDown,
			action: importList,
			tooltip: 'Import',
			exclude: [],
			disabled: false,
		},
		{
			icon: FolderUp,
			action: exportActiveList,
			tooltip: 'Export',
			exclude: [],
			disabled: false,
		},
		{
			icon: Trash2,
			action: deleteActiveList,
			tooltip: 'Delete',
			exclude: [DEFAULT_BOOKMARKS_LIST],
			disabled: disableDeleteButton,
			hover: 'red',
		},
	]);
</script>

<div
	class="bookmarks--container"
	use:responsiveLayout={{ thresholdRem: 44, className: 'bookmarks--container--stacked' }}
>
	<div
		class="bookmarks--header"
		class:bookmarks--header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<SyDropdown values={dropdownList} onselection={handleListSelection}>
			{#snippet children(open, triggerProps)}
				<SyButton
					{...triggerProps}
					guideTarget="bookmarks-lists"
					size="large"
					style="ghost"
					center={true}
					aria-label={`Choose list: ${activeList}`}
				>
					{activeList}&nbsp;
					{#if open}<ChevronUp size="20" />{:else}<ChevronDown size="20" />{/if}
				</SyButton>
			{/snippet}
		</SyDropdown>
		<div class="bookmarks--header--actions">
			<WalkthroughHelp guide="bookmarks" />
			{#each actions as action (action.tooltip)}
				{#if !action.exclude.includes(activeList)}
					<span class="bookmarks--header--action-item">
						<SyButton
							style="ghost"
							aria-label={action.tooltip}
							title={action.description || action.tooltip}
							onclick={action.action}
							disabled={action.disabled}
							hover={action.hover}
							classes={['sy-tooltip--container']}
						>
							<action.icon size="20" />
							<span
								class="sy-tooltip--body sy-tooltip--body-bottom"
								aria-hidden="true">{action.description || action.tooltip}</span
							>
						</SyButton>
					</span>
				{/if}
			{/each}
		</div>
	</div>
	<div class="bookmarks--content">
		<div
			use:walkthroughTarget={'bookmarks-words'}
			class="bookmarks--word-listing"
			role="region"
			aria-label="Saved words"
			data-elastic
			use:scrollRestore={'bookmarks-word-listing'}
		>
			<SyList
				style="preview"
				values={wordList}
				component={DictionaryListPreviewContent}
				activeKey={activeWord?.lexical_id ?? activeWord?.id ?? null}
				bind:filterValue
				onvisiblechange={handleVisibleWordListChange}
				onselection={handleSelection}
				filterable={true}
			/>
			{#if bookmarksRoute.contentStatus === 'ready'}
				{#if !wordList.length}
					<div class="bookmarks--list-empty">
						<p>This list is empty. Search for a word, then add it to this list.</p>
						<SyButton color="blue" onclick={() => (window.location.hash = '#/')}>
							Search for words
						</SyButton>
					</div>
				{:else if filterValue && !visibleWordList.length}
					<div class="bookmarks--list-empty">
						<p>No words match your filter.</p>
						<SyButton color="blue" onclick={() => (filterValue = '')}
							>Clear filter</SyButton
						>
					</div>
				{/if}
			{/if}
		</div>
		<div
			class="dictionary-content"
			role="region"
			aria-label="Dictionary entry"
			onclickcapture={clickTracker.captureClickPosition}
		>
			<DictionaryContent
				word={activeWord}
				showEmptyState={bookmarksRoute.contentStatus === 'ready'}
				emptyStatePose="collect"
				{lists}
				onlink={handleDictionaryLink}
				onmembershipchange={handleMembershipChange}
			/>
		</div>
	</div>
	<SyModal title="Create List" visible={createNewModalVisible} onclose={closeNewModal}>
		{#snippet body()}
			<div class="bookmarks-modal-content">
				<label for="create-new-list-input">What would you like to call this list?</label>
				<SyTextInput
					size="large"
					placeholder={`ex. ${bookmarksRoute.getNewPlaceholder()}`}
					id="create-new-list-input"
					aria-invalid={bookmarksRoute.creationNameInvalid || undefined}
					aria-describedby={bookmarksRoute.creationError
						? 'create-new-list-error'
						: undefined}
					value={newListName}
					oninput={handleNewListName}
				/>
				{#if bookmarksRoute.creationError}
					<p
						class="bookmarks--creation-error"
						id="create-new-list-error"
						role="alert"
						aria-atomic="true"
					>
						{bookmarksRoute.creationError}
					</p>
				{/if}
			</div>
		{/snippet}
		{#snippet footer()}
			<SyButton size="large" onclick={closeNewModal}>Cancel</SyButton>
			&nbsp;
			<SyButton
				size="large"
				color="green"
				onclick={createNewList}
				disabled={createNewButtonDisabled}
			>
				Create
			</SyButton>
		{/snippet}
	</SyModal>
	<DictionaryPopover
		word={bookmarksRoute.popoverWord}
		results={bookmarksRoute.popoverResults}
		resultIndex={bookmarksRoute.popoverResultIndex}
		lists={bookmarksRoute.lists}
		anchor={bookmarksRoute.popoverAnchor}
		onselect={bookmarksRoute.selectPopoverResult}
		onclose={bookmarksRoute.closePopoverDictionary}
		onlink={bookmarksRoute.lookupPopoverWord}
		onmembershipchange={handleMembershipChange}
	/>
</div>

<style>
	.bookmarks--list-empty {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--large);
		padding: var(--sy-space--large);
		/* Balance the header and filter above the empty state. */
		padding-bottom: calc(var(--sy-space--large) + min(12vh, 100px));
		color: var(--sy-text--dark);
		text-align: center;
	}

	.bookmarks--list-empty p {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: var(--sy-font-weight--normal);
		line-height: var(--sy-line-height--body);
	}

	.bookmarks--creation-error {
		color: var(--sy-text--red);
		margin: var(--sy-space) calc(var(--sy-space--small) + var(--sy-space));
	}
	.bookmarks--container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
	}
	.bookmarks--header {
		display: flex;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		margin: 0;
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	:global(.bookmarks--container--stacked) .bookmarks--content {
		flex-direction: column;
	}
	:global(.bookmarks--container--stacked) .bookmarks--word-listing {
		flex: 1;
		min-height: 0;
		height: auto;
	}
	:global(.bookmarks--container--stacked) .dictionary-content {
		flex: 2;
		min-height: 0;
		height: auto;
	}
	.bookmarks--header--ipad {
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
		padding-bottom: var(--sy-space--large);
	}
	.bookmarks--header--actions {
		display: flex;
		flex-direction: row;
		align-items: center;
	}
	.bookmarks--header--action-item {
		margin: var(--sy-space);
	}
	.bookmarks--content {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.bookmarks--word-listing {
		display: flex;
		flex: 2;
		min-width: 0;
		z-index: var(--sy-z-index--base);
		flex-direction: column;
		background-color: var(--sy-color--white);
		height: 100%;
		overflow-y: scroll;
		overflow-x: hidden;
	}
	.bookmarks-modal-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.dictionary-content {
		display: flex;
		flex: 9;
		min-width: 0;
		box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
		height: 100%;
		z-index: var(--sy-z-index--base-1);
	}
</style>
