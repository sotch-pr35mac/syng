<script>
	import { ChevronDown, ChevronUp, FolderDown, Trash2, FolderUp } from 'lucide-svelte';
	import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
	import SyButton from '../components/SyButton/SyButton.svelte';
	import SyDropdown from '../components/SyDropdown/SyDropdown.svelte';
	import SyList from '../components/SyList/SyList.svelte';
	import SyModal from '../components/SyModal/SyModal.svelte';
	import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
	import { onMount, tick } from 'svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import { scrollRestore } from '../actions/scrollRestore.svelte.js';
	import {
		bookmarksRoute,
		CREATE_NEW_LIST_ID,
		DEFAULT_BOOKMARKS_LIST,
	} from '../composables/bookmarks.svelte.js';
	import { isIPad } from '../utils/device.js';

	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();

	const activeList = $derived(bookmarksRoute.activeList);
	const activeWord = $derived(bookmarksRoute.activeWord);
	const lists = $derived(bookmarksRoute.lists);
	const dropdownList = $derived(bookmarksRoute.dropdownList);
	const wordList = $derived(bookmarksRoute.wordList);

	// SyList tracks its selected item via click events internally, so the only way to
	// restore a persisted selection is to programmatically click the corresponding element.
	const selectWordElement = (index) => {
		const container = document.querySelector('.bookmarks--word-listing');
		if (!container) {
			return;
		}
		const elements = container.getElementsByClassName('sy-list-preview-item-container');
		if (elements[index]) {
			elements[index].click();
		}
	};
	const replayActiveWordSelection = () => {
		if (!activeWord) {
			return;
		}
		const activeWordIndex = bookmarksRoute.words.findIndex(
			(word) => word.hash === activeWord.hash
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
	});

	// Handle active list selection
	const handleListSelection = (id) => {
		if (id === CREATE_NEW_LIST_ID) {
			createNewModalVisible = true;
			return;
		}
		highlightActive = false;
		bookmarksRoute
			.setActiveList(id)
			.then(replayActiveWordSelection)
			.catch(() => {});
	};

	// Create New Modal
	let createNewModalVisible = $state(false);
	let createNewButtonDisabled = $state(false);
	const closeNewModal = () => {
		createNewModalVisible = false;
		document.getElementById('create-new-list-input').value = '';
		createNewButtonDisabled = false;
	};
	const createNewList = () => {
		createNewButtonDisabled = true;
		const newListName = document.getElementById('create-new-list-input').value.trim();
		bookmarksRoute
			.createList(newListName)
			.then(() => {
				closeNewModal();
				return undefined;
			})
			.catch(() => {});
	};

	// Word Selection
	const handleSelection = (data) => {
		bookmarksRoute.selectWord(data);
		highlightActive = true;
	};
	let highlightActive = $state(true);

	// Actions
	let disableDeleteButton = $state(false);
	const deleteActiveList = () => {
		disableDeleteButton = true;
		bookmarksRoute
			.confirmDeleteActiveList()
			.then((deleted) => {
				if (deleted) {
					highlightActive = false;
				}
				disableDeleteButton = false;
				return undefined;
			})
			.catch(() => {
				disableDeleteButton = false;
			});
	};
	const exportActiveList = () => bookmarksRoute.exportActiveList();
	const importList = () => bookmarksRoute.importList();

	const actions = $derived([
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

<div class="bookmarks--container">
	<div
		class="bookmarks--header"
		class:bookmarks--header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<SyDropdown values={dropdownList} onselection={handleListSelection}>
			{#snippet children(open)}
				<SyButton size="large" style="ghost" center={true}>
					{activeList}&nbsp;
					{#if open}<ChevronUp size="20" />{:else}<ChevronDown size="20" />{/if}
				</SyButton>
			{/snippet}
		</SyDropdown>
		<div class="bookmarks--header--actions">
			{#each actions as action (action.tooltip)}
				{#if !action.exclude.includes(activeList)}
					<span class="bookmarks--header--action-item">
						<SyButton
							style="ghost"
							onclick={action.action}
							disabled={action.disabled}
							hover={action.hover}
							classes={['sy-tooltip--container']}
						>
							<action.icon size="20" />
							<div class="sy-tooltip--body sy-tooltip--body-bottom">
								<p>{action.tooltip}</p>
							</div>
						</SyButton>
					</span>
				{/if}
			{/each}
		</div>
	</div>
	<div class="bookmarks--content">
		<div
			class="bookmarks--word-listing"
			data-elastic
			use:scrollRestore={'bookmarks-word-listing'}
		>
			<SyList
				style="preview"
				values={wordList}
				highlight={highlightActive}
				onselection={handleSelection}
				filterable={true}
			/>
		</div>
		<div class="dictionary-content">
			<DictionaryContent word={activeWord} {lists} />
		</div>
	</div>
	<SyModal title="Create List" visible={createNewModalVisible} onclose={closeNewModal}>
		{#snippet body()}
			<div class="bookmarks-modal-content">
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
</div>

<style>
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
	}
	.bookmarks--header--ipad {
		padding-top: var(--sy-space--large);
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
	/* TODO: Move this to componenet before merging */
	.dictionary-content {
		display: flex;
		flex: 9;
		box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
		height: 100%;
		z-index: var(--sy-z-index--base-1);
	}
</style>
