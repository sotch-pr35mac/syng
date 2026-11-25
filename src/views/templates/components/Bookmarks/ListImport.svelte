<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { invoke } from '@tauri-apps/api/core';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import type {
		ImportedList,
		PlecoPreview,
		SyngListArchive,
		ListImportPreview,
	} from '@/types/bookmarks.js';

	const {
		visible = false,
		onclose,
		onsyng,
		onimported,
	}: {
		visible?: boolean;
		onclose: () => void;
		onsyng: (archive: SyngListArchive) => Promise<boolean>;
		onimported: (name: string) => Promise<void>;
	} = $props();
	let stage = $state<'file' | 'syng' | 'review' | 'done'>('file');
	let preview = $state<PlecoPreview | null>(null);
	let archive = $state<SyngListArchive | null>(null);
	let choices = $state<Record<string, string>>({});
	let destinations = $state<Record<string, { id: string; name: string }>>({});
	let busy = $state(false);
	let error = $state('');
	let savingStarted = $state(false);
	let reviewIndex = $state(0);
	const uniqueRows = $derived(
		preview ? [...new SvelteMap(preview.rows.map((row) => [row.original, row])).values()] : []
	);
	const reviewRows = $derived(uniqueRows.filter((row) => !row.selected && row.candidates.length));
	const current = $derived(reviewRows[reviewIndex]);
	const undecided = $derived(
		reviewRows.filter((row) => choices[row.original] === undefined).length
	);
	const skipped = $derived(uniqueRows.filter((row) => choices[row.original] === '').length);
	const ready = $derived(uniqueRows.length - skipped - undecided);
	const lists = $derived.by((): ImportedList[] => {
		const groups = new SvelteMap<string, Set<string>>();
		for (const row of preview?.rows ?? []) {
			const lexicalId = choices[row.original];
			if (!lexicalId) {
				continue;
			}
			if (!groups.has(row.category)) {
				groups.set(row.category, new SvelteSet());
			}
			groups.get(row.category)!.add(lexicalId);
		}
		return [...groups].map(([category, lexicalIds]) => ({
			...destinations[category],
			lexicalIds: [...lexicalIds],
		}));
	});
	const report = $derived(
		preview
			? `Pleco import: ${preview.file_name}\n\n` +
					preview.rows
						.filter((row) => !choices[row.original])
						.map(
							(row) =>
								`Line ${row.line} — ${row.category}\n${row.original}\n${row.candidates.length ? 'Skipped by user.' : row.reason}\n`
						)
						.join('\n')
			: ''
	);

	function close() {
		if (busy) {
			return;
		}
		stage = 'file';
		archive = null;
		preview = null;
		choices = {};
		destinations = {};
		error = '';
		savingStarted = false;
		reviewIndex = 0;
		onclose();
	}
	async function chooseFile() {
		busy = true;
		error = '';
		try {
			const detected = await invoke<ListImportPreview | null>(
				NATIVE_COMMANDS.BOOKMARKS.PREPARE_IMPORT
			);
			if (!detected) {
				return;
			}
			if (detected.format === 'syng') {
				archive = detected.archive;
				stage = 'syng';
				return;
			}
			const result = detected.preview;
			await bookmarksStore.refresh();
			const names = new SvelteSet(bookmarksStore.lists);
			const reserved: Record<string, { id: string; name: string }> = Object.create(null);
			const selected: Record<string, string> = Object.create(null);
			for (const row of result.rows) {
				if (!reserved[row.category]) {
					let name = row.category;
					let suffix = 2;
					while (names.has(name) || name === 'create-new') {
						name = `${row.category} ${suffix++}`;
					}
					names.add(name);
					reserved[row.category] = { id: crypto.randomUUID(), name };
				}
				if (row.selected) {
					selected[row.original] = row.selected;
				} else {
					selected[row.original] = row.candidates.length ? undefined : '';
				}
			}
			destinations = { ...reserved };
			choices = { ...selected };
			preview = result;
			stage = 'review';
		} catch (failure) {
			error =
				typeof failure === 'string'
					? failure
					: 'Could not prepare the import. Please try again.';
		} finally {
			busy = false;
		}
	}
	async function saveSyng() {
		if (busy || !archive) {
			return;
		}
		busy = true;
		error = '';
		try {
			if (await onsyng(archive)) {
				busy = false;
				close();
			} else {
				error =
					'The import did not finish. Some words may already be saved. Check your lists before importing again.';
			}
		} catch {
			error = 'Could not import the list. Please try again.';
		} finally {
			busy = false;
		}
	}
	async function save() {
		if (busy || undecided || !lists.length) {
			return;
		}
		savingStarted = true;
		busy = true;
		error = '';
		try {
			await bookmarksStore.importLists(lists);
			stage = 'done';
			try {
				await onimported(lists[0].name);
			} catch {
				error = 'Lists were saved, but could not be opened. Select them from Bookmarks.';
			}
		} catch (failure) {
			error =
				'The import did not finish. Some lists or words may already be saved. Retry uses the same lists. ' +
				(failure instanceof Error ? failure.message : 'Please try again.');
		} finally {
			busy = false;
		}
	}
	async function exportReport(copy: boolean) {
		error = '';
		try {
			if (copy) {
				await navigator.clipboard.writeText(report);
			} else {
				await invoke(NATIVE_COMMANDS.BOOKMARKS.SAVE_PLECO_REPORT, { report });
			}
		} catch {
			error = 'Could not export the report. Please try again.';
		}
	}
</script>

<SyModal title="Import lists" {visible} dismissible={!busy} onclose={close}>
	{#snippet body()}
		<div class="import-body" aria-busy={busy}>
			{#if stage === 'file'}
				<h3>From a file</h3>
				<p>Choose a Syng list or Pleco export. Syng identifies the format automatically.</p>
				<SyButton color="blue" disabled={busy} onclick={chooseFile}>Choose file</SyButton>
				<details>
					<summary>Exporting from Pleco</summary>
					<p>
						In Pleco, open Import/Export → Export Cards. Choose Text File, UTF-8, and
						include Categories. We recommend Both character sets. Turn off Cantonese
						readings; definitions are optional.
					</p>
					<p>
						Syng imports words into new lists using its own definitions. Custom cards
						without dictionary matches and study history are not imported.
					</p>
					<p>
						Pleco XML format 2 is also supported for exports without categories. To
						preserve categories, use a text export.
					</p>
				</details>
				<p class="file-context">Maximum file size: 10 MiB.</p>
			{:else if stage === 'syng' && archive}
				<p>Syng list: {archive.meta.name}</p>
				<p>
					{archive.entries.length}
					{archive.entries.length === 1 ? 'word' : 'words'} ready to import into a new list.
				</p>
				{#if archive.recovery_report}<p>
						Some vocabulary could not be recovered. A recovery report will be saved when
						you import.
					</p>{/if}
			{:else if preview}
				<p class="file-context">
					{preview.file_name} · Pleco {preview.source_format === 'xml' ? 'XML' : 'text'}
				</p>
				{#if stage === 'done'}
					<p role="status">
						Imported {ready}
						{ready === 1 ? 'word record' : 'word records'} into {lists.length}
						{lists.length === 1 ? 'list' : 'lists'}.
					</p>
				{:else}
					<dl class="import-counts" aria-label="Import summary" aria-live="polite">
						<div>
							<dt>Ready</dt>
							<dd>{ready}</dd>
						</div>
						<div>
							<dt>Needs review</dt>
							<dd>{undecided}</dd>
						</div>
						<div>
							<dt>Skipped</dt>
							<dd>{skipped}</dd>
						</div>
					</dl>
				{/if}
				{#if lists.length}
					<h3>{stage === 'done' ? 'Imported lists' : 'Destination lists'}</h3>
					<ul class="destination-lists">
						{#each lists as list (list.id)}<li>
								{list.name}
								<span
									>{list.lexicalIds.length}
									{list.lexicalIds.length === 1 ? 'word' : 'words'}</span
								>
							</li>{/each}
					</ul>
				{/if}
				{#if stage === 'review' && current}
					<fieldset disabled={savingStarted}>
						<legend>Review word {reviewIndex + 1} of {reviewRows.length}</legend>
						<p><strong>{current.headword}</strong> {current.pronunciation}</p>
						{#if current.definition}<p class="source-definition">
								{current.definition}
							</p>{/if}
						<p>{current.reason}</p>
						{#each current.candidates as candidate (candidate.id)}
							<label
								><input
									type="radio"
									name="pleco-choice"
									value={candidate.id.toString()}
									bind:group={choices[current.original]}
								/>
								<span
									>{candidate.simplified} / {candidate.traditional} — {candidate
										.pinyin.marks}<br />{candidate.english
										.map((definition) => definition.gloss.value)
										.join('; ')}</span
								>
							</label>
						{/each}
						<label
							><input
								type="radio"
								name="pleco-choice"
								value=""
								bind:group={choices[current.original]}
							/> Skip this word</label
						>
					</fieldset>
					<div class="review-navigation">
						<SyButton
							disabled={reviewIndex === 0 || busy}
							onclick={() => (reviewIndex -= 1)}>Previous</SyButton
						>
						<SyButton
							disabled={reviewIndex === reviewRows.length - 1 || busy}
							onclick={() => (reviewIndex += 1)}>Next</SyButton
						>
					</div>
					<p>
						{undecided}
						{undecided === 1 ? 'word still needs' : 'words still need'} a choice.
					</p>
				{/if}
				{#if skipped && !undecided}
					<details>
						<summary>Skipped records</summary>
						<pre>{report}</pre>
					</details>
					<div class="review-navigation">
						<SyButton disabled={busy} onclick={() => exportReport(true)}
							>Copy report</SyButton
						>
						<SyButton disabled={busy} onclick={() => exportReport(false)}
							>Save report</SyButton
						>
					</div>
				{/if}
				{#if !lists.length}<p>No words are selected for import.</p>{/if}
			{/if}
			{#if busy}<p role="status">
					{savingStarted || stage === 'syng' ? 'Saving lists…' : 'Reading file…'}
				</p>{/if}
			{#if error}<p role="alert">{error}</p>{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<SyButton disabled={busy} onclick={close}
			>{stage === 'done' || savingStarted ? 'Close' : 'Cancel'}</SyButton
		>
		{#if stage === 'syng'}<SyButton color="green" disabled={busy} onclick={saveSyng}
				>Import list</SyButton
			>{/if}
		{#if stage === 'review'}<SyButton
				color="green"
				disabled={busy || undecided > 0 || !lists.length}
				onclick={save}
				>{savingStarted
					? 'Retry'
					: `Import ${lists.length} ${lists.length === 1 ? 'list' : 'lists'}`}</SyButton
			>{/if}
	{/snippet}
</SyModal>

<style>
	.import-body {
		width: 34rem;
		max-width: 100%;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	h3 {
		font-size: var(--sy-font-size--medium);
		margin-block: var(--sy-space--extra-large) var(--sy-space--large);
	}
	h3:first-child {
		margin-top: 0;
	}
	details {
		margin-top: var(--sy-space--extra-large);
	}
	.file-context {
		font-size: var(--sy-font-size--result-caption);
	}
	.import-counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sy-space--extra-large);
		margin-block: var(--sy-space--extra-large);
	}
	.import-counts dd {
		margin: 0;
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
	}
	.destination-lists {
		list-style: none;
		padding: 0;
		margin-block: var(--sy-space--large);
	}
	.destination-lists li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sy-space--large);
		padding-block: var(--sy-space);
	}
	fieldset {
		min-width: 0;
	}
	label {
		display: flex;
		align-items: start;
		gap: var(--sy-space);
		margin-block: var(--sy-space--large);
	}
	input {
		flex-shrink: 0;
	}
	.review-navigation {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sy-space);
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font: inherit;
	}
	.source-definition {
		max-height: 12rem;
		overflow: auto;
	}
</style>
