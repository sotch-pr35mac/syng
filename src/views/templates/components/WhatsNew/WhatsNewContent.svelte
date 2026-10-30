<script lang="ts">
	import { onMount } from 'svelte';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { push } from 'svelte-spa-router';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { whatsNewStore } from '@/stores/whatsNew.svelte.js';
	import { releaseContent } from '@/components/WhatsNew/whatsNewContent.js';
	import { compareReleaseVersions, releasesInRange } from '@/utils/whatsNew.js';
	import { isIos, isMobile } from '@/utils/device.js';
	import type { ReleaseContent } from '@/types/whatsNew.js';

	const HIGHLIGHT_ICON_SIZE = 22;
	const { onready }: { onready: () => void } = $props();
	const variant = isMobile() ? 'mobile' : 'desktop';
	const range = whatsNewStore.range!;
	const available = releaseContent.filter(
		(release) => !release.platforms || release.platforms.includes(whatsNewStore.platform)
	);
	const releases = releasesInRange(available, range);
	const latest = releases[0];
	const cumulative = releases.slice(1);
	const older = available
		.filter(
			(release) =>
				compareReleaseVersions(release.version, range.to) < 0 && !releases.includes(release)
		)
		.sort((left, right) => compareReleaseVersions(right.version, left.version));
	let expanded = $state(whatsNewStore.expanded);
	const identifier = $props.id();

	onMount(() => {
		onready();
		if (releases.length) {
			void whatsNewStore.markPresented();
		}
	});

	function toggleMore(): void {
		expanded = !expanded;
		whatsNewStore.expanded = expanded;
	}

	function feedbackUrl(feedback: NonNullable<ReleaseContent['feedback']>): string {
		const query = feedback.subject ? `?subject=${encodeURIComponent(feedback.subject)}` : '';
		return `mailto:${feedback.email}${query}`;
	}

	function openFeedbackEmail(
		event: MouseEvent,
		feedback: NonNullable<ReleaseContent['feedback']>
	): void {
		event.preventDefault();
		const url = feedbackUrl(feedback);
		openUrl(url).catch(() => {
			window.open(url, '_blank', 'noopener,noreferrer');
		});
	}
</script>

{#snippet releaseNotes(release: ReleaseContent, archived = false)}
	<article>
		{#if archived}<h2 class="release-version">Syng {release.version}</h2>{/if}
		<ul class="highlights" role="list">
			{#each release.highlights.filter((highlight) => !highlight.platforms || highlight.platforms.includes(whatsNewStore.platform)) as highlight (highlight.title)}
				<li class="highlight">
					<span class="highlight__icon" aria-hidden="true">
						{#if highlight.icon}<highlight.icon
								size={HIGHLIGHT_ICON_SIZE}
							/>{:else}•{/if}
					</span>
					<div class="highlight__body">
						<svelte:element this={archived ? 'h3' : 'h2'} class="highlight__title"
							>{highlight.title}</svelte:element
						>
						<p>{highlight.body}</p>
						{#if highlight.credit}<p class="highlight__credit">
								{highlight.credit}
							</p>{/if}
						{#if highlight.component}
							<div class="highlight__control">
								<highlight.component {variant} source="whats_new" />
								{#if highlight.controlHint}<p class="highlight__hint">
										{highlight.controlHint}
									</p>{/if}
							</div>
						{/if}
						{#if highlight.action}
							<SyButton
								size="large"
								onclick={() => {
									whatsNewStore.action(
										highlight.action!.section,
										highlight.action!.setting
									);
									const parameters = new URLSearchParams({
										section: highlight.action!.section,
										from: 'whats-new',
										...(highlight.action!.setting
											? { setting: highlight.action!.setting }
											: {}),
									});
									void push(`/settings?${parameters}`);
								}}>{highlight.action.label}</SyButton
							>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		{#if release.feedback && !archived}
			<p class="release-feedback">
				{release.feedback.prompt} Email me at
				<a
					href={feedbackUrl(release.feedback)}
					onclick={(event) => openFeedbackEmail(event, release.feedback!)}
					>{release.feedback.email}</a
				>
				{release.feedback.outcome}
			</p>
		{/if}
		{#if release.improvements.length}
			{#if !archived}
				<div class="improvements-toggle">
					<SyButton
						style="ghost"
						size="large"
						aria-expanded={expanded}
						aria-controls={`${identifier}-${release.version}`}
						onclick={toggleMore}
					>
						{expanded ? 'Hide other improvements' : 'Other improvements'}
					</SyButton>
				</div>
			{/if}
			{#if archived || expanded}
				<ul class="improvements" id={`${identifier}-${release.version}`}>
					{#each release.improvements.filter((item) => !item.platform || isIos()) as item (item.text)}
						<li>{item.text}</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</article>
{/snippet}

{#if latest}
	{@render releaseNotes(latest)}
{:else}
	<p>No release notes are available for this version yet.</p>
{/if}
{#if cumulative.length}
	<details ontoggle={(event) => whatsNewStore.disclose('cumulative', event.currentTarget.open)}>
		<summary>Also new since your last version</summary>
		{#each cumulative as release (release.version)}
			{@render releaseNotes(release, true)}
		{/each}
	</details>
{/if}
{#if older.length}
	<details ontoggle={(event) => whatsNewStore.disclose('earlier', event.currentTarget.open)}>
		<summary>Earlier releases</summary>
		{#each older as release (release.version)}
			{@render releaseNotes(release, true)}
		{/each}
	</details>
{/if}

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}
	article + article,
	details {
		margin-top: var(--sy-space--extra-large);
	}
	.release-version {
		font-size: var(--sy-font-size--medium);
		margin: 0;
		color: var(--sy-text--muted);
	}
	.highlights {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		padding: 0;
		margin: 0;
		list-style: none;
	}
	:global(.whats-new--mobile) .highlights {
		gap: var(--sy-mobile-space--large);
	}
	.highlight {
		display: flex;
		align-items: flex-start;
		gap: var(--sy-space--large);
	}
	.highlight__icon {
		display: flex;
		flex: 0 0 22px;
		justify-content: center;
		color: var(--sy-text--blue);
	}
	.highlight__body {
		flex: 1;
		min-width: 0;
	}
	.highlight__title {
		font-size: var(--sy-font-size--medium);
		line-height: 1.375;
		margin: 0;
	}
	p {
		margin: var(--sy-space) 0 0;
		font-size: var(--sy-font-size--mobile-small);
	}
	.highlight__control {
		margin-top: var(--sy-space--large);
	}
	.highlight__control :global(.increase-contrast-settings > label) {
		flex-basis: auto;
	}
	.highlight__hint {
		color: var(--sy-text--muted);
	}
	.highlight__credit {
		color: var(--sy-text--muted);
	}
	.release-feedback {
		margin: 0 0 0 calc(22px + var(--sy-space--large));
	}
	.release-feedback a {
		color: var(--sy-text--blue);
	}
	.improvements-toggle {
		display: flex;
		justify-content: center;
	}
	.improvements {
		font-size: var(--sy-font-size--mobile-small);
		margin: 0;
		padding-left: var(--sy-space--extra-large);
	}
	.improvements li + li {
		margin-top: var(--sy-space--large);
	}
	summary {
		cursor: pointer;
		padding-block: var(--sy-space--large);
	}
	:global(.whats-new) :global(.sy-button) {
		margin-inline: 0;
	}
</style>
