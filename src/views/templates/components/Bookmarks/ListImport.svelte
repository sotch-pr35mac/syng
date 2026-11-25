<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview';
	import type { UnlistenFn } from '@tauri-apps/api/event';
	import { ChevronRight, FileInput, List } from 'lucide-svelte';
	import { isMobile, isWindows } from '@/utils/device.js';
	import { resolveNameConflict } from '@/utils/name.js';
	import { HSK_LEVEL_LABELS } from '@/utils/hsk.js';
	import { HSK_LEVELS } from '@/types/hsk.js';
	import { HSK_VARIANT_LABELS } from '@/types/dictionaryDisplay.js';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import type {
		ImportedList,
		PlecoPreview,
		SyngListArchive,
		ListImportPreview,
		HskListSummary,
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
	let stage = $state<'file' | 'catalog' | 'syng' | 'review' | 'done'>('file');
	let hskCatalog = $state<HskListSummary[] | null>(null);
	let hskStandard = $state<HskListSummary['standard']>('hsk_exam_syllabus_2025');
	let hskLevel = $state<HskListSummary['level']>(HSK_LEVELS.ONE);
	let builtinList = $state<ImportedList | null>(null);
	const hskStandards = $derived([...new SvelteSet(hskCatalog?.map((list) => list.standard))]);
	const hskLevels = $derived(
		Object.values(HSK_LEVELS).filter((level) =>
			hskCatalog?.some((list) => list.standard === hskStandard && list.level === level)
		)
	);
	const selectedHsk = $derived(
		hskCatalog?.find((list) => list.standard === hskStandard && list.level === hskLevel)
	);
	let preview = $state<PlecoPreview | null>(null);
	let archive = $state<SyngListArchive | null>(null);
	let choices = $state<Record<string, string>>({});
	let destinations = $state<Record<string, { id: string; name: string }>>({});
	let busy = $state(false);
	let error = $state('');
	let savingStarted = $state(false);
	let reviewIndex = $state(0);
	const desktop = !isMobile();
	let dropArea = $state<HTMLButtonElement>();
	let dragging = $state(false);
	let browseButton = $state<HTMLButtonElement>();
	let catalogHeading = $state<HTMLHeadingElement>();
	const dropHintId = $props.id();

	$effect(() => {
		if (!visible || stage !== 'file' || !desktop) {
			return undefined;
		}
		let active = true;
		let unlisten: UnlistenFn | undefined;
		async function registerDrop() {
			try {
				const stop = await getCurrentWebview().onDragDropEvent(({ payload }) => {
					if (active) {
						handleDrop(payload);
					}
				});
				if (active) {
					unlisten = stop;
				} else {
					stop();
				}
			} catch {
				if (active) {
					error = 'Drag and drop is unavailable. Use Choose file instead.';
				}
			}
		}
		void registerDrop();
		return () => {
			active = false;
			unlisten?.();
			dragging = false;
		};
	});

	function handleDrop(event: DragDropEvent) {
		if (event.type === 'leave' || busy || !dropArea) {
			dragging = false;
			return;
		}
		// Wry 0.57 forwards AppKit/GTK logical points on macOS/Linux, despite
		// Tauri typing every position as physical. Windows emits physical pixels.
		const coordinateScale = isWindows() ? window.devicePixelRatio : 1;
		const bounds = dropArea.getBoundingClientRect();
		const pointerX = event.position.x / coordinateScale;
		const pointerY = event.position.y / coordinateScale;
		const inside =
			pointerX >= bounds.left &&
			pointerX <= bounds.right &&
			pointerY >= bounds.top &&
			pointerY <= bounds.bottom;
		dragging = inside && event.type !== 'drop';
		if (event.type !== 'drop' || !inside) {
			return;
		}
		if (event.paths.length !== 1) {
			error = 'Drop one list file at a time.';
			return;
		}
		void chooseFile(event.paths[0]);
	}
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
		if (builtinList) {
			return [builtinList];
		}
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
		builtinList = null;
		preview = null;
		choices = {};
		destinations = {};
		error = '';
		savingStarted = false;
		reviewIndex = 0;
		onclose();
	}
	async function loadHskLists() {
		if (busy) {
			return;
		}
		busy = true;
		error = '';
		try {
			hskCatalog ??= await invoke<HskListSummary[]>(NATIVE_COMMANDS.BOOKMARKS.GET_HSK_LISTS);
			stage = 'catalog';
			await tick();
			catalogHeading?.focus();
		} catch {
			error = 'Could not load the pre-built lists. Please try again.';
		} finally {
			busy = false;
		}
	}
	async function backToSources() {
		if (busy) {
			return;
		}
		stage = 'file';
		error = '';
		await tick();
		browseButton?.focus();
	}
	async function addHskList() {
		if (busy || !selectedHsk) {
			return;
		}
		const selection = selectedHsk;
		const name = `${HSK_VARIANT_LABELS[selection.standard]} — Level ${HSK_LEVEL_LABELS[selection.level]}`;
		busy = true;
		error = '';
		try {
			const lexicalIds = await invoke<string[]>(NATIVE_COMMANDS.BOOKMARKS.PREPARE_HSK_LIST, {
				id: selection.id,
			});
			await bookmarksStore.refresh();
			builtinList = {
				id: crypto.randomUUID(),
				name: resolveNameConflict(name, bookmarksStore.lists),
				lexicalIds,
			};
			await persistLists([builtinList]);
		} catch {
			error = 'Could not load this HSK list. Please try again.';
		} finally {
			busy = false;
		}
	}
	async function chooseFile(path?: string) {
		if (busy || !visible || stage !== 'file') {
			return;
		}
		busy = true;
		error = '';
		try {
			const detected = path
				? await invoke<ListImportPreview | null>(NATIVE_COMMANDS.BOOKMARKS.PREPARE_IMPORT, {
						path,
					})
				: await invoke<ListImportPreview | null>(NATIVE_COMMANDS.BOOKMARKS.PREPARE_IMPORT);
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
					: 'Could not read this file. Please try again.';
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
		await persistLists(lists);
	}
	async function persistLists(importedLists: ImportedList[]) {
		savingStarted = true;
		busy = true;
		error = '';
		try {
			await bookmarksStore.importLists(importedLists);
			stage = 'done';
			try {
				await onimported(importedLists[0].name);
			} catch {
				error = 'Your lists were saved. Open them from Bookmarks.';
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

<SyModal
	title="Import List"
	{visible}
	dismissible={!busy}
	onclose={close}
	onback={stage === 'catalog' && !savingStarted ? backToSources : undefined}
>
	{#snippet body()}
		<div
			class="import-body"
			class:import-body--mobile={!desktop}
			class:import-body--sources={stage === 'file'}
			aria-busy={busy}
		>
			{#if stage === 'file'}
				<p class="source-intro">Choose a pre-built list or import a file.</p>
				<div class="import-sources">
					<button
						bind:this={browseButton}
						type="button"
						class="source-panel"
						disabled={busy}
						aria-label="Browse lists"
						onclick={loadHskLists}
					>
						<List size="32" strokeWidth="1.5" aria-hidden="true" />
						<span class="source-panel__title">From Collection</span>
						<span class="source-panel__description"
							>HSK vocabulary<br />organized by level.</span
						>
						<span class="source-panel__action"
							>Browse lists <ChevronRight size="14" aria-hidden="true" /></span
						>
					</button>
					<button
						bind:this={dropArea}
						type="button"
						class="source-panel drop-area"
						class:drop-area--active={dragging}
						disabled={busy}
						aria-label="Choose file"
						aria-describedby={dropHintId}
						onclick={() => chooseFile()}
					>
						<FileInput size="32" strokeWidth="1.5" aria-hidden="true" />
						<span class="source-panel__title">From File</span>
						<span class="source-panel__description" id={dropHintId}>
							{#if desktop}Drop a list file here<br />or{:else}Choose a list file<br
								/>from your device.{/if}
						</span>
						<span class="source-panel__action">Choose file</span>
						<span class="source-panel__note">Syng and Pleco · Up to 10 MiB</span>
					</button>
				</div>
				<details>
					<summary>Supported imports</summary>
					<p>
						Syng list files and Pleco exports (UTF-8 text or XML format 2) are
						supported. The file format is detected automatically.
					</p>
					<h3>Exporting from Pleco</h3>
					<p>
						Open Import/Export → Export Cards in Pleco. Choose Text File (UTF-8) or XML,
						and include Categories to keep words in their lists.
					</p>
					<p>
						We recommend Both character sets. Turn off Cantonese readings; definitions
						are optional.
					</p>
					<p>
						Imported words use Syng’s dictionary definitions. Cards without a dictionary
						match are skipped. Study history is not imported.
					</p>
				</details>
			{:else if stage === 'catalog'}
				<h3 bind:this={catalogHeading} tabindex="-1">From Collection</h3>
				<p>Choose an HSK standard and level.</p>
				<label class="hsk-selection"
					>HSK standard
					<select
						disabled={busy || savingStarted}
						bind:value={hskStandard}
						onchange={() => (hskLevel = HSK_LEVELS.ONE)}
					>
						{#each hskStandards as standard (standard)}<option value={standard}
								>{HSK_VARIANT_LABELS[standard]}</option
							>{/each}
					</select>
				</label>
				<label class="hsk-selection"
					>Level
					<select disabled={busy || savingStarted} bind:value={hskLevel}>
						{#each hskLevels as level (level)}<option value={level}
								>Level {HSK_LEVEL_LABELS[level]}</option
							>{/each}
					</select>
				</label>
				{#if selectedHsk}<p>
						<strong>{HSK_VARIANT_LABELS[hskStandard]}</strong><br />
						{selectedHsk.word_count.toLocaleString()}
						{selectedHsk.word_count === 1 ? 'word' : 'words'} in this level.
					</p>{/if}
				<p>Includes this level only. You can edit the list later.</p>
			{:else if builtinList}
				<p>{builtinList.name}</p>
				<p role="status">
					Added {builtinList.lexicalIds.length.toLocaleString()}
					{builtinList.lexicalIds.length === 1 ? 'word' : 'words'} to a new list.
				</p>
			{:else if stage === 'syng' && archive}
				<p>Syng list: {archive.meta.name}</p>
				<p>
					{archive.entries.length}
					{archive.entries.length === 1 ? 'word' : 'words'} ready to import into a new list.
				</p>
				{#if archive.recovery_report}<p>
						Some words could not be recovered. Importing will save a report with the
						details.
					</p>{/if}
			{:else if preview}
				<p class="file-context">
					{preview.file_name} · Pleco {preview.source_format === 'xml' ? 'XML' : 'text'}
				</p>
				{#if stage === 'done'}
					<p role="status">
						Added {lists.length} new {lists.length === 1 ? 'list' : 'lists'}.
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
					<h3>{stage === 'done' ? 'Imported lists' : 'New lists'}</h3>
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
							size="large"
							disabled={reviewIndex === 0 || busy}
							onclick={() => (reviewIndex -= 1)}>Previous</SyButton
						>
						<SyButton
							size="large"
							disabled={reviewIndex === reviewRows.length - 1 || busy}
							onclick={() => (reviewIndex += 1)}>Next</SyButton
						>
					</div>
					<p>
						{undecided}
						{undecided === 1 ? 'word left' : 'words left'} to review.
					</p>
				{/if}
				{#if skipped && !undecided}
					<details>
						<summary>Skipped words</summary>
						<pre>{report}</pre>
					</details>
					<div class="review-navigation">
						<SyButton size="large" disabled={busy} onclick={() => exportReport(true)}
							>Copy report</SyButton
						>
						<SyButton size="large" disabled={busy} onclick={() => exportReport(false)}
							>Save report</SyButton
						>
					</div>
				{/if}
				{#if !lists.length}<p>No words selected to import.</p>{/if}
			{/if}
			{#if busy}<p role="status">
					{savingStarted || stage === 'syng' ? 'Saving lists…' : 'Preparing import…'}
				</p>{/if}
			{#if error}<p role="alert">{error}</p>{/if}
		</div>
	{/snippet}
	{#snippet footerStart()}
		<SyButton size="large" disabled={busy} onclick={close}
			>{stage === 'done' || savingStarted ? 'Close' : 'Cancel'}</SyButton
		>
	{/snippet}
	{#snippet footer()}
		{#if stage === 'catalog'}
			<SyButton
				size="large"
				color="green"
				disabled={busy || !selectedHsk}
				onclick={builtinList ? save : addHskList}
			>
				{savingStarted ? 'Retry' : 'Add List'}
			</SyButton>
		{/if}
		{#if stage === 'syng'}<SyButton
				size="large"
				color="green"
				disabled={busy}
				onclick={saveSyng}>Import list</SyButton
			>{/if}
		{#if stage === 'review'}<SyButton
				size="large"
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
	.hsk-selection {
		flex-direction: column;
		align-items: stretch;
	}
	select {
		width: 100%;
		min-width: 0;
		font: inherit;
		color: var(--sy-color--black);
		background: var(--sy-surface--content);
		border: var(--sy-input--border);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space--large);
		min-height: var(--sy-mobile-touch-target);
	}
	.source-intro {
		margin-block: var(--sy-space--large) var(--sy-space--extra-large);
	}
	.import-sources {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: var(--sy-space--extra-large);
	}
	.source-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-mobile-space--large);
		min-width: 0;
		padding: var(--sy-space--extra-large);
		border: 1px solid var(--sy-color--grey-1);
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--floating);
		color: var(--sy-color--black);
		font: inherit;
		text-align: center;
		cursor: pointer;
		transition-property: background-color, border-color, box-shadow, transform;
		transition-duration: var(--sy-transition-duration--control);
		transition-timing-function: ease-out;
	}
	.source-panel :global(svg) {
		color: var(--sy-text--blue);
		flex-shrink: 0;
	}
	.source-panel__title {
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
	}
	.source-panel__description {
		line-height: var(--sy-line-height--body);
	}
	.source-panel__action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		padding: var(--sy-space--large);
		border-radius: var(--sy-border-radius);
		background: var(--sy-fill--blue);
		color: var(--sy-text--on-fill);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--normal);
		box-shadow: var(--sy-shadow);
	}
	.source-panel__action :global(svg) {
		color: inherit;
	}
	.import-body--mobile .source-panel__action {
		box-sizing: border-box;
		min-height: var(--sy-mobile-touch-target);
		border: var(--sy-mobile-surface-border);
		box-shadow: none;
	}
	.source-panel__note {
		font-size: var(--sy-font-size--result-caption);
	}
	.drop-area {
		border-style: dashed;
	}
	.source-panel:hover:not(:disabled),
	.drop-area--active {
		border-color: var(--sy-text--blue);
		background: color-mix(in srgb, var(--sy-text--blue) 7%, var(--sy-surface--floating));
	}
	.source-panel:not(:disabled):active {
		border-color: var(--sy-text--blue);
		background: var(--sy-color--grey-2);
		box-shadow: var(--sy-inner-shadow);
		transform: translateY(var(--sy-control-press-offset));
		transition: none;
	}
	.source-panel:not(:disabled):active .source-panel__action {
		background: var(--sy-color--grey-2);
		color: var(--sy-text--blue);
		box-shadow: var(--sy-inner-shadow);
	}
	@media (prefers-reduced-motion: reduce) {
		.source-panel {
			transition: none;
		}
		.source-panel:not(:disabled):active {
			transform: none;
		}
	}
	.source-panel:focus-visible {
		outline: var(--sy-focus-width) solid var(--sy-focus-color);
		outline-offset: var(--sy-focus-offset);
	}
	.source-panel:disabled {
		cursor: wait;
	}
	.import-body {
		width: 34rem;
		max-width: 100%;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.import-body--sources {
		width: 38rem;
		padding-block: var(--sy-space) var(--sy-space--large);
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
