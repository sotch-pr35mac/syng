<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import type { WalkthroughId } from '@/types/walkthrough.js';
	const groups: { title: string; guides: { id: WalkthroughId; label: string }[] }[] = [
		{ title: 'Explore Syng', guides: [{ id: 'app', label: 'App tour' }] },
		{
			title: 'Dictionary and vocabulary',
			guides: [
				{ id: 'dictionary', label: 'Dictionary' },
				{ id: 'bookmarks', label: 'Bookmarks' },
			],
		},
		{
			title: 'Reader',
			guides: [
				{ id: 'reader-library', label: 'Importing and your library' },
				{ id: 'reader-document', label: 'Reading a document' },
			],
		},
		{
			title: 'Study',
			guides: [
				{ id: 'study', label: 'Choosing what to study' },
				{ id: 'flashcards', label: 'Flashcards' },
				{ id: 'quiz', label: 'Quizzes' },
			],
		},
	];
</script>

<section
	class="walkthrough-settings"
	aria-labelledby="walkthrough-settings-title"
	use:walkthroughTarget={'settings-walkthroughs'}
>
	<h2 id="walkthrough-settings-title">Walkthroughs</h2>
	<p>Explore the app or get help with one feature. Every guide is optional.</p>
	{#each groups as group (group.title)}
		<h3>{group.title}</h3>
		{#each group.guides as item (item.id)}
			{@const progress = walkthroughStore.preferences.guides[item.id]}
			<div class="walkthrough-settings__row">
				<span>{item.label}</span>
				<div>
					{#if progress?.status === 'in-progress'}
						<SyButton
							aria-label={`Resume ${item.label}`}
							size="small"
							style="ghost"
							onclick={() => walkthroughStore.start(item.id, {}, true)}
							>Resume</SyButton
						>
					{/if}
					<SyButton
						aria-label={`${progress ? 'Restart' : 'Start'} ${item.label}`}
						size="small"
						style="ghost"
						onclick={() => walkthroughStore.start(item.id)}
						>{progress ? 'Start again' : 'Start guide'}</SyButton
					>
				</div>
			</div>
		{/each}
	{/each}
</section>

<style>
	.walkthrough-settings {
		width: 100%;
		font-family: var(--sy-font-family);
		color: var(--sy-color--black);
	}
	h2 {
		font-size: var(--sy-font-size--large);
		margin: 0 0 var(--sy-space--large);
	}
	h3 {
		font-size: var(--sy-font-size);
		margin: var(--sy-space--extra-large) 0 var(--sy-space--medium);
	}
	p {
		font-size: var(--sy-font-size--small);
		line-height: 1.5;
	}
	.walkthrough-settings__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--medium);
		padding: var(--sy-space--medium) 0;
	}
	.walkthrough-settings__row > div {
		display: flex;
		flex-wrap: wrap;
	}
	.walkthrough-settings :global(button:focus-visible) {
		outline: 2px solid var(--sy-color--blue-2);
		outline-offset: 2px;
	}
	.walkthrough-settings :global(button) {
		min-height: 44px;
		font-size: var(--sy-font-size--small);
	}
</style>
