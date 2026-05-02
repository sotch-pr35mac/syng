<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		BookOpen,
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
	import { platform } from '@tauri-apps/plugin-os';
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
	import { isIPad } from '@/utils/device.js';

	const CHARACTER_MEASURE_SAMPLE = '汉字阅读天地学习语言文字故事春夏秋冬';
	const DEFAULT_PAGE_FONT_SIZE = 20;
	const BODY_BLOCK_GAP_EM = 1.4;
	const HEADING_FONT_SCALE = 1.35;
	const HEADING_LINE_HEIGHT = 1.5;
	const PAGE_CURL_DURATION_MS = 760;
	const PERCENTAGE_SCALE = 100;
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
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
</script>

<div class="reader" style={activeDocument ? readerThemeStyle : ''}>
	<div
		class="reader__header"
		class:reader__header--ipad={isIPadDevice}
		data-tauri-drag-region={isMacos ? true : undefined}
	>
		<div class="reader__title-row">
			{#if activeDocument}
				<BookOpen size="22" />
				<h1>{activeDocument.title}</h1>
			{:else}
				<Library size="22" />
				<h1>Library</h1>
			{/if}
		</div>
		<div class="reader__header-actions">
			{#if activeDocument}
				<div class="reader__settings" aria-label="Reader settings">
					<div class="reader__theme-controls" aria-label="Reader theme">
						{#each READER_COLOR_THEMES as theme (theme.id)}
							<button
								type="button"
								class="reader__theme-button"
								class:reader__theme-button--active={readerSettings.colorTheme === theme.id}
								aria-label={`Use ${theme.label} reader theme`}
								aria-pressed={readerSettings.colorTheme === theme.id}
								title={theme.label}
								onclick={() => setReaderTheme(theme.id)}
							>
								<span
									class="reader__theme-swatch"
									style={`background:${theme.backgroundColor};color:${theme.textColor};`}
									aria-hidden="true"
								>
									<Palette size="14" />
								</span>
								<span>{theme.label}</span>
							</button>
						{/each}
					</div>
					<div class="reader__font-controls" aria-label="Reader font size">
						<button
							type="button"
							class="reader__font-button"
							disabled={!canDecreaseFontSize}
							aria-label="Decrease reader font size"
							onclick={readerSettingsStore.decreaseFontSize}
						>
							<Minus size="16" />
							<span>A</span>
						</button>
						<span class="reader__font-size-value" aria-label="Reader font size">
							{readerSettings.fontSizePercent}%
						</span>
						<button
							type="button"
							class="reader__font-button"
							disabled={!canIncreaseFontSize}
							aria-label="Increase reader font size"
							onclick={readerSettingsStore.increaseFontSize}
						>
							<Plus size="16" />
							<span>A</span>
						</button>
					</div>
				</div>
				<SyButton style="ghost" size="large" onclick={readerRoute.backToLibrary}>
					Library
				</SyButton>
			{:else}
				{#if editingLibrary}
					<SyButton
						style="ghost"
						size="large"
						hover="red"
						disabled={!selectedDocuments.length}
						onclick={deleteSelectedDocuments}
					>
						<Trash2 size="18" />
						Delete
					</SyButton>
				{/if}
				<SyButton style="ghost" size="large" onclick={toggleEditing}>
					{editingLibrary ? 'Done' : 'Edit'}
				</SyButton>
			{/if}
		</div>
	</div>

	{#if activeDocument && currentPage}
		<main class="reader__stage">
			<button
				class="reader__page-turn reader__page-turn--previous"
				disabled={!readerRoute.canGoPrevious || turningPage}
				aria-label="Previous page"
				onclick={() => turnPage('previous')}
			>
				<ChevronLeft size="28" />
			</button>
			<span
				bind:this={characterMeasureElement}
				class="reader__measure-text"
				aria-hidden="true"
			>
				{CHARACTER_MEASURE_SAMPLE}
			</span>
			<article
				bind:this={pageElement}
				class="reader__page reader__page--base"
				class:reader__page--turning={turningPage}
			>
				{#each currentPage.blocks as block (block.id)}
					{#if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = activeDocument.blocks.find((b) => b.id === block.sourceBlockId)}
						{#if tableSource?.extensions?.table}
							<div class="reader__block reader__block--table" role="region" aria-label="Table">
								<table class="reader__data-table">
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
																	class="reader__token"
																	class:reader__token--active={readerRoute.tokensMatchDictionarySelection(
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
							<figure class="reader__block reader__figure">
								<img
									src={imageSource.extensions.image.inline_src}
									alt={imageSource.text}
									class="reader__inline-image"
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
							class="reader__block"
							class:reader__block--code={block.kind === 'code_block'}
							class:reader__block--list={block.kind === 'list_item'}
							class:reader__block--list-bullet={block.kind === 'list_item' &&
								sourceBlock?.extensions?.list_item?.list_style !== 'ordered'}
							class:reader__block--list-ordered={block.kind === 'list_item' &&
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
										class="reader__token"
										class:reader__token--active={readerRoute.tokensMatchDictionarySelection(
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
				<div class="reader__page-curl" aria-hidden="true">
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
				class="reader__page-turn reader__page-turn--next"
				disabled={!readerRoute.canGoNext || turningPage}
				aria-label="Next page"
				onclick={() => turnPage('next')}
			>
				<ChevronRight size="28" />
			</button>
			<div class="reader__page-count">
				{readerRoute.pageIndex + 1} / {readerRoute.pageCount}
			</div>
		</main>
	{:else}
		<main class="reader__library">
			<div class="reader__library-grid">
				<div class="reader__import-stack">
					<button
						class="reader__book-card reader__book-card--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openClipboardImportModal}
					>
						<div class="reader__book-cover">
							<ClipboardPaste size="20" />
							<span>Import From Clipboard</span>
						</div>
					</button>
					<button
						class="reader__book-card reader__book-card--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openWebpageImportModal}
					>
						<div class="reader__book-cover">
							<Globe2 size="20" />
							<span>Import From Webpage</span>
						</div>
					</button>
					<button
						class="reader__book-card reader__book-card--import"
						disabled={readerRoute.importing || editingLibrary}
						onclick={openFileImportDetails}
					>
						<div class="reader__book-cover">
							<FilePlus2 size="20" />
							<span>{readerRoute.importing ? 'Importing...' : 'Import Document'}</span
							>
						</div>
					</button>
				</div>
				{#each documents as document (document._id)}
					<div
						class="reader__book-card"
						class:reader__book-card--selected={selectedDocumentIds.has(document._id)}
						style={`--reader-book-color: ${normalizeReaderDocumentColor(document.color)};`}
						onclick={() => handleDocumentCardClick(document)}
						onkeyup={(event) => handleDocumentCardKey(event, document)}
						role="button"
						tabindex="0"
					>
						<div class="reader__book-cover">
							{#if editingLibrary}
								<span class="reader__selection-indicator">
									{#if selectedDocumentIds.has(document._id)}
										<CheckCircle2 size="22" />
									{:else}
										<Circle size="22" />
									{/if}
								</span>
								<button
									class="reader__metadata-button"
									type="button"
									aria-label={`Edit ${document.title}`}
									onclick={(event) => openDocumentDetails(event, document)}
								>
									<Pencil size="16" />
								</button>
							{/if}
							<span class="reader__book-title">{document.title}</span>
							<span class="reader__book-meta">{document.file_name}</span>
							<span class="reader__book-progress">
								{getDocumentProgressPercent(document)}%
							</span>
						</div>
					</div>
				{/each}
			</div>
			{#if !documents.length}
				<div class="reader__empty">
					<BookOpen size="42" />
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
	.reader {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: var(--reader-stage-background, var(--sy-color--grey-2));
	}

	.reader__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sy-space--extra-large) var(--sy-space--large);
		background-color: var(--sy-color--white);
		box-shadow: var(--sy-box-shadow);
		z-index: var(--sy-z-index--base-2);
	}

	.reader__header--ipad {
		padding-top: var(--sy-space--large);
		padding-bottom: var(--sy-space--large);
	}

	.reader__title-row,
	.reader__header-actions {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		min-width: 0;
		color: var(--sy-color--grey-4);
	}

	.reader__header-actions {
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.reader__title-row h1 {
		margin: 0;
		font-size: 1.4rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reader__settings {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		color: var(--reader-control-text, var(--sy-color--grey-4));
	}

	.reader__theme-controls,
	.reader__font-controls {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: var(--sy-border-radius);
		background: var(--reader-control-background, rgb(255 255 255 / 84%));
		box-shadow: var(--sy-shadow);
		overflow: hidden;
	}

	.reader__theme-button,
	.reader__font-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		min-height: 34px;
		border: 0;
		border-right: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: var(--sy-space) var(--sy-space--large);
		background: transparent;
		color: inherit;
		font-family: var(--sy-font-family);
		font-size: 0.82rem;
		cursor: pointer;
	}

	.reader__theme-button:last-child,
	.reader__font-button:last-child {
		border-right: 0;
	}

	.reader__theme-button:hover,
	.reader__theme-button--active,
	.reader__font-button:hover:not(:disabled) {
		color: var(--reader-link-color, var(--sy-color--blue));
		background: rgb(128 128 128 / 12%);
	}

	.reader__theme-button:focus-visible,
	.reader__font-button:focus-visible {
		outline: 2px solid var(--reader-link-color, var(--sy-color--blue));
		outline-offset: -2px;
	}

	.reader__theme-button:disabled,
	.reader__font-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.reader__theme-swatch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: 50%;
		box-sizing: border-box;
	}

	.reader__font-size-value {
		min-width: 48px;
		padding: 0 var(--sy-space--large);
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-family: var(--sy-font-family);
		font-size: 0.82rem;
		text-align: center;
	}

	.reader__library {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: clamp(24px, 4vw, 56px);
		box-sizing: border-box;
	}

	.reader__library-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: clamp(18px, 3vw, 34px);
		align-items: start;
	}

	.reader__book-card {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		border: 0;
		padding: 0;
		background: transparent;
		font-family: var(--sy-font-family);
		text-align: left;
		cursor: pointer;
	}

	.reader__import-stack {
		display: grid;
		grid-template-rows: repeat(3, 1fr);
		gap: var(--sy-space);
		aspect-ratio: 2 / 3;
	}

	.reader__import-stack .reader__book-card {
		height: 100%;
		aspect-ratio: auto;
	}

	.reader__book-card:focus-visible {
		outline: 2px solid var(--sy-color--blue);
		outline-offset: 4px;
	}

	.reader__book-card:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.reader__book-cover {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 100%;
		padding: var(--sy-space--large);
		box-sizing: border-box;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background:
			linear-gradient(90deg, rgb(0 0 0 / 12%) 0 12px, transparent 12px),
			var(--reader-book-color, var(--sy-color--white));
		box-shadow: var(--sy-shadow);
		color: var(--sy-color--grey-4);
		transition:
			box-shadow var(--sy-transition-duration),
			transform var(--sy-transition-duration),
			border-color var(--sy-transition-duration);
	}

	.reader__book-card:hover .reader__book-cover,
	.reader__book-card--selected .reader__book-cover {
		border-color: var(--sy-color--blue);
		box-shadow: var(--sy-shadow--active);
		transform: translateY(-2px);
	}

	.reader__book-card--import .reader__book-cover {
		align-items: center;
		justify-content: center;
		gap: var(--sy-space);
		color: var(--sy-color--blue);
		font-size: 0.82rem;
		line-height: 1.2;
		padding: var(--sy-space);
		text-align: center;
	}

	.reader__book-card:not(.reader__book-card--import) .reader__book-cover {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.reader__selection-indicator {
		position: absolute;
		top: var(--sy-space--large);
		right: var(--sy-space--large);
		color: var(--sy-color--blue);
	}

	.reader__metadata-button {
		position: absolute;
		top: var(--sy-space--large);
		left: var(--sy-space--large);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 86%);
		color: var(--sy-color--grey-4);
		box-shadow: var(--sy-shadow);
		cursor: pointer;
	}

	.reader__metadata-button:hover,
	.reader__metadata-button:focus-visible {
		color: var(--sy-color--blue);
	}

	.reader__book-title {
		max-width: 100%;
		padding: var(--sy-space--small) var(--sy-space);
		border-radius: var(--sy-border-radius);
		background: rgb(255 255 255 / 78%);
		color: var(--sy-color--black);
		font-size: 1rem;
		font-weight: var(--sy-font-weight--medium);
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.reader__book-meta,
	.reader__book-progress {
		position: absolute;
		left: var(--sy-space--large);
		right: var(--sy-space--large);
		bottom: var(--sy-space--large);
		margin-top: var(--sy-space--small);
		font-size: 0.78rem;
		color: var(--sy-color--grey-5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reader__book-meta {
		bottom: calc(var(--sy-space--large) + 1.2rem);
	}

	.reader__stage {
		--reader-stage-padding: clamp(16px, 2vw, 28px);
		--reader-chevron-width: clamp(32px, 3vw, 44px);

		position: relative;
		flex: 1;
		min-height: 0;
		padding: var(--reader-stage-padding) var(--reader-chevron-width);
		box-sizing: border-box;
		overflow: hidden;
		background: var(--reader-stage-background, var(--sy-color--grey-2));
	}

	.reader__page {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: clamp(44px, 6vw, 96px);
		background: var(--reader-page-background, var(--sy-color--white));
		box-shadow: var(--sy-shadow);
		border-radius: var(--sy-border-radius);
		overflow: hidden;
		box-sizing: border-box;
		font-family: var(--reader-font-family, var(--sy-font-family));
		font-size: var(--reader-page-font-size, 1.24rem);
		line-height: var(--reader-page-line-height, 2);
		color: var(--reader-page-text, var(--sy-color--black));
	}

	.reader__page::selection,
	.reader__page *::selection {
		background: var(--reader-selection-background, #dbeafe);
		color: var(--reader-selection-text, #111827);
	}

	.reader__page--base {
		position: relative;
		z-index: 0;
	}

	.reader__page--turning {
		opacity: 0;
	}

	.reader__page-curl {
		position: absolute;
		top: var(--reader-stage-padding);
		bottom: var(--reader-stage-padding);
		left: var(--reader-chevron-width);
		right: var(--reader-chevron-width);
		z-index: var(--sy-z-index--base);
		border-radius: var(--sy-border-radius);
		box-shadow: var(--sy-shadow);
		pointer-events: none;
	}

	.reader__measure-text {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		font-family: var(--reader-font-family, var(--sy-font-family));
		font-size: var(--reader-page-font-size, 1.24rem);
		line-height: 1;
		white-space: nowrap;
	}

	.reader__page-turn {
		position: absolute;
		top: var(--reader-stage-padding);
		bottom: var(--reader-stage-padding);
		z-index: calc(var(--sy-z-index--base) + 1);
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--reader-chevron-width);
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		cursor: pointer;
		opacity: 0.4;
		transition: opacity var(--sy-transition-duration);
	}

	.reader__page-turn--previous {
		left: 0;
	}

	.reader__page-turn--next {
		right: 0;
	}

	.reader__page-turn:not(:disabled):hover,
	.reader__page-turn:not(:disabled):focus-visible {
		opacity: 1;
	}

	.reader__page-turn:disabled {
		opacity: 0;
		cursor: not-allowed;
	}

	.reader__page-count {
		position: absolute;
		z-index: calc(var(--sy-z-index--base) + 1);
		right: calc(var(--reader-chevron-width) + 12px);
		bottom: calc(var(--reader-stage-padding) + 8px);
		padding: var(--sy-space) var(--sy-space--large);
		border-radius: var(--sy-border-radius);
		background: var(--reader-control-background, rgb(255 255 255 / 84%));
		color: var(--reader-control-text, var(--sy-color--grey-4));
		font-family: var(--sy-font-family);
		font-size: 0.86rem;
		box-shadow: var(--sy-shadow);
	}

	.reader__block {
		white-space: pre-wrap;
		margin: 0 0 1.4em;
	}

	.reader__block--table {
		overflow-x: auto;
		margin: 0 0 1.4em;
	}

	.reader__data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95em;
	}

	.reader__data-table td {
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: 0.35em 0.45em;
		vertical-align: top;
	}

	.reader__figure {
		margin: 0 0 1.4em;
		text-align: center;
	}

	.reader__inline-image {
		max-width: 100%;
		height: auto;
		display: inline-block;
	}

	.reader__block--code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.reader__block--list-bullet {
		position: relative;
		padding-left: 1.15em;
	}

	.reader__block--list-bullet::before {
		content: '•';
		position: absolute;
		left: 0;
		top: 0;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
	}

	.reader__block--list-ordered {
		position: relative;
		padding-left: 1.85em;
	}

	.reader__block--list-ordered::before {
		content: attr(data-ordinal) '. ';
		position: absolute;
		left: 0;
		top: 0;
		min-width: 1.35em;
		text-align: start;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
		font-variant-numeric: tabular-nums;
	}

	blockquote.reader__block {
		white-space: normal;
		margin: 0 0 1.2em;
		padding: 0.35em 0 0.35em 1em;
		border-left: 0.28em solid var(--reader-border-color, var(--sy-color--grey-2));
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-style: italic;
	}

	h1.reader__block,
	h2.reader__block,
	h3.reader__block,
	h4.reader__block,
	h5.reader__block,
	h6.reader__block {
		white-space: normal;
		line-height: 1.35;
		color: var(--reader-page-text, var(--sy-color--grey-4));
		margin: 0 0 0.75em;
	}

	h1.reader__block {
		font-size: 1.35em;
	}

	h2.reader__block {
		font-size: 1.2em;
	}

	h3.reader__block {
		font-size: 1.1em;
	}

	h4.reader__block {
		font-size: 1.05em;
	}

	h5.reader__block,
	h6.reader__block {
		font-size: 1em;
	}

	.reader__token {
		display: inline;
		border: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		border-bottom: 1px solid transparent;
	}

	.reader__token:hover,
	.reader__token--active {
		color: var(--reader-link-color, var(--sy-color--blue));
		border-bottom-color: var(--reader-link-color, var(--sy-color--blue));
	}

	.reader__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--large);
		min-height: 240px;
		color: var(--sy-color--grey-4);
		font-family: var(--sy-font-family);
	}
</style>
