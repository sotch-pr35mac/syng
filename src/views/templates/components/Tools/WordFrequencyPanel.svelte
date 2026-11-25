<script lang="ts">
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { onMount, onDestroy } from 'svelte';
	import ToolProcessButton from '@/components/Tools/ToolProcessButton.svelte';
	import ToolPageHeader from '@/components/Tools/ToolPageHeader.svelte';
	import type { TextConversionToolVariant } from '@/types/textConversionTool.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import WordFrequencyCloud from '@/components/Tools/WordFrequencyCloud.svelte';
	import {
		frequencyTool,
		frequencyLevels,
		frequencyBreakdown,
		commonFrequencyWords,
	} from '@/composables/tools.svelte.js';
	import { toolsRoute } from '@/composables/toolsRoute.svelte.js';
	import { createDictionaryPopover } from '@/composables/dictionaryPopover.svelte.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import {
		HSK_VARIANTS,
		HSK_VARIANT_LABELS,
		type HskVariant,
	} from '@/types/dictionaryDisplay.js';
	const {
		variant: layoutVariant = 'desktop',
		draggableTitle = false,
		onBack,
	}: {
		variant?: TextConversionToolVariant;
		draggableTitle?: boolean;
		onBack: () => void;
	} = $props();
	const frequency = frequencyTool.state;
	const dictionary = createDictionaryPopover('tools');
	let trigger = $state<HTMLElement>();
	let showInfo = $state(false);
	let selectedWord = $state<string | null>(null);
	// Selection belongs to the open lookup and resets when the text is analyzed again.
	$effect(() => {
		void frequency.result;
		selectedWord = null;
	});
	const variant = $derived(frequency.hskVariant ?? HSK_VARIANTS.NONE);
	const entries = $derived(frequency.result?.entries ?? []);
	const visible = $derived(
		entries.filter(
			(entry) => !frequency.hideCommon || !commonFrequencyWords.includes(entry.text)
		)
	);
	const total = $derived(entries.reduce((sum, entry) => sum + entry.count, 0));
	const breakdown = $derived(frequencyBreakdown(entries, variant));
	const outdated = $derived(
		Boolean(frequency.result && frequency.input !== frequency.analyzedInput)
	);
	onMount(() => frequencyTool.initialize());
	onDestroy(() => dictionary.close());
	function openWord(event: MouseEvent, text: string) {
		selectedWord = text;
		trigger = event.currentTarget as HTMLElement;
		void dictionary.lookup({ text, exactOnly: true, anchor: trigger.getBoundingClientRect() });
	}
	function closeDictionary() {
		selectedWord = null;
		dictionary.close();
	}
	function copyList() {
		const lines = [
			`Word\tCount\t% of words\t${HSK_VARIANT_LABELS[variant]}`,
			...visible.map(
				(entry) =>
					`${entry.text}\t${entry.count}\t${((entry.count / total) * 100).toFixed(1)}%\t${variant === HSK_VARIANTS.NONE ? '' : frequencyLevels(entry, variant).join(', ') || 'Not listed'}`
			),
		];
		void toolsRoute.copyText(lines.join('\n'));
	}
</script>

<section class="frequency" aria-labelledby="frequency-heading">
	<ToolPageHeader
		label="Word Frequency"
		headingId="frequency-heading"
		collapsed={frequency.collapsed}
		variant={layoutVariant}
		{draggableTitle}
		{onBack}
		onInfo={() => (showInfo = true)}
		onToggleCollapse={() => (frequency.collapsed = !frequency.collapsed)}
	/>
	{#if !frequency.collapsed}
		<textarea
			id="frequency-heading-input"
			aria-label="Word Frequency input"
			placeholder="Paste Chinese text to explore its words."
			value={frequency.input}
			oninput={(event) => frequencyTool.setInput(event.currentTarget.value)}
			spellcheck="false"
			autocapitalize="off"
		></textarea>
		<div class="actions">
			<ToolProcessButton
				variant={layoutVariant}
				onProcess={() => frequencyTool.analyze()}
				disabled={frequency.busy || !frequency.input.trim()}
				label={frequency.busy ? 'Analyzing…' : 'Analyze'}
			/>
		</div>
	{/if}
	<div role="status" aria-live="polite">
		{#if frequency.error}<p>{frequency.error}</p>{:else if frequency.busy}<p>
				Analyzing Chinese words…
			</p>{:else if outdated}<p>Text changed. Analyze again to update these results.</p>{/if}
	</div>
	{#if frequency.result}
		<div class="results" aria-busy={frequency.busy}>
			<div class="overview">
				<div class="visual">
					<div class="toolbar">
						<h2>Frequent words</h2>
						<label
							><input
								type="checkbox"
								bind:checked={frequency.hideCommon}
								onchange={() => (frequency.visibleRows = 50)}
							/> Hide common words</label
						>
					</div>
					{#if visible.length}<WordFrequencyCloud
							entries={visible}
							{selectedWord}
							onopen={openWord}
						/>{:else}<p class="empty">
							{total
								? 'All recognized words are hidden by the common-word filter.'
								: 'No Chinese words were recognized. Try another passage.'}
						</p>{/if}
				</div>
				<aside aria-label="Text statistics">
					<h2>Text statistics</h2>
					<dl>
						<div>
							<dt>Characters</dt>
							<dd>{frequency.result.chinese_characters.toLocaleString()}</dd>
						</div>
						<div>
							<dt>Total words</dt>
							<dd>{total.toLocaleString()}</dd>
						</div>
						<div>
							<dt>Unique words</dt>
							<dd>{entries.length.toLocaleString()}</dd>
						</div>
						<div>
							<dt>Used once</dt>
							<dd>
								{entries
									.filter((entry) => entry.count === 1)
									.length.toLocaleString()}
							</dd>
						</div>
						<div>
							<dt>Unmatched characters</dt>
							<dd>{frequency.result.unmatched_characters.toLocaleString()}</dd>
						</div>
					</dl>
					<label class="dataset"
						>HSK version<select
							value={variant}
							onchange={(event) =>
								(frequency.hskVariant = event.currentTarget.value as HskVariant)}
							>{#each Object.entries(HSK_VARIANT_LABELS) as [value, label] (value)}<option
									{value}>{label}</option
								>{/each}</select
						></label
					>
					{#if variant !== HSK_VARIANTS.NONE}
						<h3>HSK breakdown</h3>
						<p class="caption">Share of all words</p>
						<ul class="levels">
							{#each breakdown as row (row.level)}<li>
									<div>
										<span
											>{row.level === 'Not listed'
												? row.level
												: `HSK ${row.level}`}</span
										><span
											>{(total ? (row.occurrences / total) * 100 : 0).toFixed(
												1
											)}%</span
										>
									</div>
									<div class="track" aria-hidden="true">
										<span
											style:width={`${total ? (row.occurrences / total) * 100 : 0}%`}
										></span>
									</div>
								</li>{/each}
						</ul>
					{/if}
				</aside>
			</div>
			<p class="caption">Counts include hidden words. Only Chinese text is counted.</p>
			<div class="toolbar">
				<h2>Word list</h2>
				<SyButton style="ghost" disabled={!visible.length} onclick={copyList}
					>Copy list</SyButton
				>
			</div>
			<div class="table-wrap">
				<table>
					<thead
						><tr
							><th>Word</th><th>Count</th><th>% of words</th
							>{#if variant !== HSK_VARIANTS.NONE}<th>HSK</th>{/if}</tr
						></thead
					><tbody
						>{#each visible.slice(0, frequency.visibleRows) as entry (entry.text)}<tr
								><td
									><button
										class="word"
										onclick={(event) => openWord(event, entry.text)}
										><ChineseCharacters
											characters={entry.text}
											tones={entry.tones}
											colorByTone={dictionaryDisplaySettingsStore.settings
												.colorCharactersByTone}
										/></button
									></td
								><td>{entry.count}</td><td
									>{((entry.count / total) * 100).toFixed(1)}%</td
								>{#if variant !== HSK_VARIANTS.NONE}<td
										>{frequencyLevels(entry, variant).join(', ') ||
											'Not listed'}</td
									>{/if}</tr
							>{/each}</tbody
					>
				</table>
			</div>
			{#if visible.length > frequency.visibleRows}<SyButton
					onclick={() => (frequency.visibleRows += 50)}>Show more</SyButton
				>{/if}
		</div>
	{:else if !frequency.busy}
		<p class="empty">Paste Chinese text to see word counts and HSK levels.</p>
	{/if}
</section>
<SyModal title="Word Frequency" visible={showInfo} onclose={() => (showInfo = false)}>
	{#snippet body()}<p class="help">
			Word Frequency counts Chinese words and shows how often they appear. Select a word to
			look it up. The HSK breakdown uses each word’s lowest listed level.
		</p>{/snippet}
</SyModal>
<DictionaryPopover
	returnFocus={trigger}
	word={dictionary.word}
	results={dictionary.results}
	resultIndex={dictionary.resultIndex}
	anchor={dictionary.anchor}
	reopenKey={dictionary.reopenKey}
	lists={bookmarksStore.lists}
	onselect={dictionary.select}
	onclose={closeDictionary}
	onlink={dictionary.lookup}
/>

<style>
	/* Dictionary characters are selectable elsewhere; here they are word buttons. */
	.frequency :global(button .sy-text--selectable) {
		cursor: inherit;
	}
	.frequency,
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		min-width: 0;
	}
	.toolbar,
	.actions {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		flex-wrap: wrap;
	}
	.toolbar {
		justify-content: space-between;
	}
	h2 {
		font-size: var(--sy-font-size--medium);
		margin: 0;
	}
	h3 {
		font-size: var(--sy-font-size--small);
		margin: 20px 0 5px;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 150px;
		resize: vertical;
		padding: 15px;
		font: inherit;
		color: var(--sy-color--black);
		background: var(--sy-color--white);
		border: var(--sy-border);
		border-radius: 5px;
	}
	textarea:focus-visible,
	select:focus-visible,
	.word:focus-visible {
		outline: 2px solid var(--sy-text--blue);
		outline-offset: 2px;
	}
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		gap: 30px;
	}
	.visual {
		min-width: 0;
	}
	aside {
		border-left: var(--sy-border);
		padding-left: 20px;
	}
	dl {
		margin: 15px 0 20px;
	}
	dl > div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin: 9px 0;
		font-size: var(--sy-font-size--small);
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.dataset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: var(--sy-font-size--small);
	}
	select {
		font: inherit;
		color: var(--sy-color--black);
		background: var(--sy-color--white);
		padding: 8px;
		border: var(--sy-border);
		border-radius: 5px;
		max-width: 100%;
		min-height: 44px;
	}
	.caption {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		margin: 0;
	}
	.levels {
		list-style: none;
		padding: 0;
		margin: 10px 0;
	}
	.levels li {
		margin: 10px 0;
		font-size: var(--sy-font-size--small);
	}
	.levels li > div:first-child {
		display: flex;
		justify-content: space-between;
	}
	.track {
		height: 3px;
		background: var(--sy-color--grey-2);
		margin-top: 5px;
	}
	.track span {
		display: block;
		height: 100%;
		background: var(--sy-text--blue);
	}
	.toolbar label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--sy-font-size--small);
		min-height: 44px;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--sy-font-size--small);
	}
	th,
	td {
		text-align: right;
		padding: 8px;
		border-bottom: var(--sy-border);
		font-variant-numeric: tabular-nums;
	}
	th:first-child,
	td:first-child {
		text-align: left;
	}
	.word {
		border: 0;
		background: transparent;
		color: var(--sy-text--blue);
		font: inherit;
		font-size: var(--sy-font-size--large);
		min-height: 44px;
		padding: 0 8px;
		cursor: pointer;
	}
	.empty {
		padding: 30px 0;
		max-width: 40rem;
		line-height: 1.7;
		color: var(--sy-text--muted);
	}
	.help {
		max-width: 32rem;
		line-height: 1.6;
	}
	.frequency {
		container-type: inline-size;
	}
	@container (max-width: 740px) {
		.overview {
			grid-template-columns: minmax(0, 1fr);
			gap: 25px;
		}
		aside {
			border-left: 0;
			border-top: var(--sy-border);
			padding: 20px 0 0;
		}
	}
</style>
