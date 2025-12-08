<script>
    import {
    	ChevronLeftIcon,
    	ArrowLeftIcon,
    	ArrowRightIcon,
    	RotateCwIcon,
    	RotateCcwIcon,
    } from 'svelte-feather-icons';
    import SyButton from '../../components/SyButton/SyButton.svelte';
    import DictionaryContent from '../../components/DictionaryContent/DictionaryContent.svelte';
    import { querystring } from 'svelte-spa-router';
    import { handleError } from '../../utils';

    const EMPTY_LIST_MESSAGE = 'No flashcards in this list';
    const LOADING_LIST_MESSAGE = 'Loading...';
    let loading = true;

    const isMacos = window.platform === 'darwin';
    let activeList = undefined;
    let activeIndex = 0;
    let showDetails = false;
    let listContent = [];
    let params = new URLSearchParams($querystring);
    activeList = params.get('list');

    // Get the word lists
    let lists = [];
    window.bookmarkManager
    	.getLists()
    	.then((wl) => {
    		lists = wl;
    	})
    	.catch((e) => {
    		handleError(
    			'There was an error fetching word lists. Check the log for more details.',
    			e,
    		);
    	});

    const handleListChange = () => {
    	window.bookmarkManager
    		.getListContent(activeList)
    		.then((contents) => {
    			listContent = contents;
    			loading = false;
    		})
    		.catch((e) => {
    			handleError(
    				'There was an error fetching list content. Check the log for more details.',
    				e,
    			);
    		});
    };
    // Call `handleListChange` whenever `activeList` changes.
    $: handleListChange();

    let leftActions = [
    	{
    		icon: ChevronLeftIcon,
    		label: 'Exit',
    		disabled: false,
    		action: () => {
    			window.location.hash = '#/study';
    		},
    	},
    	{
    		icon: ArrowLeftIcon,
    		label: 'Previous',
    		disabled: activeIndex === 0,
    		action: () => {
    			activeIndex = activeIndex - 1;
    		},
    	},
    ];
    let rightActions = [
    	{
    		icon: RotateCwIcon,
    		label: 'Flip',
    		disabled: false,
    		action: () => {
    			showDetails = !showDetails;
    		},
    	},
    	{
    		icon: ArrowRightIcon,
    		label: 'Next',
    		disabled: activeIndex === listContent.length - 1,
    		action: () => {
    			activeIndex = activeIndex + 1;
    		},
    	},
    ];
    $: leftActions[1].disabled = activeIndex === 0;
    $: rightActions[1].disabled = activeIndex === listContent.length - 1;
    $: rightActions[0].icon = showDetails ? RotateCcwIcon : RotateCwIcon;
    $: activeIndex, (showDetails = false);
</script>

<div class="flashcard--container">
    <div
        class="flashcard--header"
        data-tauri-drag-region={isMacos ? true : undefined}
    >
        <div class="flashcard--header--section">
            {#each leftActions as action}
                <SyButton
                    disabled={action.disabled}
                    on:click={action.action}
                    style="ghost"
                    center={true}
                >
                    <svelte:component this={action.icon} />
                    &nbsp;
                    {action.label}
                </SyButton>
            {/each}
        </div>
        <div class="flashcard--header--section">
            {#each rightActions as action}
                <SyButton
                    disabled={action.disabled}
                    on:click={action.action}
                    style="ghost"
                    center={true}
                >
                    {action.label}
                    &nbsp;
                    <svelte:component this={action.icon} />
                </SyButton>
            {/each}
        </div>
    </div>
    <div class="flashcard--content">
        {#if showDetails}
            <div class="flashcard--back">
                <div class="flashcard--back--container">
                    <DictionaryContent
                        word={listContent[activeIndex]}
                        backgroundColor="white"
                        {lists}
                    />
                </div>
            </div>
        {:else}
            <div class="flashcard--front">
                {#if listContent.length > 0}
                    <h1>
                        {listContent[activeIndex]
                            .simplified}&nbsp;({listContent[activeIndex]
                            .traditional})
                    </h1>
                {:else}
                    <h1>
                        {loading ? LOADING_LIST_MESSAGE : EMPTY_LIST_MESSAGE}
                    </h1>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .flashcard--container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
    }
    .flashcard--header {
        display: flex;
        padding: var(--sy-space--extra-large) var(--sy-space--large);
        margin: 0;
        background-color: var(--sy-color--white);
        box-shadow: var(--sy-box-shadow);
        z-index: var(--sy-z-index--base-2);
        align-items: center;
        justify-content: space-between;
    }
    .flashcard--header--section {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
    .flashcard--content {
        display: flex;
        background-color: var(--sy-color--white);
        width: 100%;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: var(--sy-z-index--base-1);
    }
    .flashcard--front {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }
    .flashcard--front h1 {
        font-size: 10vh;
        font-weight: 200;
        margin-bottom: 83px;
    }
    .flashcard--back {
        margin: var(--sy-space--large) var(--sy-space--extra-large);
        width: 100%;
        display: flex;
        justify-content: center;
    }
    .flashcard--back--container {
        width: 100%;
        display: flex;
    }
</style>
