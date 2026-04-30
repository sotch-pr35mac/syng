<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		ChevronDown,
		ChevronUp,
		EllipsisVertical,
		FolderDown,
		FolderUp,
		Trash2,
	} from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import DictionaryContent from '@/components/DictionaryContent/DictionaryContent.svelte';
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
	} from '@/composables/bookmarks.svelte.js';
	import { DROPDOWN_DIRECTIONS } from '@/types/dropdown.js';

	let sheetRef = $state<SySnapSheet | undefined>(undefined);
	let currentSnap = $state<SheetSnap>(mobileBookmarksSnapStore.value);
	const activeList = $derived(bookmarksRoute.activeList);
	const activeWord = $derived(bookmarksRoute.activeWord);
	const lists = $derived(bookmarksRoute.lists);
	const dropdownList = $derived(bookmarksRoute.dropdownList);
	const wordList = $derived(bookmarksRoute.wordList);
	const dropdownDirection = $derived(
		currentSnap === 'full' ? DROPDOWN_DIRECTIONS.DOWN : DROPDOWN_DIRECTIONS.UP
	);
	const OVERFLOW_MENU_OFFSET_PX = 4;

	const selectWordElement = (index: number) => {
		const container = document.querySelector('.mobile-bookmarks__results');
		if (!container) {
			return;
		}
		const elements = container.getElementsByClassName('sy-list-preview-item-container');
		if (elements[index]) {
			(elements[index] as HTMLElement).click();
		}
	};

	const replayActiveWordSelection = () => {
		if (!activeWord) {
			return;
		}
		const activeWordIndex = bookmarksRoute.words.findIndex(
			(word) => word.hash === activeWord?.hash
		);
		if (activeWordIndex < 0) {
			return;
		}
		tick()
			.then(() => {
				selectWordElement(activeWordIndex);
				return undefined;
			})
			.catch(() => {});
	};

	onMount(() => {
		bookmarksRoute
			.updateListContent()
			.then(replayActiveWordSelection)
			.catch(() => {});

		if (currentSnap === 'partial') {
			sheetRef?.openPartial();
		} else if (currentSnap === 'full') {
			sheetRef?.openFull();
		}
	});

	function handleSnapChange(snap: SheetSnap): void {
		currentSnap = snap;
		mobileBookmarksSnapStore.set(snap);
	}

	function handleListSelection(id: string): void {
		if (id === CREATE_NEW_LIST_ID) {
			createNewModalVisible = true;
			return;
		}
		bookmarksRoute
			.setActiveList(id)
			.then(replayActiveWordSelection)
			.catch(() => {});
	}

	function handleSelectWord(data: { index: number; value: any }): void {
		bookmarksRoute.selectWord(data);
		sheetRef?.collapse();
	}

	function handleFilterFocus(event: FocusEvent): void {
		if (event.target instanceof HTMLInputElement && currentSnap === 'collapsed') {
			sheetRef?.openPartial();
		}
	}

	// Overflow menu
	let overflowOpen = $state(false);
	let overflowAnchorElement = $state<HTMLElement | undefined>(undefined);
	let overflowMenuStyle = $state('');

	function positionOverflowMenu(): void {
		if (!overflowAnchorElement) {
			return;
		}
		const rect = overflowAnchorElement.getBoundingClientRect();
		const rightOffset = window.innerWidth - rect.right;
		if (currentSnap === 'full') {
			overflowMenuStyle = `position:fixed; right:${rightOffset}px; top:${rect.bottom + OVERFLOW_MENU_OFFSET_PX}px;`;
		} else {
			overflowMenuStyle = `position:fixed; right:${rightOffset}px; bottom:${window.innerHeight - rect.top + OVERFLOW_MENU_OFFSET_PX}px;`;
		}
	}

	function toggleOverflowMenu(): void {
		overflowOpen = !overflowOpen;
		if (overflowOpen) {
			positionOverflowMenu();
		}
	}

	function closeOverflowMenu(): void {
		overflowOpen = false;
	}

	$effect(() => {
		if (overflowOpen) {
			const handleOutsideClick = () => closeOverflowMenu();
			setTimeout(
				() => document.addEventListener('click', handleOutsideClick, { once: true }),
				0
			);
			return () => document.removeEventListener('click', handleOutsideClick);
		}
		return undefined;
	});

	function importList(): void {
		closeOverflowMenu();
		bookmarksRoute.importList();
	}

	function exportActiveList(): void {
		closeOverflowMenu();
		bookmarksRoute.exportActiveList();
	}

	function deleteActiveList(): void {
		closeOverflowMenu();
		bookmarksRoute.confirmDeleteActiveList().catch(() => {});
	}

	// Create New List modal
	let createNewModalVisible = $state(false);
	let createNewButtonDisabled = $state(false);

	function closeNewModal(): void {
		createNewModalVisible = false;
		const input = document.getElementById('create-new-list-input') as HTMLInputElement | null;
		if (input) {
			input.value = '';
		}
		createNewButtonDisabled = false;
	}

	function createNewList(): void {
		createNewButtonDisabled = true;
		const input = document.getElementById('create-new-list-input') as HTMLInputElement | null;
		const newListName = input?.value.trim() ?? '';
		bookmarksRoute
			.createList(newListName)
			.then(() => {
				closeNewModal();
				return undefined;
			})
			.catch(() => {});
	}
</script>

<div class="mobile-bookmarks">
	<div class="mobile-bookmarks__content" use:scrollRestore={'mobile-bookmarks-content'}>
		{#if activeWord}
			<div class="mobile-bookmarks__dict-wrapper">
				<DictionaryContent word={activeWord} {lists} />
			</div>
		{:else}
			<div class="mobile-bookmarks__empty">
				<p>Select a word from your bookmarks</p>
			</div>
		{/if}
	</div>

	<SySnapSheet bind:this={sheetRef} onSnapChange={handleSnapChange}>
		<div class="mobile-bookmarks__header-row">
			<SyDropdown
				values={dropdownList}
				onselection={handleListSelection}
				direction={dropdownDirection}
				fixed={true}
			>
				{#snippet children(open)}
					<SyButton style="ghost" size="small">
						{activeList}&nbsp;
						{#if open}<ChevronUp size="16" />{:else}<ChevronDown size="16" />{/if}
					</SyButton>
				{/snippet}
			</SyDropdown>

			<div class="mobile-bookmarks__overflow-anchor" bind:this={overflowAnchorElement}>
				<SyButton style="ghost" size="small" onclick={toggleOverflowMenu}>
					<EllipsisVertical size="20" />
				</SyButton>
			</div>
		</div>

		<div
			class="mobile-bookmarks__results"
			onfocusin={handleFilterFocus}
			use:scrollRestore={'mobile-bookmarks-results'}
		>
			<SyList
				style="preview"
				values={wordList}
				filterable={true}
				onselection={handleSelectWord}
			/>
		</div>
	</SySnapSheet>
</div>

{#if overflowOpen}
	<div class="mobile-bookmarks__overflow-menu" style={overflowMenuStyle}>
		<button class="mobile-bookmarks__overflow-item" onclick={importList}>
			<FolderDown size="18" />
			<span>Import</span>
		</button>
		<button class="mobile-bookmarks__overflow-item" onclick={exportActiveList}>
			<FolderUp size="18" />
			<span>Export</span>
		</button>
		{#if activeList !== DEFAULT_BOOKMARKS_LIST}
			<button
				class="mobile-bookmarks__overflow-item mobile-bookmarks__overflow-item--danger"
				onclick={deleteActiveList}
			>
				<Trash2 size="18" />
				<span>Delete</span>
			</button>
		{/if}
	</div>
{/if}

<SyModal title="Create List" visible={createNewModalVisible} onclose={closeNewModal}>
	{#snippet body()}
		<div class="mobile-bookmarks__modal-content">
			<p>What would you like to call this list?</p>
			<SyTextInput
				size="large"
				placeholder={`ex. ${bookmarksRoute.getNewPlaceholder()}`}
				id="create-new-list-input"
			/>
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

<style>
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
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: calc(110px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.mobile-bookmarks__header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--sy-mobile-space--medium) var(--sy-mobile-space--small);
		gap: var(--sy-mobile-space--small);
		flex-shrink: 0;
	}

	.mobile-bookmarks__overflow-anchor {
		position: relative;
	}

	.mobile-bookmarks__overflow-menu {
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		border: var(--sy-mobile-surface-border);
		box-shadow: var(--sy-mobile-overlay-shadow);
		z-index: var(--sy-z-index--top-3);
		min-width: 150px;
		overflow: hidden;
	}

	.mobile-bookmarks__overflow-item {
		display: flex;
		align-items: center;
		gap: calc(var(--sy-mobile-space--extra-small) * 5);
		width: 100%;
		padding: calc(var(--sy-mobile-space--small) * 3) var(--sy-mobile-space--large);
		border: none;
		background: none;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-medium);
		color: var(--sy-color--grey-6);
		cursor: pointer;
	}

	.mobile-bookmarks__overflow-item:active {
		background-color: var(--sy-color--grey-1);
	}

	.mobile-bookmarks__overflow-item--danger {
		color: var(--sy-color--red);
	}

	.mobile-bookmarks__overflow-item:disabled {
		opacity: 0.35;
		pointer-events: none;
	}

	.mobile-bookmarks__results {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.mobile-bookmarks__modal-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
</style>
