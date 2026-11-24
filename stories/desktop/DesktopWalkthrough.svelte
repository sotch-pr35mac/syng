<script lang="ts">
	import WalkthroughSettings from '@/components/Walkthrough/WalkthroughSettings.svelte';
	import WalkthroughHelp from '@/components/Walkthrough/WalkthroughHelp.svelte';

	type Sample = 'settings' | 'help';
	const { sample }: { sample: Sample } = $props();
	let notice = $state('');

	function interceptGuideLaunch(event: MouseEvent): void {
		const button = (event.target as Element).closest('button');
		if (!button) {
			return;
		}
		const label = button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '';
		if (sample === 'help' || /^(Start|Resume|Replay) /.test(label)) {
			event.preventDefault();
			event.stopPropagation();
			notice = 'Tour launch is available in the installed app.';
		}
	}

	function guardGuideLaunch(node: HTMLElement) {
		node.addEventListener('click', interceptGuideLaunch, true);
		return {
			destroy: () => node.removeEventListener('click', interceptGuideLaunch, true),
		};
	}
</script>

<main class="catalog">
	<header>
		<p class="eyebrow">Desktop · walkthrough</p>
		<h1>{sample === 'settings' ? 'Guide picker' : 'Contextual help'}</h1>
		<p>
			{sample === 'settings'
				? 'The real Settings walkthrough row. Choose a guide to inspect its dropdown and action label.'
				: 'The real help entry shown alongside a feature before its guide is completed.'}
		</p>
		<p class="note">Starting a tour is disabled in this isolated catalog.</p>
	</header>
	<section class="stage" use:guardGuideLaunch>
		{#if sample === 'settings'}
			<WalkthroughSettings />
		{:else}
			<div class="help-example">
				<span>Dictionary links</span>
				<WalkthroughHelp guide="dictionary" label="Show me how this works" />
			</div>
		{/if}
	</section>
	{#if notice}<p class="feedback" role="status">{notice}</p>{/if}
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(950px, 100vw);
		min-height: 100vh;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		color: var(--sy-color--black);
	}
	.eyebrow {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 6px 0 8px;
		font-size: var(--sy-font-size--heading);
	}
	header > p:not(.eyebrow) {
		max-width: 660px;
		line-height: var(--sy-line-height--body);
	}
	.note {
		color: var(--sy-text--muted);
	}
	.stage {
		--settings-row-columns: 11rem minmax(0, 1fr);
		box-sizing: border-box;
		width: min(700px, 100%);
		margin-top: 28px;
		padding: var(--sy-space--extra-large);
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	.help-example {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
	}
	.feedback {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
	}
	@media (max-width: 680px) {
		.catalog {
			padding: 24px 20px 60px;
		}
		.help-example {
			flex-wrap: wrap;
		}
	}
</style>
