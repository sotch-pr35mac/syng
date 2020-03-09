<script>
	const navigation = [
		'search',
		'read',
		'bookmarks',
		'study',
		'chat',
		'tools',
		'help',
		'settings'
	];

	function capitalize(word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}
</script>

<div>
	<ul>
	{#each navigation as link}
		<li><a href="#/{link}">{capitalize(link)}</a></li>
	{/each}
	</ul>
</div>
