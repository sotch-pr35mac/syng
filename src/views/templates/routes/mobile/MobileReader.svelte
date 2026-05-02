<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		CheckCircle2,
		ChevronLeft,
		ChevronRight,
		Circle,
		ClipboardPaste,
		FilePlus2,
		Globe2,
		Library,
		Minus,
		Palette,
		Pencil,
		Plus,
		Trash2,
	} from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import ReaderClipboardImportModal from '@/components/ReaderClipboardImportModal.svelte';
	import ReaderDocumentMetadataModal from '@/components/ReaderDocumentMetadataModal.svelte';
	import ReaderWebpageImportModal from '@/components/ReaderWebpageImportModal.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import {
		getReaderColorTheme,
		READER_COLOR_THEMES,
		READER_FONT_SIZE_MAX_PERCENT,
		READER_FONT_SIZE_MIN_PERCENT,
	} from '@/reader/settings/defaults.js';
	import CssPageCurlOverlay from '@/reader/animation/CssPageCurlOverlay.svelte';
	import { createReaderPageSnapshot } from '@/reader/animation/pageSnapshot.js';
	import type { ReaderDocument, ReaderImportPayload, ReaderToken } from '@/types/reader.js';
	import type { ReaderColorThemeId } from '@/reader/types.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import { normalizeReaderDocumentColor } from '@/utils/readerDocumentMetadata.js';

	const CHARACTER_MEASURE_SAMPLE = '汉字阅读天地学习语言文字故事春夏秋冬';
	const DEFAULT_PAGE_FONT_SIZE = 19;
	const BODY_BLOCK_GAP_EM = 1.25;
	const HEADING_FONT_SCALE = 1.28;
	const HEADING_LINE_HEIGHT = 1.5;
	const PAGE_CURL_DURATION_MS = 720;
	const PERCENTAGE_SCALE = 100;
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	const activeDocument = $derived(readerRoute.activeDocument);
	const currentPage = $derived(readerRoute.currentPage);
	const documents = $derived(readerRoute.documents);
	const readerSettings = $derived(readerSettingsStore.settings);
	const activeReaderTheme = $derived(getReaderColorTheme(readerSettings.colorTheme));
	const canDecreaseFontSize = $derived(
		readerSettings.fontSizePercent > READER_FONT_SIZE_MIN_PERCENT
	);
	const canIncreaseFontSize = $derived(
		readerSettings.fontSizePercent < READER_FONT_SIZE_MAX_PERCENT
	);
	const readerThemeStyle = $derived(
		[
			`--reader-page-background: ${readerSettings.backgroundColor}`,
			`--reader-page-text: ${readerSettings.textColor}`,
			`--reader-link-color: ${readerSettings.linkColor}`,
			`--reader-selection-background: ${readerSettings.selectionBackgroundColor}`,
			`--reader-selection-text: ${readerSettings.selectionTextColor}`,
			`--reader-stage-background: ${activeReaderTheme.stageBackgroundColor}`,
			`--reader-muted-text: ${activeReaderTheme.mutedTextColor}`,
			`--reader-border-color: ${activeReaderTheme.borderColor}`,
			`--reader-control-background: ${activeReaderTheme.controlBackgroundColor}`,
			`--reader-control-text: ${activeReaderTheme.controlTextColor}`,
			`--reader-font-family: ${readerSettings.fontFamily}`,
			`--reader-page-font-size: ${(DEFAULT_PAGE_FONT_SIZE * readerSettings.fontSizePercent) / 100}px`,
			`--reader-page-line-height: ${readerSettings.lineHeight}`,
		].join(';')
	);
	let gestureStartX = 0;
	let gestureStartY = 0;
	let editingLibrary = $state(false);
	let clipboardImportModalVisible = $state(false);
	let webpageImportModalVisible = $state(false);
	let pendingImportPayload = $state<ReaderImportPayload | undefined>(undefined);
	let editingDocument = $state<ReaderDocument | undefined>(undefined);
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
		readerSettingsStore.loadSettings().catch(() => {});
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

	$effect(() => {
		readerSettings.fontSizePercent;
		readerSettings.lineHeight;
		if (pageElement) {
			updatePageLayout().catch(() => {});
		}
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

	function openClipboardImportModal(): void {
		clipboardImportModalVisible = true;
	}

	function closeClipboardImportModal(): void {
		clipboardImportModalVisible = false;
	}

	function openWebpageImportModal(): void {
		webpageImportModalVisible = true;
	}

	function closeWebpageImportModal(): void {
		webpageImportModalVisible = false;
	}

	async function openFileImportDetails(): Promise<void> {
		const importPayload = await readerRoute.pickImportDocument();
		if (importPayload) {
			pendingImportPayload = importPayload;
		}
	}

	function closeFileImportDetails(): void {
		pendingImportPayload = undefined;
	}

	async function importPendingDocument(title: string, color: string): Promise<void> {
		if (!pendingImportPayload) {
			return;
		}
		await readerRoute.importReaderPayload(pendingImportPayload, title, color);
		pendingImportPayload = undefined;
	}

	function openDocumentDetails(event: MouseEvent, document: ReaderDocument): void {
		event.stopPropagation();
		editingDocument = document;
	}

	function closeDocumentDetails(): void {
		editingDocument = undefined;
	}

	async function saveDocumentDetails(title: string, color: string): Promise<void> {
		if (!editingDocument) {
			return;
		}
		await readerRoute.updateDocumentMetadata(editingDocument, title, color);
		editingDocument = undefined;
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

	function getDocumentProgressPercent(document: ReaderDocument): number {
		const progression = document.progress?.total_progression ?? 0;
		return Math.round(Math.max(0, Math.min(1, progression)) * PERCENTAGE_SCALE);
	}

	async function deleteSelectedDocuments(): Promise<void> {
		const removed = await readerRoute.deleteDocuments(selectedDocuments);
		if (removed) {
			selectedDocumentIds.clear();
			editingLibrary = false;
		}
	}

	function setReaderTheme(theme: ReaderColorThemeId): void {
		readerSettingsStore.applyColorTheme(theme);
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

			currentPageImage = createReaderPageSnapshot(
				currentPage,
				pageElement
			).source.toDataURL();
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

<div class="mobile-reader" style={activeDocument ? readerThemeStyle : ''}>
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
		<div class="mobile-reader__settings-bar" aria-label="Reader settings">
			<div class="mobile-reader__theme-controls" aria-label="Reader theme">
				{#each READER_COLOR_THEMES as theme (theme.id)}
					<button
						type="button"
						class="mobile-reader__theme-button"
						class:mobile-reader__theme-button--active={readerSettings.colorTheme === theme.id}
						aria-label={`Use ${theme.label} reader theme`}
						aria-pressed={readerSettings.colorTheme === theme.id}
						title={theme.label}
						onclick={() => setReaderTheme(theme.id)}
					>
						<span
							class="mobile-reader__theme-swatch"
							style={`background:${theme.backgroundColor};color:${theme.textColor};`}
							aria-hidden="true"
						>
							<Palette size="13" />
						</span>
					</button>
				{/each}
			</div>
			<div class="mobile-reader__font-controls" aria-label="Reader font size">
				<button
					type="button"
					class="mobile-reader__font-button"
					disabled={!canDecreaseFontSize}
					aria-label="Decrease reader font size"
					onclick={readerSettingsStore.decreaseFontSize}
				>
					<Minus size="15" />
					<span>A</span>
				</button>
				<span class="mobile-reader__font-size-value" aria-label="Reader font size">
					{readerSettings.fontSizePercent}%
				</span>
				<button
					type="button"
					class="mobile-reader__font-button"
					disabled={!canIncreaseFontSize}
					aria-label="Increase reader font size"
					onclick={readerSettingsStore.increaseFontSize}
				>
					<Plus size="15" />
					<span>A</span>
				</button>
			</div>
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
					{#if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = activeDocument.blocks.find((b) => b.id === block.sourceBlockId)}
						{#if tableSource?.extensions?.table}
							<div
								class="mobile-reader__block mobile-reader__block--table"
								role="region"
								aria-label="Table"
							>
								<table class="mobile-reader__data-table">
									<tbody>
										{#each tableSource.extensions.table.rows as row, rowIndex (rowIndex)}
											<tr>
												{#each row.cells as cell, colIndex (colIndex)}
													<td>
														{#each readerRoute.getTableCellSegments(
															tableSource.id,
															rowIndex,
															colIndex,
															cell.text
														) as segment, segIndex (segIndex)}
															{#if segment.type === 'token'}
																<button
																	class="mobile-reader__token"
																	class:mobile-reader__token--active={readerRoute.tokensMatchDictionarySelection(
																		segment.token,
																		readerRoute.dictionaryToken
																	)}
																	onclick={(event) => openToken(event, segment.token)}
																>
																	{segment.text}
																</button>
															{:else}
																{segment.text}
															{/if}
														{/each}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{:else if block.layout_mode === 'atomic' && block.kind === 'image'}
						{@const imageSource = activeDocument.blocks.find((b) => b.id === block.sourceBlockId)}
						{#if imageSource?.extensions?.image?.inline_src}
							<figure class="mobile-reader__block mobile-reader__figure">
								<img
									src={imageSource.extensions.image.inline_src}
									alt={imageSource.text}
									class="mobile-reader__inline-image"
									width={imageSource.extensions.image.width ?? undefined}
									height={imageSource.extensions.image.height ?? undefined}
								/>
							</figure>
						{/if}
					{:else}
						{@const sourceBlock = activeDocument.blocks.find((b) => b.id === block.sourceBlockId)}
						<svelte:element
							this={block.kind === 'heading'
								? (`h${Math.min(6, Math.max(1, sourceBlock?.heading_level ?? 2))}` as
										| 'h1'
										| 'h2'
										| 'h3'
										| 'h4'
										| 'h5'
										| 'h6')
								: block.kind === 'blockquote'
									? 'blockquote'
									: block.kind === 'code_block'
										? 'pre'
										: 'p'}
							class="mobile-reader__block"
							class:mobile-reader__block--code={block.kind === 'code_block'}
							class:mobile-reader__block--list={block.kind === 'list_item'}
							class:mobile-reader__block--list-bullet={block.kind === 'list_item' &&
								sourceBlock?.extensions?.list_item?.list_style !== 'ordered'}
							class:mobile-reader__block--list-ordered={block.kind === 'list_item' &&
								sourceBlock?.extensions?.list_item?.list_style === 'ordered'}
							data-ordinal={block.kind === 'list_item' &&
							sourceBlock?.extensions?.list_item?.list_style === 'ordered' &&
							sourceBlock.extensions.list_item.ordinal !== null &&
							sourceBlock.extensions.list_item.ordinal !== undefined
								? String(sourceBlock.extensions.list_item.ordinal)
								: undefined}
						>
							{#each readerRoute.getBlockSegments(block) as segment, index (index)}
								{#if segment.type === 'token'}
									<button
										class="mobile-reader__token"
										class:mobile-reader__token--active={readerRoute.tokensMatchDictionarySelection(
											segment.token,
											readerRoute.dictionaryToken
										)}
										onclick={(event) => openToken(event, segment.token)}
									>
										{segment.text}
									</button>
								{:else}
									{segment.text}
								{/if}
							{/each}
						</svelte:element>
					{/if}
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
				<div class="mobile-reader__import-stack">
					<button
						class="mobile-reader__book mobile-reader__book--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openClipboardImportModal}
					>
						<ClipboardPaste size="18" />
						<span>Import From Clipboard</span>
					</button>
					<button
						class="mobile-reader__book mobile-reader__book--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openWebpageImportModal}
					>
						<Globe2 size="18" />
						<span>Import From Webpage</span>
					</button>
					<button
						class="mobile-reader__book mobile-reader__book--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openFileImportDetails}
					>
						<FilePlus2 size="18" />
						<span>{readerRoute.importing ? 'Importing...' : 'Import Document'}</span>
					</button>
				</div>
				{#each documents as document (document._id)}
					<div
						class="mobile-reader__book"
						class:mobile-reader__book--selected={selectedDocumentIds.has(document._id)}
						style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
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
							<button
								class="mobile-reader__metadata-button"
								type="button"
								aria-label={`Edit ${document.title}`}
								onclick={(event) => openDocumentDetails(event, document)}
							>
								<Pencil size="15" />
							</button>
						{/if}
						<span class="mobile-reader__book-name">{document.title}</span>
						<span class="mobile-reader__book-meta">
							{getDocumentProgressPercent(document)}% · {document.file_name}
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

<ReaderClipboardImportModal
	visible={clipboardImportModalVisible}
	importing={readerRoute.importing}
	onclose={closeClipboardImportModal}
	onimport={readerRoute.importPlainTextDocument}
/>

<ReaderWebpageImportModal
	visible={webpageImportModalVisible}
	importing={readerRoute.importing}
	onclose={closeWebpageImportModal}
	onimport={readerRoute.importWebpageDocument}
/>

<ReaderDocumentMetadataModal
	visible={Boolean(pendingImportPayload)}
	title="Import Document"
	initialTitle={pendingImportPayload?.title ?? ''}
	initialColor={pendingImportPayload?.color}
	confirmLabel="Import"
	busy={readerRoute.importing}
	onclose={closeFileImportDetails}
	onsave={importPendingDocument}
/>

<ReaderDocumentMetadataModal
	visible={Boolean(editingDocument)}
	title="Edit Document"
	initialTitle={editingDocument?.title ?? ''}
	initialColor={editingDocument?.color}
	confirmLabel="Save"
	busy={readerRoute.importing}
	onclose={closeDocumentDetails}
	onsave={saveDocumentDetails}
/>

<style>
	.mobile-reader {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--reader-stage-background, var(--sy-color--grey-2));
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
			var(--reader-book-color, var(--sy-color--white));
		box-shadow: var(--sy-shadow);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.mobile-reader__import-stack {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: var(--sy-mobile-space--small);
		aspect-ratio: 2 / 3;
	}

	.mobile-reader__import-stack .mobile-reader__book {
		height: 100%;
		aspect-ratio: auto;
	}

	.mobile-reader__book--import {
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--extra-small);
		color: var(--sy-color--blue);
		font-size: var(--sy-font-size--mobile-small);
		line-height: 1.15;
		padding: var(--sy-mobile-space--small);
		text-align: center;
	}

	.mobile-reader__book:not(.mobile-reader__book--import) {
		align-items: center;
		justify-content: center;
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

	.mobile-reader__metadata-button {
		position: absolute;
		top: var(--sy-mobile-space--medium);
		left: var(--sy-mobile-space--medium);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 86%);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-shadow);
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
		max-width: 100%;
		padding: var(--sy-mobile-space--extra-small) var(--sy-mobile-space--small);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 78%);
		color: var(--sy-color--black);
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.mobile-reader__book-meta {
		position: absolute;
		left: var(--sy-mobile-space--medium);
		right: var(--sy-mobile-space--medium);
		bottom: var(--sy-mobile-space--medium);
		margin-top: var(--sy-mobile-space--extra-small);
		color: var(--sy-color--grey-5);
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

	.mobile-reader__settings-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-mobile-space--medium);
		height: 50px;
		padding: var(--sy-mobile-space--small) var(--sy-mobile-space--medium);
		background: var(--reader-stage-background, var(--sy-color--grey-2));
		border-bottom: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		box-sizing: border-box;
		color: var(--reader-control-text, var(--sy-color--grey-4));
	}

	.mobile-reader__theme-controls,
	.mobile-reader__font-controls {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: var(--sy-border-radius);
		background: var(--reader-control-background, rgb(255 255 255 / 84%));
		overflow: hidden;
	}

	.mobile-reader__theme-button,
	.mobile-reader__font-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--extra-small);
		min-width: 38px;
		height: 38px;
		border: 0;
		border-right: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: 0 var(--sy-mobile-space--medium);
		background: transparent;
		color: inherit;
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-small);
	}

	.mobile-reader__theme-button:last-child,
	.mobile-reader__font-button:last-child {
		border-right: 0;
	}

	.mobile-reader__theme-button--active,
	.mobile-reader__theme-button:active,
	.mobile-reader__font-button:active:not(:disabled) {
		color: var(--reader-link-color, var(--sy-color--blue));
		background: rgb(128 128 128 / 14%);
	}

	.mobile-reader__theme-button:disabled,
	.mobile-reader__font-button:disabled {
		opacity: 0.45;
	}

	.mobile-reader__theme-swatch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: 50%;
		box-sizing: border-box;
	}

	.mobile-reader__font-size-value {
		min-width: 42px;
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-size: var(--sy-font-size--mobile-small);
		text-align: center;
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
		height: calc(100% - 104px);
		padding: var(--mobile-reader-stage-padding);
		box-sizing: border-box;
		overflow: hidden;
		touch-action: pan-y;
		background: var(--reader-stage-background, var(--sy-color--grey-2));
	}

	.mobile-reader__page {
		height: 100%;
		margin: 0;
		padding: calc(var(--sy-mobile-space--medium) * 3);
		background: var(--reader-page-background, var(--sy-color--white));
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		overflow: hidden;
		box-sizing: border-box;
		font-family: var(--reader-font-family, var(--sy-font-family));
		font-size: var(--reader-page-font-size, 1.18rem);
		line-height: var(--reader-page-line-height, 2);
		color: var(--reader-page-text, var(--sy-color--black));
	}

	.mobile-reader__page::selection,
	.mobile-reader__page *::selection {
		background: var(--reader-selection-background, #dbeafe);
		color: var(--reader-selection-text, #111827);
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
		font-family: var(--reader-font-family, var(--sy-font-family));
		font-size: var(--reader-page-font-size, 1.18rem);
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
		background: var(--reader-control-background, rgb(255 255 255 / 76%));
		color: var(--reader-control-text, var(--sy-color--grey-4));
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

	.mobile-reader__block--table {
		overflow-x: auto;
		margin: 0 0 1.25em;
	}

	.mobile-reader__data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95em;
	}

	.mobile-reader__data-table td {
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: 0.35em 0.45em;
		vertical-align: top;
	}

	.mobile-reader__figure {
		margin: 0 0 1.25em;
		text-align: center;
	}

	.mobile-reader__inline-image {
		max-width: 100%;
		height: auto;
		display: inline-block;
	}

	.mobile-reader__block--code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.mobile-reader__block--list-bullet {
		position: relative;
		padding-left: 1.15em;
	}

	.mobile-reader__block--list-bullet::before {
		content: '•';
		position: absolute;
		left: 0;
		top: 0;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
	}

	.mobile-reader__block--list-ordered {
		position: relative;
		padding-left: 1.85em;
	}

	.mobile-reader__block--list-ordered::before {
		content: attr(data-ordinal) '. ';
		position: absolute;
		left: 0;
		top: 0;
		min-width: 1.35em;
		text-align: start;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
		font-variant-numeric: tabular-nums;
	}

	blockquote.mobile-reader__block {
		white-space: normal;
		margin: 0 0 1.1em;
		padding: 0.35em 0 0.35em 1em;
		border-left: 0.28em solid var(--reader-border-color, var(--sy-color--grey-2));
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-style: italic;
	}

	h1.mobile-reader__block,
	h2.mobile-reader__block,
	h3.mobile-reader__block,
	h4.mobile-reader__block,
	h5.mobile-reader__block,
	h6.mobile-reader__block {
		white-space: normal;
		line-height: 1.35;
		color: var(--reader-page-text, var(--sy-color--grey-4));
		margin: 0 0 0.75em;
	}

	h1.mobile-reader__block {
		font-size: 1.32em;
	}

	h2.mobile-reader__block {
		font-size: 1.18em;
	}

	h3.mobile-reader__block {
		font-size: 1.08em;
	}

	h4.mobile-reader__block {
		font-size: 1.03em;
	}

	h5.mobile-reader__block,
	h6.mobile-reader__block {
		font-size: 1em;
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
		color: var(--reader-link-color, var(--sy-color--blue));
	}
</style>
