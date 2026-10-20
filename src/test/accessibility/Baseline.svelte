<script lang="ts">
	// Keep this fixture compatible with the original component contracts so an
	// archived checkout can provide a visual reference without being modified.
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyTag from '@/components/SyTag/SyTag.svelte';
</script>

<main>
	<h1>Syng shared controls</h1>
	<div class="controls">
		<SyButton>Open dialog</SyButton><SyButton style="ghost">Ghost action</SyButton>
		<SyButton>?</SyButton><SyButton>Actions</SyButton>
		<SyToggle accessibleLabel="Color tones" checked={true} />
		<label>Search<SyTextInput placeholder="Find a word" /></label>
	</div>
	<p></p>
	<div><SyTab active={true}>General</SyTab><SyTab>Reader</SyTab></div>
	<section>
		<p>Application controls follow system text preferences.</p>
		<p class="muted">Supporting text stays readable in both themes.</p>
		<div class="controls">
			{#each ['blue', 'green', 'yellow', 'red'] as variant}
				<SyTag variant={variant as 'blue' | 'green' | 'yellow' | 'red'}>{variant}</SyTag>
			{/each}
		</div>
	</section>
	<div class="panes">
		<section>
			<h2>Results</h2>
			<p>Selected word</p>
		</section>
		<section>
			<h2>Dictionary</h2>
			<p>A longer definition that wraps when system text is enlarged.</p>
		</section>
	</div>
</main>

<style>
	:global(body) {
		overflow: auto;
	}
	main {
		padding: 1.5rem;
		max-width: 64rem;
		margin: auto;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		max-width: 100%;
	}
	.muted {
		color: var(--sy-color--grey-4);
	}
	.panes {
		display: grid;
		grid-template-columns: 2fr 9fr;
		gap: 1rem;
	}
</style>
