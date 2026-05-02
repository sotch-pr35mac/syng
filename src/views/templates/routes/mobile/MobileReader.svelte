<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		CheckCircle2,
		ChevronLeft,
		ChevronRight,
		Circle,
		FilePlus2,
		Library,
		Trash2,
	} from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import CssPageCurlOverlay from '@/reader/animation/CssPageCurlOverlay.svelte';
	import { createReaderPageSnapshot } from '@/reader/animation/pageSnapshot.js';
	import type { ReaderDocument, ReaderToken } from '@/types/reader.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';

	const CHARACTER_MEASURE_SAMPLE = '汉字阅读天地学习语言文字故事春夏秋冬';
	const DEFAULT_PAGE_FONT_SIZE = 19;
	const BODY_BLOCK_GAP_EM = 1.25;
	const HEADING_FONT_SCALE = 1.28;
	const HEADING_LINE_HEIGHT = 1.5;
	const PAGE_CURL_DURATION_MS = 720;
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	const activeDocument = $derived(readerRoute.activeDocument);
	const currentPage = $derived(readerRoute.currentPage);
	const documents = $derived(readerRoute.documents);
	let gestureStartX = 0;
	let gestureStartY = 0;
	let editingLibrary = $state(false);
	let pageElement = $state<HTMLElement | undefined>(undefined);
	let characterMeasureElement = $state<HTMLElement | undefined>(undefined);
	let turningPage = $state(false);
	let turningPageDirection = $state<'next' | 'previous' | undefined>(undefined);
	let currentPageImage = $state<string | undefined>(undefined);
	let targetPageImage = $state<string | undefined>(undefined);
	let pendingTargetPageIndex = $state<number | undefined>(undefined);
	const selectedDocumentIds = new SvelteSet<string>();
	const selectedDocuments = $derived(
		documents.filter((document) => selectedDocumentIds.has(document._id))
	);

	onMount(() => {
		readerRoute.refresh().catch(() => {});
	});

	$effect(() => {
		if (!pageElement) {
			return () => {};
		}

		const resizeObserver = new ResizeObserver(() => {
			updatePageLayout().catch(() => {});
		});
		resizeObserver.observe(pageElement);
		updatePageLayout().catch(() => {});

		return () => {
			resizeObserver.disconnect();
		};
	});

	function openToken(event: MouseEvent, token: ReaderToken | undefined): void {
		if (!token || !(event.currentTarget instanceof HTMLElement)) {
			return;
		}
		readerRoute.openDictionary(token, event.currentTarget.getBoundingClientRect());
	}

	function toggleEditing(): void {
		editingLibrary = !editingLibrary;
		selectedDocumentIds.clear();
	}

	function toggleDocumentSelection(document: ReaderDocument): void {
		if (selectedDocumentIds.has(document._id)) {
			selectedDocumentIds.delete(document._id);
		} else {
			selectedDocumentIds.add(document._id);
		}
	}

	function handleDocumentCardClick(document: ReaderDocument): void {
		if (editingLibrary) {
			toggleDocumentSelection(document);
			return;
		}
		readerRoute.openDocument(document);
	}

	function handleDocumentCardKey(event: KeyboardEvent, document: ReaderDocument): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleDocumentCardClick(document);
		}
	}

	async function deleteSelectedDocuments(): Promise<void> {
		const removed = await readerRoute.deleteDocuments(selectedDocuments);
		if (removed) {
			selectedDocumentIds.clear();
			editingLibrary = false;
		}
	}

	function parsePixelValue(value: string, fallback: number): number {
		const parsedValue = Number.parseFloat(value);
		return Number.isFinite(parsedValue) ? parsedValue : fallback;
	}

	async function updatePageLayout(): Promise<void> {
		await tick();
		if (!pageElement) {
			return;
		}

		const pageStyles = getComputedStyle(pageElement);
		const fontSize = parsePixelValue(pageStyles.fontSize, DEFAULT_PAGE_FONT_SIZE);
		const lineHeight = parsePixelValue(pageStyles.lineHeight, fontSize * 2);
		const paddingX =
			parsePixelValue(pageStyles.paddingLeft, 0) +
			parsePixelValue(pageStyles.paddingRight, 0);
		const paddingY =
			parsePixelValue(pageStyles.paddingTop, 0) +
			parsePixelValue(pageStyles.paddingBottom, 0);
		const measuredCharacterWidth = characterMeasureElement
			? characterMeasureElement.getBoundingClientRect().width /
				CHARACTER_MEASURE_SAMPLE.length
			: fontSize;

		await readerRoute.setPageLayout({
			contentWidth: pageElement.clientWidth - paddingX,
			contentHeight: pageElement.clientHeight - paddingY,
			fontSize,
			lineHeight,
			blockGap: fontSize * BODY_BLOCK_GAP_EM,
			headingLineHeight: fontSize * HEADING_FONT_SCALE * HEADING_LINE_HEIGHT,
			headingGap: fontSize * BODY_BLOCK_GAP_EM,
			averageCharacterWidth: measuredCharacterWidth,
		});
	}

	async function turnPage(direction: 'next' | 'previous'): Promise<void> {
		if (turningPage) {
			return;
		}

		const targetPageIndex =
			direction === 'next' ? readerRoute.pageIndex + 1 : readerRoute.pageIndex - 1;
		const targetPage = readerRoute.getPage(targetPageIndex);
		if (!targetPage || !currentPage) {
			return;
		}

		try {
			await tick();
			if (!pageElement || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
				turningPage = true;
				await readerRoute.goToPage(targetPageIndex);
				clearPageTurn();
				return;
			}

			currentPageImage = createReaderPageSnapshot(currentPage, pageElement).source.toDataURL();
			targetPageImage = createReaderPageSnapshot(targetPage, pageElement).source.toDataURL();
			pendingTargetPageIndex = targetPageIndex;
			turningPageDirection = direction;
			turningPage = true;
		} catch {
			turningPage = true;
			await readerRoute.goToPage(targetPageIndex);
			clearPageTurn();
		}
	}

	async function completePageTurn(): Promise<void> {
		const targetPageIndex = pendingTargetPageIndex;
		if (targetPageIndex === undefined) {
			clearPageTurn();
			return;
		}
		await readerRoute.goToPage(targetPageIndex);
		clearPageTurn();
	}

	function clearPageTurn(): void {
		turningPage = false;
		turningPageDirection = undefined;
		currentPageImage = undefined;
		targetPageImage = undefined;
		pendingTargetPageIndex = undefined;
	}

	function onPointerDown(event: PointerEvent): void {
		gestureStartX = event.clientX;
		gestureStartY = event.clientY;
	}

	function onPointerUp(event: PointerEvent): void {
		if (turningPage) {
			return;
		}
		const deltaX = event.clientX - gestureStartX;
		const deltaY = event.clientY - gestureStartY;
		const MIN_SWIPE_DISTANCE = 70;
		const MAX_VERTICAL_DRIFT = 60;
		if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || Math.abs(deltaY) > MAX_VERTICAL_DRIFT) {
			return;
		}
		if (deltaX < 0) {
			turnPage('next');
		} else {
			turnPage('previous');
		}
	}
</script>

<div class="mobile-reader">
	{#if activeDocument && currentPage}
		<div class="mobile-reader__reader-header">
			<SyButton style="ghost" size="small" onclick={readerRoute.backToLibrary}>
				<Library size="18" />
			</SyButton>
			<span class="mobile-reader__document-title">{activeDocument.title}</span>
			<span class="mobile-reader__page-count">
				{readerRoute.pageIndex + 1}/{readerRoute.pageCount}
			</span>
		</div>
		<main class="mobile-reader__stage" onpointerdown={onPointerDown} onpointerup={onPointerUp}>
			<button
				class="mobile-reader__page-turn mobile-reader__page-turn--previous"
				disabled={!readerRoute.canGoPrevious || turningPage}
				aria-label="Previous page"
				onclick={() => turnPage('previous')}
			>
				<ChevronLeft size="24" />
			</button>
			<span
				bind:this={characterMeasureElement}
				class="mobile-reader__measure-text"
				aria-hidden="true"
			>
				{CHARACTER_MEASURE_SAMPLE}
			</span>
			<article
				bind:this={pageElement}
				class="mobile-reader__page mobile-reader__page--base"
				class:mobile-reader__page--turning={turningPage}
			>
				{#each currentPage.blocks as block (block.id)}
					<svelte:element
						this={block.kind === 'heading' ? 'h2' : 'p'}
						class="mobile-reader__block"
					>
						{#each readerRoute.getBlockSegments(block) as segment, index (index)}
							{#if segment.type === 'token'}
								<button
									class="mobile-reader__token"
									onclick={(event) => openToken(event, segment.token)}
								>
									{segment.text}
								</button>
							{:else}
								{segment.text}
							{/if}
						{/each}
					</svelte:element>
				{/each}
			</article>
			{#if turningPage && currentPageImage && targetPageImage && turningPageDirection}
				<div class="mobile-reader__page-curl" aria-hidden="true">
					<CssPageCurlOverlay
						currentImage={currentPageImage}
						targetImage={targetPageImage}
						direction={turningPageDirection}
						durationMs={PAGE_CURL_DURATION_MS}
						oncomplete={() => {
							completePageTurn().catch(clearPageTurn);
						}}
					/>
				</div>
			{/if}
			<button
				class="mobile-reader__page-turn mobile-reader__page-turn--next"
				disabled={!readerRoute.canGoNext || turningPage}
				aria-label="Next page"
				onclick={() => turnPage('next')}
			>
				<ChevronRight size="24" />
			</button>
		</main>
	{:else}
		<div class="mobile-reader__library-header">
			<span>Library</span>
			<div class="mobile-reader__library-actions">
				{#if editingLibrary}
					<SyButton
						style="ghost"
						size="small"
						hover="red"
						disabled={!selectedDocuments.length}
						onclick={deleteSelectedDocuments}
					>
						<Trash2 size="18" />
					</SyButton>
				{/if}
				<SyButton style="ghost" size="small" onclick={toggleEditing}>
					{editingLibrary ? 'Done' : 'Edit'}
				</SyButton>
			</div>
		</div>
		<main class="mobile-reader__library">
			<div class="mobile-reader__library-grid">
				<button
					class="mobile-reader__book mobile-reader__book--import"
					disabled={readerRoute.importing || editingLibrary}
					onclick={readerRoute.importDocument}
				>
					<FilePlus2 size="26" />
					<span>{readerRoute.importing ? 'Importing...' : 'Import Document'}</span>
				</button>
				{#each documents as document (document._id)}
					<div
						class="mobile-reader__book"
						class:mobile-reader__book--selected={selectedDocumentIds.has(document._id)}
						onclick={() => handleDocumentCardClick(document)}
						onkeyup={(event) => handleDocumentCardKey(event, document)}
						role="button"
						tabindex="0"
					>
						{#if editingLibrary}
							<span class="mobile-reader__selection-indicator">
								{#if selectedDocumentIds.has(document._id)}
									<CheckCircle2 size="22" />
								{:else}
									<Circle size="22" />
								{/if}
							</span>
						{/if}
						<span class="mobile-reader__book-name">{document.title}</span>
						<span class="mobile-reader__book-meta">
							{Math.round((document.progress?.total_progression ?? 0) * 100)}% · {document.file_name}
						</span>
					</div>
				{/each}
			</div>
			{#if !documents.length}
				<div class="mobile-reader__empty">
					<p>Your reading library is empty</p>
				</div>
			{/if}
		</main>
	{/if}
</div>

<DictionaryPopover
	word={readerRoute.dictionaryWord}
	results={readerRoute.dictionaryResults}
	resultIndex={readerRoute.dictionaryResultIndex}
	lists={bookmarksStore.lists}
	anchor={readerRoute.dictionaryAnchor}
	onselect={readerRoute.selectDictionaryResult}
	onclose={readerRoute.closeDictionary}
/>

<style>
	.mobile-reader {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--sy-color--grey-2);
		font-family: var(--sy-font-family);
	}

	.mobile-reader__library-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 54px;
		padding: 0 var(--sy-mobile-space--large);
		background: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
	}

	.mobile-reader__library-actions {
		display: flex;
		align-items: center;
	}

	.mobile-reader__library {
		height: calc(100% - 54px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: var(--sy-mobile-space--large);
		padding-bottom: calc(var(--sy-mobile-space--large) + env(safe-area-inset-bottom));
	}

	.mobile-reader__library-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sy-mobile-space--large);
	}

	.mobile-reader__book {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		aspect-ratio: 2 / 3;
		padding: var(--sy-mobile-space--medium);
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 10px, transparent 10px),
			var(--sy-color--white);
		box-shadow: var(--sy-shadow);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.mobile-reader__book--import {
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
		color: var(--sy-color--blue);
		text-align: center;
	}

	.mobile-reader__book--selected {
		border-color: var(--sy-color--blue);
	}

	.mobile-reader__book:disabled {
		opacity: 0.7;
	}

	.mobile-reader__selection-indicator {
		position: absolute;
		top: var(--sy-mobile-space--medium);
		right: var(--sy-mobile-space--medium);
		color: var(--sy-color--blue);
	}

	.mobile-reader__book-name,
	.mobile-reader__book-meta,
	.mobile-reader__document-title {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mobile-reader__book-name {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		line-clamp: 3;
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.mobile-reader__book-meta {
		margin-top: var(--sy-mobile-space--extra-small);
		color: var(--sy-color--grey-3);
		font-size: var(--sy-font-size--mobile-small);
		white-space: nowrap;
	}

	.mobile-reader__empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 180px;
		color: var(--sy-color--grey-4);
	}

	.mobile-reader__reader-header {
		display: grid;
		grid-template-columns: 52px 1fr 52px;
		align-items: center;
		height: 54px;
		background: var(--sy-color--white);
		border-bottom: var(--sy-border);
	}

	.mobile-reader__document-title {
		justify-self: center;
		max-width: 100%;
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
		white-space: nowrap;
	}

	.mobile-reader__page-count {
		justify-self: center;
		color: var(--sy-color--grey-3);
		font-size: var(--sy-font-size--mobile-small);
	}

	.mobile-reader__stage {
		--mobile-reader-stage-padding: var(--sy-mobile-space--medium);

		position: relative;
		height: calc(100% - 54px);
		padding: var(--mobile-reader-stage-padding);
		box-sizing: border-box;
		overflow: hidden;
		touch-action: pan-y;
	}

	.mobile-reader__page {
		height: 100%;
		margin: 0;
		padding: calc(var(--sy-mobile-space--medium) * 3);
		background: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		overflow: hidden;
		box-sizing: border-box;
		font-size: 1.18rem;
		line-height: 2;
		color: var(--sy-color--black);
	}

	.mobile-reader__page--base {
		position: relative;
		z-index: 0;
	}

	.mobile-reader__page--turning {
		opacity: 0;
	}

	.mobile-reader__page-curl {
		position: absolute;
		inset: var(--mobile-reader-stage-padding);
		z-index: var(--sy-z-index--base);
		width: calc(100% - (var(--mobile-reader-stage-padding) * 2));
		height: calc(100% - (var(--mobile-reader-stage-padding) * 2));
		border-radius: var(--sy-border-radius);
		pointer-events: none;
	}

	.mobile-reader__measure-text {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		font-size: 1.18rem;
		line-height: 1;
		white-space: nowrap;
	}

	.mobile-reader__page-turn {
		position: absolute;
		top: 50%;
		z-index: calc(var(--sy-z-index--base) + 1);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 30%;
		border: 0;
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 76%);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-shadow);
		transform: translateY(-50%);
	}

	.mobile-reader__page-turn--previous {
		left: var(--sy-mobile-space--medium);
	}

	.mobile-reader__page-turn--next {
		right: var(--sy-mobile-space--medium);
	}

	.mobile-reader__page-turn:disabled {
		opacity: 0.25;
	}

	.mobile-reader__block {
		white-space: pre-wrap;
		margin: 0 0 1.25em;
	}

	h2.mobile-reader__block {
		font-size: 1.28rem;
		line-height: 1.5;
		color: var(--sy-color--grey-4);
	}

	.mobile-reader__token {
		display: inline;
		border: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		color: inherit;
		font: inherit;
	}

	.mobile-reader__token:active {
		color: var(--sy-color--blue);
	}
</style>
