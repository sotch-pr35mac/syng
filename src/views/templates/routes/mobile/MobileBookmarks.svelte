<script lang="ts">
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	import { onMount, tick, untrack } from 'svelte';
	import {
		ChevronDown,
		ChevronUp,
		EllipsisVertical,
		FolderDown,
		FolderUp,
		Trash2,
		SquareStack,
		Award,
	} from 'lucide-svelte';
	import { getStudyEligibility, studyHref, type StudyAction } from '@/composables/study.js';
	import { router } from 'svelte-spa-router';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
	import Awa, { AWA_SIZES } from '@/components/Awa/Awa.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { type SheetSnap } from '@/types/snapSheet.js';
	import { mobileBookmarksSnapStore } from '@/stores/mobileBookmarks.svelte.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import {
		bookmarksRoute,
		CREATE_NEW_LIST_ID,
		DEFAULT_BOOKMARKS_LIST,
		type WordListPreviewItem,
	} from '@/composables/bookmarks.svelte.js';
	import type { BookmarkListMembershipEvent } from '@/types/bookmarks.js';
	import { createClickPositionTracker } from '@/composables/clickPosition.svelte.js';
	import {
		normalizeDictionaryLookupRequest,
		type DictionaryLookupRequest,
	} from '@/composables/dictionaryPopover.svelte.js';
	import { DROPDOWN_DIRECTIONS, DROPDOWN_POSITIONS } from '@/types/dropdown.js';
	import DictionaryListPreviewContent from '@/components/SyList/DictionaryListPreviewContent.svelte';

	let dictionaryElement = $state<HTMLElement>();
	let sheetRef = $state<SySnapSheet | undefined>(undefined);
	let currentSnap = $state<SheetSnap>(mobileBookmarksSnapStore.value);
	const activeList = $derived(bookmarksRoute.activeList);
	const activeWord = $derived(bookmarksRoute.activeWord);
	const activeWordKey = $derived(activeWord?.lexical_id ?? activeWord?.id ?? null);
	const lists = $derived(bookmarksRoute.lists);
	const dropdownList = $derived(bookmarksRoute.dropdownList);
	const wordList = $derived(bookmarksRoute.wordList);
	const studyEligibility = $derived(
		getStudyEligibility(wordList.length, bookmarksRoute.contentStatus)
	);
	const studyActions = $derived([
		{
			id: 'flashcards' as const,
			icon: SquareStack,
			label: 'Flashcards',
			disabled: !studyEligibility.flashcards,
		},
		{
			id: 'quiz' as const,
			icon: Award,
			label: 'Quiz',
			disabled: !studyEligibility.quiz,
		},
	]);
	let filterValue = $state('');
	let visibleWordList = $state<WordListPreviewItem[]>([]);
	const showEmptyState = $derived(
		bookmarksRoute.contentStatus === 'ready' &&
			(!wordList.length || (Boolean(filterValue) && !visibleWordList.length))
	);
	const dropdownDirection = $derived(
		currentSnap === 'full' ? DROPDOWN_DIRECTIONS.DOWN : DROPDOWN_DIRECTIONS.UP
	);

	onMount(() => {
		const requestedList = new URLSearchParams(router.querystring).get('list');
		const cancelInitialization = bookmarksRoute.initialize(requestedList);

		if (currentSnap === 'partial') {
			sheetRef?.openPartial();
		} else if (currentSnap === 'full') {
			sheetRef?.openFull();
		}
		return cancelInitialization;
	});

	$effect(() => {
		if (bookmarksRoute.contentStatus === 'ready' && !wordList.length) {
			untrack(() => {
				if (currentSnap === 'collapsed') {
					sheetRef?.openPartial();
				}
			});
		}
	});

	$effect(() => {
		const step = walkthroughStore.phase === 'guiding' ? walkthroughStore.step : undefined;
		const sheet = sheetRef;
		if (step?.route === '/bookmarks' && sheet) {
			untrack(() => {
				if (step.target.startsWith('dictionary-') && activeWord) {
					sheet.collapse();
				} else {
					sheet.openPartial();
				}
			});
		}
	});

	function handleSnapChange(snap: SheetSnap): void {
		currentSnap = snap;
		mobileBookmarksSnapStore.set(snap);
	}

	function startStudy(action: StudyAction): void {
		if (studyEligibility[action]) {
			window.location.hash = studyHref(action, activeList, 'bookmarks');
		}
	}

	function handleListSelection(id: string | number): void {
		if (typeof id !== 'string') {
			return;
		}
		if (id === CREATE_NEW_LIST_ID) {
			bookmarksRoute.clearCreationError();
			createNewModalVisible = true;
			return;
		}
		filterValue = '';
		bookmarksRoute.setActiveList(id).catch(() => {});
	}

	function handleSelectWord(data: { index: number; value: any; keyboard?: boolean }): void {
		bookmarksRoute.selectWord(data);
		sheetRef?.collapse();
		if (data.keyboard) {
			void tick()
				.then(() => {
					dictionaryElement
						?.querySelector<HTMLElement>('h1')
						?.focus({ preventScroll: true });
					return undefined;
				})
				.catch(() => {});
		}
	}

	function handleVisibleWordListChange(values: WordListPreviewItem[]): void {
		visibleWordList = values;
	}

	function handleMembershipChange(event: BookmarkListMembershipEvent): void {
		bookmarksRoute
			.reconcileMembershipChange(event, visibleWordList)
			.then(({ clearFilter }) => {
				if (clearFilter) {
					filterValue = '';
				}
				return undefined;
			})
			.catch(() => {});
	}

	function handleFilterFocus(event: FocusEvent): void {
		if (event.target instanceof HTMLInputElement && currentSnap === 'collapsed') {
			sheetRef?.openPartial();
		}
	}

	const clickTracker = createClickPositionTracker();
	function handleDictionaryLink(request: DictionaryLookupRequest): void {
		const lookup = normalizeDictionaryLookupRequest(request);
		bookmarksRoute.lookupPopoverWord({
			...lookup,
			anchor: lookup.anchor ?? clickTracker.lastClickRect,
		});
	}

	const listActions = $derived([
		{ id: 'import', text: 'Import', icon: FolderDown, component: TextWithIconDropdownItem },
		{ id: 'export', text: 'Export', icon: FolderUp, component: TextWithIconDropdownItem },
		...(activeList === DEFAULT_BOOKMARKS_LIST
			? []
			: [
					{
						id: 'delete',
						text: 'Delete',
						icon: Trash2,
						color: 'red',
						component: TextWithIconDropdownItem,
					},
				]),
	]);
	function handleListAction(action: string | number): void {
		if (action === 'import') {
			importList();
		} else if (action === 'export') {
			exportActiveList();
		} else if (action === 'delete') {
			deleteActiveList();
		}
	}

	function importList(): void {
		bookmarksRoute
			.importList()
			.then((imported) => {
				if (imported) {
					filterValue = '';
				}
				return undefined;
			})
			.catch(() => {});
	}

	function exportActiveList(): void {
		bookmarksRoute.exportActiveList();
	}

	function deleteActiveList(): void {
		bookmarksRoute.confirmDeleteActiveList().catch(() => {});
	}

	// Create New List modal
	let createNewModalVisible = $state(false);
	let createNewButtonDisabled = $state(false);
	let newListName = $state('');
	let createNewFormVersion = 0;

	function closeNewModal(): void {
		createNewModalVisible = false;
		newListName = '';
		createNewFormVersion += 1;
		bookmarksRoute.clearCreationError();
	}

	function handleNewListName(value: string): void {
		newListName = value;
		bookmarksRoute.clearCreationError();
	}

	async function createNewList(): Promise<void> {
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
</script>

<div class="mobile-bookmarks">
	<div class="mobile-bookmarks__content" use:scrollRestore={'mobile-bookmarks-content'}>
		{#if activeWord}
			<div
				class="mobile-bookmarks__dict-wrapper"
				bind:this={dictionaryElement}
				onclickcapture={clickTracker.captureClickPosition}
			>
				<DictionaryContent
					word={activeWord}
					{lists}
					onlink={handleDictionaryLink}
					onmembershipchange={handleMembershipChange}
				/>
			</div>
		{:else if bookmarksRoute.contentStatus === 'ready'}
			<div class="mobile-bookmarks__empty">
				<Awa pose="collect" size={AWA_SIZES.detail} />
				<WalkthroughHelp guide="bookmarks" label="Learn how Bookmarks works" />
				{#if wordList.length}
					<p>Select a word from your bookmarks</p>
				{/if}
			</div>
		{/if}
	</div>

	<SySnapSheet
		accessibleName="Bookmark lists"
		bind:this={sheetRef}
		onSnapChange={handleSnapChange}
	>
		<div class="mobile-bookmarks__header-row">
			<SyDropdown
				values={dropdownList}
				onselection={handleListSelection}
				direction={dropdownDirection}
				fixed={true}
			>
				{#snippet children(open, triggerProps)}
					<SyButton
						{...triggerProps}
						guideTarget="bookmarks-lists"
						aria-label={`Choose list: ${activeList}`}
						style="ghost"
						size="small"
					>
						<span class="mobile-bookmarks__list-name">{activeList}</span>&nbsp;
						{#if open}<ChevronUp size="16" />{:else}<ChevronDown size="16" />{/if}
					</SyButton>
				{/snippet}
			</SyDropdown>

			<div class="mobile-bookmarks__study-actions">
				{#each studyActions as action (action.id)}
					<SyButton
						style="ghost"
						size="small"
						aria-label={action.label}
						title={action.disabled ? studyEligibility.message : action.label}
						disabled={action.disabled}
						onclick={() => startStudy(action.id)}
						classes={['mobile-bookmarks__study-action']}
					>
						<action.icon size="20" />
					</SyButton>
				{/each}
			</div>
			<SyDropdown
				values={listActions}
				onselection={handleListAction}
				direction={dropdownDirection}
				position={DROPDOWN_POSITIONS.RIGHT}
				fixed={true}
			>
				{#snippet children(_open, triggerProps)}
					<SyButton
						{...triggerProps}
						style="ghost"
						size="small"
						aria-label="List actions"
					>
						<EllipsisVertical size="20" />
					</SyButton>
				{/snippet}
			</SyDropdown>
		</div>
		{#if studyEligibility.flashcards && !studyEligibility.quiz}
			<p class="mobile-bookmarks__study-requirement">{studyEligibility.message}</p>
		{/if}

		<div
			use:walkthroughTarget={'bookmarks-words'}
			class="mobile-bookmarks__results"
			class:mobile-bookmarks__results--empty={showEmptyState}
			role="region"
			aria-label="Saved words"
			onfocusin={handleFilterFocus}
			use:scrollRestore={'mobile-bookmarks-results'}
		>
			<SyList
				style="preview"
				values={wordList}
				component={DictionaryListPreviewContent}
				activeKey={activeWordKey}
				bind:filterValue
				onvisiblechange={handleVisibleWordListChange}
				filterable={true}
				onselection={handleSelectWord}
			/>
			{#if bookmarksRoute.contentStatus === 'ready'}
				{#if !wordList.length}
					<div class="mobile-bookmarks__list-empty">
						<p>This list is empty. Search for a word, then add it to this list.</p>
						<SyButton color="blue" onclick={() => (window.location.hash = '#/')}>
							Search for words
						</SyButton>
					</div>
				{:else if filterValue && !visibleWordList.length}
					<div class="mobile-bookmarks__list-empty">
						<p>No words match your filter.</p>
						<SyButton color="blue" onclick={() => (filterValue = '')}
							>Clear filter</SyButton
						>
					</div>
				{/if}
			{/if}
		</div>
	</SySnapSheet>
</div>

<SyModal title="Create List" visible={createNewModalVisible} onclose={closeNewModal}>
	{#snippet body()}
		<div class="mobile-bookmarks__modal-content">
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
					class="mobile-bookmarks__creation-error"
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

<style>
	.mobile-bookmarks__list-empty {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		padding: var(--sy-space--large);
		color: var(--sy-text--dark);
		font-family: var(--sy-font-family);
		text-align: center;
	}

	/* Bias upward only when the visible sheet has room around the message and action. */
	.mobile-bookmarks__list-empty::before,
	.mobile-bookmarks__list-empty::after {
		content: '';
		flex: 2;
	}

	.mobile-bookmarks__list-empty::after {
		flex: 3;
	}

	.mobile-bookmarks__list-empty p {
		margin: 0 0 var(--sy-space--large);
		font-size: 0.8125rem;
		font-weight: var(--sy-font-weight--normal);
		line-height: var(--sy-line-height--body);
	}

	.mobile-bookmarks__creation-error {
		color: var(--sy-text--red);
		margin: var(--sy-space) calc(var(--sy-space--small) + var(--sy-space));
	}
	.mobile-bookmarks {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-bookmarks__content {
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: none;
		background-color: var(--sy-color--grey-2);
	}

	.mobile-bookmarks__dict-wrapper {
		padding-bottom: calc(110px + env(safe-area-inset-bottom));
	}

	.mobile-bookmarks__empty {
		flex-direction: column;
		gap: var(--sy-mobile-space--medium);
		padding: var(--sy-mobile-space--large);
		box-sizing: border-box;
		overflow-y: auto;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(110px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sy-text--muted);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.mobile-bookmarks__header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		padding: 0 var(--sy-mobile-space--medium) var(--sy-mobile-space--small);
		gap: var(--sy-mobile-space--small);
		flex-shrink: 0;
	}

	.mobile-bookmarks__header-row > :global(.sy-dropdown--container) {
		flex-shrink: 0;
	}

	.mobile-bookmarks__header-row > :global(.sy-dropdown--container:first-child) {
		min-width: 0;
		flex: 1;
	}

	.mobile-bookmarks__header-row :global(.sy-dropdown--container:first-child .sy-button) {
		max-width: 100%;
	}

	.mobile-bookmarks__list-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mobile-bookmarks__study-actions {
		display: flex;
		flex-shrink: 0;
	}

	:global(.mobile-bookmarks__study-action) {
		margin: 0;
	}

	.mobile-bookmarks__study-requirement {
		flex-shrink: 0;
		margin: 0 var(--sy-mobile-space--large) var(--sy-mobile-space--small);
		color: var(--sy-text--muted);
		font-family: var(--sy-font-family);
		font-size: 0.8125rem;
		text-align: right;
	}

	.mobile-bookmarks__results {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.mobile-bookmarks__results--empty {
		display: flex;
		flex-direction: column;
		min-height: 0;
		/* The sheet is rendered at full height even when only partly revealed. */
		margin-bottom: var(--sy-snap-sheet-hidden-height, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.mobile-bookmarks__modal-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
</style>
