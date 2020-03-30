<script>
	import DictionaryContent from '../components/DictionaryContent/DictionaryContent.svelte';
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
	width: 100%;
	padding: var(--sy-space--extra-large) var(--sy-space--large);
	margin: 0;
	background-color: var(--sy-color--white);
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05);
	z-index: 3;
}
.search-content-container {
	display: flex;
}
.search-results {
	display: flex;
	flex: 2;
	z-index: 1;
}

/* TODO: Consider moving some of the following styles to the component file itself */
.dictionary-content {
	display: flex;
	flex: 9;
	box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
	height: 100vh;
	z-index: 2;
}
</style>

<div class="search-page-container">
	<div class="search-bar-container">
		Search Bar
	</div>
	<div class="search-content-container">
		<div class="search-results">
		</div>
		<div class="dictionary-content">
			<DictionaryContent></DictionaryContent>
		</div>
	</div>
</div>
