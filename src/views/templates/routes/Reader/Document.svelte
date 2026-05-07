<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		ChevronLeft,
		ChevronRight,
		Minus,
		Palette,
		Plus,
		SlidersHorizontal,
	} from 'lucide-svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import {
		getReaderColorTheme,
		getReaderColorThemeSettings,
		READER_COLOR_THEMES,
		READER_FONT_SIZE_MAX_PERCENT,
		READER_FONT_SIZE_MIN_PERCENT,
	} from '@/reader/settings/defaults.js';
	import CssPageCurlOverlay from '@/reader/animation/CssPageCurlOverlay.svelte';
	import { createReaderPageSnapshot } from '@/reader/animation/pageSnapshot.js';
	import type {
		ReaderBlockStyleExtension,
		ReaderContentBlock,
		ReaderToken,
	} from '@/types/reader.js';
	import type { ReaderColorThemeId } from '@/reader/types.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import { isIPad } from '@/utils/device.js';
	import {
		READER_IMAGE_MAX_HEIGHT_RATIO,
		READER_TABLE_MAX_HEIGHT_RATIO,
	} from '@/utils/readerPagination.js';

	type Props = {
		params?: {
			id?: string;
		};
	};

	const { params = {} }: Props = $props();
	const CHARACTER_MEASURE_SAMPLE = '汉字阅读天地学习语言文字故事春夏秋冬';
	const DEFAULT_PAGE_FONT_SIZE = 20;
	const BODY_BLOCK_GAP_EM = 1.4;
	const HEADING_FONT_SCALE = 1.35;
	const HEADING_LINE_HEIGHT = 1.5;
	const LIST_NESTING_INDENT_EM = 1.25;
	const MAX_HEADING_LEVEL = 6;
	const PAGE_CURL_DURATION_MS = 760;
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	const READER_SETTINGS_POPOVER_WIDTH_PX = 470;
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();
	const activeDocument = $derived(readerRoute.activeDocument);
	const routeDocumentId = $derived(params.id ? decodeURIComponent(params.id) : undefined);
	const currentPage = $derived(readerRoute.currentPage);
	const readerSettings = $derived(readerSettingsStore.settings);
	let systemPrefersDark = $state(false);
	let pageContentHeight = $state(0);
	const activeReaderTheme = $derived(
		getReaderColorTheme(readerSettings.colorTheme, systemPrefersDark)
	);
	const activeReaderThemeSettings = $derived(
		getReaderColorThemeSettings(readerSettings.colorTheme, systemPrefersDark)
	);
	const canDecreaseFontSize = $derived(
		readerSettings.fontSizePercent > READER_FONT_SIZE_MIN_PERCENT
	);
	const canIncreaseFontSize = $derived(
		readerSettings.fontSizePercent < READER_FONT_SIZE_MAX_PERCENT
	);
	const readerThemeStyle = $derived(
		[
			`--reader-page-background: ${activeReaderThemeSettings.backgroundColor}`,
			`--reader-page-text: ${activeReaderThemeSettings.textColor}`,
			`--reader-link-color: ${activeReaderThemeSettings.linkColor}`,
			`--reader-selection-background: ${activeReaderThemeSettings.selectionBackgroundColor}`,
			`--reader-selection-text: ${activeReaderThemeSettings.selectionTextColor}`,
			`--reader-stage-background: ${activeReaderTheme.stageBackgroundColor}`,
			`--reader-muted-text: ${activeReaderTheme.mutedTextColor}`,
			`--reader-border-color: ${activeReaderTheme.borderColor}`,
			`--reader-control-background: ${activeReaderTheme.controlBackgroundColor}`,
			`--reader-control-text: ${activeReaderTheme.controlTextColor}`,
			`--reader-font-family: ${readerSettings.fontFamily}`,
			`--reader-page-font-size: ${(DEFAULT_PAGE_FONT_SIZE * readerSettings.fontSizePercent) / 100}px`,
			`--reader-page-line-height: ${readerSettings.lineHeight}`,
			`--reader-image-max-height: ${pageContentHeight ? `${pageContentHeight * READER_IMAGE_MAX_HEIGHT_RATIO}px` : 'none'}`,
			`--reader-table-max-height: ${pageContentHeight ? `${pageContentHeight * READER_TABLE_MAX_HEIGHT_RATIO}px` : 'none'}`,
		].join(';')
	);
	let pageElement = $state<HTMLElement | undefined>(undefined);
	let characterMeasureElement = $state<HTMLElement | undefined>(undefined);
	let turningPage = $state(false);
	let turningPageDirection = $state<'next' | 'previous' | undefined>(undefined);
	let currentPageImage = $state<string | undefined>(undefined);
	let targetPageImage = $state<string | undefined>(undefined);
	let pendingTargetPageIndex = $state<number | undefined>(undefined);
	let lastRouteDocumentId = $state<string | undefined | null>(undefined);
	let routeLoadRequest = $state(0);
	let readerSettingsPopoverVisible = $state(false);
	let readerSettingsButtonElement = $state<HTMLElement | undefined>(undefined);
	let readerSettingsPopoverAnchor = $state<DOMRect | undefined>(undefined);
	const activeDocumentVerticalWriting = $derived(
		Boolean(
			activeDocument?.blocks.some(
				(block) => getBlockStyle(block)?.vertical_writing_mode === true
			)
		)
	);

	onMount(() => {
		readerRoute.refresh().catch(() => {});
		readerSettingsStore.loadSettings().catch(() => {});

		const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const updateSystemColorScheme = () => {
			systemPrefersDark = colorSchemeQuery.matches;
		};
		updateSystemColorScheme();
		colorSchemeQuery.addEventListener('change', updateSystemColorScheme);

		return () => {
			colorSchemeQuery.removeEventListener('change', updateSystemColorScheme);
		};
	});

	$effect(() => {
		const documentId = routeDocumentId;
		if ((documentId ?? null) === lastRouteDocumentId) {
			return;
		}
		lastRouteDocumentId = documentId ?? null;
		routeLoadRequest += 1;
		const requestId = routeLoadRequest;
		if (!documentId) {
			window.location.hash = '#/read';
			return;
		}
		readerRoute
			.refresh()
			.then(() => {
				if (routeLoadRequest === requestId) {
					return readerRoute.openDocumentById(documentId);
				}
				return undefined;
			})
			.catch(() => {});
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

	$effect(() => {
		currentPage;
		pageElement;
		pageContentHeight;
		schedulePageOverflowCheck();
	});

	$effect(() => {
		if (!activeDocument) {
			readerSettingsPopoverVisible = false;
			readerSettingsPopoverAnchor = undefined;
		}
	});

	function openToken(event: MouseEvent, token: ReaderToken | undefined): void {
		if (!token || !(event.currentTarget instanceof HTMLElement)) {
			return;
		}
		readerRoute.openDictionary(token, event.currentTarget.getBoundingClientRect());
	}

	function getBlockStyle(block: ReaderContentBlock | undefined): ReaderBlockStyleExtension {
		return block?.extensions?.block_style ?? {};
	}

	function getBlockCssStyle(block: ReaderContentBlock | undefined): string | undefined {
		const styles: string[] = [];
		const blockStyle = getBlockStyle(block);
		const listDepth = block?.extensions?.list_item?.nesting_depth;
		if (typeof listDepth === 'number') {
			styles.push(
				`--reader-list-depth-offset: ${Math.max(0, listDepth) * LIST_NESTING_INDENT_EM}em`
			);
		}
		if (blockStyle.text_align || block?.text_align) {
			styles.push(`text-align: ${blockStyle.text_align ?? block?.text_align}`);
		}
		if (blockStyle.text_indent) {
			styles.push(`text-indent: ${blockStyle.text_indent}`);
		}
		if (blockStyle.vertical_writing_mode) {
			styles.push('writing-mode: vertical-rl');
		}
		return styles.length ? styles.join(';') : undefined;
	}

	function backToLibrary(): void {
		readerRoute.backToLibrary();
		window.location.hash = '#/read';
	}

	function setReaderTheme(theme: ReaderColorThemeId): void {
		if (readerSettings.colorTheme !== theme) {
			readerRoute.trackThemeChanged(theme);
		}
		readerSettingsStore.applyColorTheme(theme);
	}

	function changeReaderFontSize(direction: 'increase' | 'decrease'): void {
		const previousFontSize = readerSettings.fontSizePercent;
		if (direction === 'increase') {
			readerSettingsStore.increaseFontSize();
		} else {
			readerSettingsStore.decreaseFontSize();
		}
		const nextFontSize = readerSettingsStore.settings.fontSizePercent;
		if (nextFontSize !== previousFontSize) {
			readerRoute.trackLayoutChanged('font_size_percent', nextFontSize, direction);
		}
	}

	function toggleReaderSettingsPopover(event: MouseEvent): void {
		if (!(event.currentTarget instanceof HTMLElement)) {
			return;
		}
		readerSettingsButtonElement = event.currentTarget;
		readerSettingsPopoverAnchor = event.currentTarget.getBoundingClientRect();
		readerSettingsPopoverVisible = !readerSettingsPopoverVisible;
	}

	function closeReaderSettingsPopover(): void {
		readerSettingsPopoverVisible = false;
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
		const contentHeight = pageElement.clientHeight - paddingY;
		const measuredCharacterWidth = characterMeasureElement
			? characterMeasureElement.getBoundingClientRect().width /
				CHARACTER_MEASURE_SAMPLE.length
			: fontSize;
		pageContentHeight = contentHeight;

		await readerRoute.setPageLayout({
			contentWidth: pageElement.clientWidth - paddingX,
			contentHeight,
			fontSize,
			lineHeight,
			blockGap: fontSize * BODY_BLOCK_GAP_EM,
			headingLineHeight: fontSize * HEADING_FONT_SCALE * HEADING_LINE_HEIGHT,
			headingGap: fontSize * BODY_BLOCK_GAP_EM,
			averageCharacterWidth: measuredCharacterWidth,
		});
	}

	function schedulePageOverflowCheck(): void {
		tick()
			.then(() => checkPageOverflow())
			.catch(() => {});
	}

	async function checkPageOverflow(): Promise<void> {
		await tick();
		if (!pageElement || turningPage) {
			return;
		}
		if (pageElement.scrollHeight - pageElement.clientHeight <= 1) {
			return;
		}

		const measuredBlocks = pageElement.querySelectorAll<HTMLElement>(
			'[data-reader-atomic-block-id]'
		);
		const measurements = Object.fromEntries(
			Array.from(measuredBlocks)
				.map((element) => [
					element.dataset.readerAtomicBlockId,
					element.getBoundingClientRect().height,
				])
				.filter(
					(entry): entry is [string, number] =>
						typeof entry[0] === 'string' &&
						typeof entry[1] === 'number' &&
						Number.isFinite(entry[1]) &&
						entry[1] > 0
				)
		);

		if (Object.keys(measurements).length) {
			await readerRoute.updateMeasuredAtomicBlockHeights(measurements);
		}
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
			<SyButton
				style="ghost"
				size="large"
				center={true}
				classes={['reader__library-back-button']}
				onclick={backToLibrary}
			>
				<ChevronLeft size="20" />
				Library
			</SyButton>
			<span class="reader__document-title">{activeDocument?.title ?? 'Reader'}</span>
		</div>
		<div class="reader__header-actions">
			<SyButton
				style="ghost"
				size="large"
				center={true}
				disabled={!activeDocument}
				aria-label="Reader settings"
				aria-pressed={readerSettingsPopoverVisible}
				onclick={toggleReaderSettingsPopover}
			>
				<SlidersHorizontal size="20" />
			</SyButton>
			<SyPopover
				visible={readerSettingsPopoverVisible}
				anchor={readerSettingsPopoverAnchor}
				ignoreElement={readerSettingsButtonElement}
				horizontalAlign="end"
				width={READER_SETTINGS_POPOVER_WIDTH_PX}
				mobileTitle="Reader settings"
				onclose={closeReaderSettingsPopover}
			>
				<div class="reader__settings-popover" aria-label="Reader settings">
					<div class="reader__settings-section">
						<span class="reader__settings-label">Theme</span>
						<SyButtonBar size="large" aria-label="Reader theme">
							{#each READER_COLOR_THEMES as theme (theme.id)}
								{@const resolvedTheme = getReaderColorTheme(
									theme.id,
									systemPrefersDark
								)}
								<SyButton
									grouped={true}
									center={true}
									color={readerSettings.colorTheme === theme.id
										? 'blue'
										: undefined}
									aria-label={`Use ${theme.label} reader theme`}
									aria-pressed={readerSettings.colorTheme === theme.id}
									title={theme.label}
									onclick={() => setReaderTheme(theme.id)}
								>
									<span class="reader__theme-button-content">
										<span
											class="reader__theme-swatch"
											style={`background:${resolvedTheme.backgroundColor};color:${resolvedTheme.textColor};`}
											aria-hidden="true"
										>
											<Palette size="14" />
										</span>
										<span>{theme.label}</span>
									</span>
								</SyButton>
							{/each}
						</SyButtonBar>
					</div>
					<div class="reader__settings-section">
						<span class="reader__settings-label">Text size</span>
						<SyButtonBar size="large" aria-label="Reader font size">
							<SyButton
								grouped={true}
								center={true}
								disabled={!canDecreaseFontSize}
								aria-label="Decrease reader font size"
								onclick={() => changeReaderFontSize('decrease')}
							>
								<Minus size="16" />
								<span>A</span>
							</SyButton>
							<SyButton
								grouped={true}
								center={true}
								disabled={true}
								disableHoverActions={true}
								classes={['reader__font-size-value']}
								aria-label={`Reader font size: ${readerSettings.fontSizePercent}%`}
							>
								{readerSettings.fontSizePercent}%
							</SyButton>
							<SyButton
								grouped={true}
								center={true}
								disabled={!canIncreaseFontSize}
								aria-label="Increase reader font size"
								onclick={() => changeReaderFontSize('increase')}
							>
								<Plus size="16" />
								<span>A</span>
							</SyButton>
						</SyButtonBar>
					</div>
				</div>
			</SyPopover>
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
				class:reader__page--vertical={activeDocumentVerticalWriting}
			>
				{#each currentPage.blocks as block (block.id)}
					{#if block.layout_mode === 'atomic' && block.kind === 'thematic_break'}
						<hr
							class="reader__block reader__thematic-break"
							data-reader-atomic-block-id={block.sourceBlockId}
						/>
					{:else if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = activeDocument.blocks.find(
							(b) => b.id === block.sourceBlockId
						)}
						{#if tableSource?.extensions?.table}
							<div
								class="reader__block reader__block--table"
								role="region"
								aria-label="Table"
								data-reader-atomic-block-id={block.sourceBlockId}
							>
								<table class="reader__data-table">
									<tbody>
										{#each tableSource.extensions.table.rows as row, rowIndex (rowIndex)}
											<tr>
												{#each row.cells as cell, colIndex (colIndex)}
													<svelte:element
														this={cell.is_header ? 'th' : 'td'}
													>
														{#each readerRoute.getTableCellSegments(tableSource.id, rowIndex, colIndex, cell.text) as segment, segIndex (segIndex)}
															{#if segment.type === 'token'}
																{#if segment.annotation}
																	<ruby class="reader__ruby">
																		<button
																			class="reader__token"
																			class:reader__token--active={readerRoute.tokensMatchDictionarySelection(
																				segment.token,
																				readerRoute.dictionaryToken
																			)}
																			onclick={(event) =>
																				openToken(
																					event,
																					segment.token
																				)}
																		>
																			{segment.text}
																		</button>
																		<rt>{segment.annotation}</rt
																		>
																	</ruby>
																{:else}
																	<button
																		class="reader__token"
																		class:reader__token--active={readerRoute.tokensMatchDictionarySelection(
																			segment.token,
																			readerRoute.dictionaryToken
																		)}
																		onclick={(event) =>
																			openToken(
																				event,
																				segment.token
																			)}
																	>
																		{segment.text}
																	</button>
																{/if}
															{:else if segment.annotation}
																<ruby class="reader__ruby">
																	{segment.text}<rt
																		>{segment.annotation}</rt
																	>
																</ruby>
															{:else}
																{segment.text}
															{/if}
														{/each}
													</svelte:element>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{:else if block.layout_mode === 'atomic' && block.kind === 'image'}
						{@const imageSource = activeDocument.blocks.find(
							(b) => b.id === block.sourceBlockId
						)}
						{#if imageSource}
							<figure
								class="reader__block reader__figure"
								data-reader-atomic-block-id={block.sourceBlockId}
							>
								{#if imageSource.extensions?.image?.inline_src}
									<img
										src={imageSource.extensions.image.inline_src}
										alt={imageSource.text}
										class="reader__inline-image"
										width={imageSource.extensions.image.width ?? undefined}
										height={imageSource.extensions.image.height ?? undefined}
										onload={schedulePageOverflowCheck}
									/>
								{:else if imageSource.text}
									<figcaption class="reader__image-caption">
										{imageSource.text}
									</figcaption>
								{/if}
							</figure>
						{/if}
					{:else}
						{@const sourceBlock = activeDocument.blocks.find(
							(b) => b.id === block.sourceBlockId
						)}
						<svelte:element
							this={block.kind === 'heading'
								? (`h${Math.min(MAX_HEADING_LEVEL, Math.max(1, sourceBlock?.heading_level ?? 2))}` as
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
							class:reader__block--aside={block.kind === 'aside'}
							class:reader__block--note={Boolean(getBlockStyle(sourceBlock).note)}
							class:reader__block--boxed={Boolean(getBlockStyle(sourceBlock).boxed)}
							class:reader__block--poem={Boolean(getBlockStyle(sourceBlock).poem)}
							class:reader__block--small={Boolean(
								getBlockStyle(sourceBlock).small_text
							)}
							class:reader__block--centered={Boolean(
								getBlockStyle(sourceBlock).centered
							)}
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
							style={getBlockCssStyle(sourceBlock)}
						>
							{#each readerRoute.getBlockSegments(block) as segment, index (index)}
								{#if segment.type === 'token'}
									{#if segment.annotation}
										<ruby class="reader__ruby">
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
											<rt>{segment.annotation}</rt>
										</ruby>
									{:else}
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
									{/if}
								{:else if segment.annotation}
									<ruby class="reader__ruby">
										{segment.text}<rt>{segment.annotation}</rt>
									</ruby>
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
		<main class="reader__stage reader__stage--empty">
			<span>Loading document...</span>
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
	onlink={readerRoute.lookupDictionaryWord}
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

	:global(.reader__library-back-button) {
		gap: var(--sy-space);
		margin: 0;
		color: var(--sy-color--grey-4);
	}

	.reader__document-title {
		min-width: 0;
		max-width: min(42vw, 520px);
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size);
		font-weight: var(--sy-font-weight--medium);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reader__settings-popover {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding: var(--sy-space--large);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
	}

	.reader__settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
	}

	.reader__settings-label {
		font-family: var(--sy-font-family);
		font-size: 0.78rem;
		font-weight: var(--sy-font-weight--medium);
		color: var(--sy-color--grey-4);
	}

	.reader__theme-button-content {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
		font-size: 0.82rem;
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

	:global(.reader__font-size-value) {
		min-width: 64px;
		color: var(--sy-color--black);
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

	.reader__stage--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-family: var(--sy-font-family);
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

	.reader__page--vertical {
		writing-mode: vertical-rl;
		text-orientation: mixed;
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

	.reader__block--small {
		font-size: 0.86em;
	}

	.reader__block--centered,
	.reader__block--poem {
		text-align: center;
	}

	.reader__block--aside,
	.reader__block--note,
	.reader__block--boxed {
		padding: 0.85em 1em;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: var(--sy-border-radius);
		background: rgb(128 128 128 / 8%);
	}

	.reader__block--poem {
		width: max-content;
		max-width: 100%;
		margin-inline: auto;
		white-space: pre-wrap;
	}

	.reader__thematic-break {
		height: 1px;
		border: 0;
		margin: 1.2em 0 1.8em;
		background: var(--reader-border-color, var(--sy-color--grey-2));
	}

	.reader__block--table {
		max-height: var(--reader-table-max-height, none);
		overflow: auto;
		margin: 0 0 1.4em;
	}

	.reader__data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95em;
	}

	.reader__data-table td,
	.reader__data-table th {
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: 0.35em 0.45em;
		vertical-align: top;
	}

	.reader__data-table th {
		background: rgb(128 128 128 / 10%);
		font-weight: var(--sy-font-weight--bold);
		text-align: start;
	}

	.reader__figure {
		margin: 0 0 1.4em;
		text-align: center;
	}

	.reader__inline-image {
		max-width: 70%;
		max-height: var(--reader-image-max-height, none);
		height: auto;
		display: inline-block;
		object-fit: contain;
	}

	.reader__image-caption {
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-size: 0.9em;
		font-style: italic;
	}

	.reader__block--code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.reader__block--list-bullet {
		position: relative;
		padding-left: calc(1.15em + var(--reader-list-depth-offset, 0em));
	}

	.reader__block--list-bullet::before {
		content: '•';
		position: absolute;
		left: var(--reader-list-depth-offset, 0);
		top: 0;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
	}

	.reader__block--list-ordered {
		position: relative;
		padding-left: calc(1.85em + var(--reader-list-depth-offset, 0em));
	}

	.reader__block--list-ordered::before {
		content: attr(data-ordinal) '. ';
		position: absolute;
		left: var(--reader-list-depth-offset, 0);
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

	.reader__ruby rt {
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-size: 0.52em;
		font-weight: 500;
		line-height: 1;
	}
</style>
