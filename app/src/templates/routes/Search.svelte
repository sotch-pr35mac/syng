<script>
	import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
	import SyButton from '../components/SyButton/SyButton.svelte';
	import SyTextInput from '../components/SyTextInput/SyTextInput.svelte';
	import SyList from '../components/SyList/SyList.svelte';
	import {
		ChevronLeftIcon,
		ChevronRightIcon
	} from 'svelte-feather-icons';

	const searchResults = [
		{
			headline: '你好',
			subtitle: 'nihao',
			content: 'Hello; How are you?; What up?',
			active: false
		},
		{
			headline: '人山人海',
			subtitle: 'renshanrenhai',
			content: 'People mountain people sea',
			active: true
		},
		{
			headline: '浇水',
			subtitle: 'jiaoshui',
			content: 'To water plants',
			active: false
		},
		{
			headline: '大象',
			subtitle: 'daxiang',
			content: 'Elephant',
			active: false
		}
	];

    const enableDrag = process.platform === 'darwin';
</script>

<style>
.search-page-container {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100%;
}
.search-bar-container {
	display: flex;
	padding: var(--sy-space--extra-large) var(--sy-space--large);
	margin: 0;
	background-color: var(--sy-color--white);
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05);
	z-index: 3;
	align-items: center;
}
.search-bar--container--macos {
    -webkit-app-region: drag;
}
.search-content-container {
	display: flex;
}
.search-results {
	display: flex;
	flex: 2;
	max-width: fit-content;
	z-index: 1;
	flex-direction: column;
    background-color: var(--sy-color--white);
}

/* TODO: Consider moving some of the following styles to the component file itself */
.dictionary-content {
	display: flex;
	flex: 9;
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
	height: calc(100vh - 83px);
	z-index: 2;
}
</style>

<div class="search-page-container">
	<div class="search-bar-container" class:search-bar--container--macos={enableDrag}>
		<SyButton style="ghost" size="large">
			<ChevronLeftIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large">
			<ChevronRightIcon size="20" />
		</SyButton>
		<SyButton style="ghost" size="large">
			EN
		</SyButton>
		<SyTextInput style="ghost" size="large" placeholder="Search..." />
	</div>
	<div class="search-content-container">
		<div class="search-results">
			<SyList style="preview" values="{searchResults}" />
		</div>
		<div class="dictionary-content">
			<DictionaryContent></DictionaryContent>
		</div>
	</div>
</div>
