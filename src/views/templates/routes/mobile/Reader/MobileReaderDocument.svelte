<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ChevronLeft, SlidersHorizontal } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import ReaderThemeSelector from '@/components/Reader/ReaderThemeSelector.svelte';
	import ReaderTextSizeSelector from '@/components/Reader/ReaderTextSizeSelector.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import { readerPageSwipe } from '@/actions/readerPageSwipe.svelte.js';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import { isAndroid, isIos } from '@/utils/device.js';
	import {
		getReaderColorTheme,
		getReaderColorThemeSettings,
		READER_FONT_SIZE_MAX_PERCENT,
		READER_FONT_SIZE_MIN_PERCENT,
	} from '@/utils/readerSettings.js';
	import CssPageCurlOverlay from '@/components/Reader/CssPageCurlOverlay.svelte';
	import type {
		ReaderBlockStyleExtension,
		ReaderColorThemeId,
		ReaderContentBlock,
		ReaderToken,
	} from '@/types/reader.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
	import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
	import {
		createReaderPageSnapshot,
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
	const DEFAULT_PAGE_FONT_SIZE = 19;
	const BODY_BLOCK_GAP_EM = 1.25;
	const HEADING_FONT_SCALE = 1.28;
	const HEADING_LINE_HEIGHT = 1.5;
	const LIST_NESTING_INDENT_EM = 1.15;
	const MAX_HEADING_LEVEL = 6;
	const PAGE_CURL_DURATION_MS = 720;
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
	let readerSettingsPopoverVisible = $state(false);
	let readerSettingsButtonElement = $state<HTMLElement | undefined>(undefined);
	let readerSettingsPopoverAnchor = $state<DOMRect | undefined>(undefined);
	let pageElement = $state<HTMLElement | undefined>(undefined);
	let characterMeasureElement = $state<HTMLElement | undefined>(undefined);
	let turningPage = $state(false);
	let turningPageDirection = $state<'next' | 'previous' | undefined>(undefined);
	let currentPageImage = $state<string | undefined>(undefined);
	let targetPageImage = $state<string | undefined>(undefined);
	let pendingTargetPageIndex = $state<number | undefined>(undefined);
	const readerPageSwipeOptions = $derived({
		enabled: !turningPage,
		onTurnPage: turnPage,
	});
	let lastRouteDocumentId = $state<string | undefined | null>(undefined);
	let routeLoadRequest = $state(0);
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
			if (readerDocumentRouteStore.value) {
				window.location.hash = `#/read/document/${encodeURIComponent(readerDocumentRouteStore.value)}`;
				return;
			}
			if (activeDocument) {
				window.location.hash = `#/read/document/${encodeURIComponent(activeDocument._id)}`;
				return;
			}
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
			headingFontScale: HEADING_FONT_SCALE,
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

<div class="mobile-reader-document" style={activeDocument && currentPage ? readerThemeStyle : ''}>
	{#if activeDocument && currentPage}
		<div class="mobile-reader-document__reader-header">
			<SyButton style="ghost" size="small" onclick={backToLibrary}>
				<ChevronLeft size="18" />
			</SyButton>
			<span class="mobile-reader-document__document-title">{activeDocument.title}</span>
			<div class="mobile-reader-document__header-actions">
				<SyButton
					style="ghost"
					size="small"
					aria-label="Reader settings"
					aria-pressed={readerSettingsPopoverVisible}
					onclick={toggleReaderSettingsPopover}
				>
					<SlidersHorizontal size="18" />
				</SyButton>
			</div>
		</div>
		<SyPopover
			visible={readerSettingsPopoverVisible}
			anchor={readerSettingsPopoverAnchor}
			ignoreElement={readerSettingsButtonElement}
			horizontalAlign="end"
			mobileTitle="Reader settings"
			onclose={closeReaderSettingsPopover}
		>
			<div class="mobile-reader-document__settings-popover" aria-label="Reader settings">
				<div class="mobile-reader-document__settings-section">
					<span class="mobile-reader-document__settings-label">Theme</span>
					<ReaderThemeSelector
						colorTheme={readerSettings.colorTheme}
						{systemPrefersDark}
						onchange={setReaderTheme}
					/>
				</div>
				<div class="mobile-reader-document__settings-section">
					<span class="mobile-reader-document__settings-label">Text size</span>
					<ReaderTextSizeSelector
						fontSizePercent={readerSettings.fontSizePercent}
						canDecrease={canDecreaseFontSize}
						canIncrease={canIncreaseFontSize}
						onchange={changeReaderFontSize}
					/>
				</div>
			</div>
		</SyPopover>
		<main
			class="mobile-reader-document__stage"
			class:mobile-reader-document__stage--android={isAndroid()}
			use:readerPageSwipe={readerPageSwipeOptions}
		>
			<span
				bind:this={characterMeasureElement}
				class="mobile-reader-document__measure-text"
				aria-hidden="true"
			>
				{CHARACTER_MEASURE_SAMPLE}
			</span>
			<article
				bind:this={pageElement}
				class="mobile-reader-document__page mobile-reader-document__page--base"
				class:mobile-reader-document__page--ios={isIos()}
				class:mobile-reader-document__page--android={isAndroid()}
				class:mobile-reader-document__page--turning={turningPage}
				class:mobile-reader-document__page--vertical={activeDocumentVerticalWriting}
			>
				{#each currentPage.blocks as block (block.id)}
					{#if block.layout_mode === 'atomic' && block.kind === 'thematic_break'}
						<hr
							class="mobile-reader-document__block mobile-reader-document__thematic-break"
							data-reader-atomic-block-id={block.sourceBlockId}
						/>
					{:else if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = activeDocument.blocks.find(
							(b) => b.id === block.sourceBlockId
						)}
						{#if tableSource?.extensions?.table}
							<div
								class="mobile-reader-document__block mobile-reader-document__block--table"
								role="region"
								aria-label="Table"
								data-reader-atomic-block-id={block.sourceBlockId}
							>
								<table class="mobile-reader-document__data-table">
									<tbody>
										{#each tableSource.extensions.table.rows as row, rowIndex (rowIndex)}
											<tr>
												{#each row.cells as cell, colIndex (colIndex)}
													<svelte:element
														this={cell.is_header ? 'th' : 'td'}
													>
														{#each readerRoute.getTableCellSegments(tableSource.id, rowIndex, colIndex, cell.text) as segment, segIndex (segIndex)}
															{#if segment.type === 'token'}
																<button
																	class="mobile-reader-document__token"
																	class:mobile-reader-document__token--active={readerRoute.tokensMatchDictionarySelection(
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
								class="mobile-reader-document__block mobile-reader-document__figure"
								data-reader-atomic-block-id={block.sourceBlockId}
							>
								{#if imageSource.extensions?.image?.inline_src}
									<img
										src={imageSource.extensions.image.inline_src}
										alt={imageSource.text}
										class="mobile-reader-document__inline-image"
										width={imageSource.extensions.image.width ?? undefined}
										height={imageSource.extensions.image.height ?? undefined}
										onload={schedulePageOverflowCheck}
									/>
								{:else if imageSource.text}
									<figcaption class="mobile-reader-document__image-caption">
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
							class="mobile-reader-document__block"
							class:mobile-reader-document__block--code={block.kind === 'code_block'}
							class:mobile-reader-document__block--aside={block.kind === 'aside'}
							class:mobile-reader-document__block--note={Boolean(
								getBlockStyle(sourceBlock).note
							)}
							class:mobile-reader-document__block--boxed={Boolean(
								getBlockStyle(sourceBlock).boxed
							)}
							class:mobile-reader-document__block--poem={Boolean(
								getBlockStyle(sourceBlock).poem
							)}
							class:mobile-reader-document__block--small={Boolean(
								getBlockStyle(sourceBlock).small_text
							)}
							class:mobile-reader-document__block--centered={Boolean(
								getBlockStyle(sourceBlock).centered
							)}
							class:mobile-reader-document__block--list={block.kind === 'list_item'}
							class:mobile-reader-document__block--list-bullet={block.kind ===
								'list_item' &&
								sourceBlock?.extensions?.list_item?.list_style !== 'ordered'}
							class:mobile-reader-document__block--list-ordered={block.kind ===
								'list_item' &&
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
									<button
										class="mobile-reader-document__token"
										class:mobile-reader-document__token--active={readerRoute.tokensMatchDictionarySelection(
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
				<div class="mobile-reader-document__page-curl" aria-hidden="true">
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
			<span class="mobile-reader-document__page-count">
				{readerRoute.pageIndex + 1}/{readerRoute.pageCount}
			</span>
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
	.mobile-reader-document {
		position: relative;
		height: 100%;
		overflow: hidden;
		background-color: var(--reader-stage-background, var(--sy-color--grey-2));
		font-family: var(--sy-font-family);
	}

	.mobile-reader-document__reader-header {
		display: flex;
		align-items: center;
		gap: var(--sy-mobile-space--small);
		height: 54px;
		padding: 0 var(--sy-mobile-space--small);
		background: var(--sy-color--white);
		border-bottom: var(--sy-border);
		box-sizing: border-box;
	}

	.mobile-reader-document__header-actions {
		display: flex;
		align-items: center;
		gap: var(--sy-mobile-space--small);
		flex-shrink: 0;
	}

	.mobile-reader-document__settings-popover {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--large);
		padding: var(--sy-mobile-space--large);
		box-sizing: border-box;
		color: var(--sy-color--grey-4);
	}

	.mobile-reader-document__settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--small);
	}

	.mobile-reader-document__settings-label {
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--mobile-small);
		font-weight: var(--sy-font-weight--medium);
		color: var(--sy-color--grey-4);
	}

	.mobile-reader-document__document-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--sy-color--grey-4);
		font-weight: var(--sy-font-weight--medium);
		white-space: nowrap;
	}

	.mobile-reader-document__page-count {
		position: absolute;
		bottom: var(--sy-mobile-space--large);
		left: 50%;
		transform: translateX(-50%);
		color: var(--reader-muted-text, var(--sy-color--grey-3));
		font-size: var(--sy-font-size--mobile-small);
		white-space: nowrap;
	}

	.mobile-reader-document__stage {
		--mobile-reader-stage-padding: var(--sy-mobile-space--medium);

		position: relative;
		height: calc(100% - 54px);
		padding: var(--mobile-reader-stage-padding);
		box-sizing: border-box;
		overflow: hidden;
		touch-action: pan-y;
		background: var(--reader-stage-background, var(--sy-color--grey-2));
	}

	.mobile-reader-document__page {
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

	.mobile-reader-document__page::selection,
	.mobile-reader-document__page *::selection {
		background: var(--reader-selection-background, #dbeafe);
		color: var(--reader-selection-text, #111827);
	}

	.mobile-reader-document__page--ios {
		--ios-border-radius: 62px;

		border-radius: var(--sy-border-radius) var(--sy-border-radius) var(--ios-border-radius)
			var(--ios-border-radius);
	}

	.mobile-reader-document__stage--android {
		padding-bottom: calc(
			var(--mobile-reader-stage-padding) + max(env(safe-area-inset-bottom), 24px)
		);
	}

	.mobile-reader-document__stage--android .mobile-reader-document__page-count {
		bottom: calc(var(--sy-mobile-space--large) + max(env(safe-area-inset-bottom), 20px));
	}

	.mobile-reader-document__page--android {
		padding-bottom: calc(var(--sy-mobile-space--medium) * 6);
	}

	.mobile-reader-document__page--base {
		position: relative;
		z-index: 0;
	}

	.mobile-reader-document__page--turning {
		opacity: 0;
	}

	.mobile-reader-document__page--vertical {
		writing-mode: vertical-rl;
		text-orientation: mixed;
	}

	.mobile-reader-document__page-curl {
		position: absolute;
		inset: var(--mobile-reader-stage-padding);
		z-index: var(--sy-z-index--base);
		width: calc(100% - (var(--mobile-reader-stage-padding) * 2));
		height: calc(100% - (var(--mobile-reader-stage-padding) * 2));
		border-radius: var(--sy-border-radius);
		pointer-events: none;
	}

	.mobile-reader-document__measure-text {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		font-family: var(--reader-font-family, var(--sy-font-family));
		font-size: var(--reader-page-font-size, 1.18rem);
		line-height: 1;
		white-space: nowrap;
	}

	.mobile-reader-document__block {
		white-space: pre-wrap;
		margin: 0 0 1.25em;
	}

	.mobile-reader-document__block--small {
		font-size: 0.86em;
	}

	.mobile-reader-document__block--centered,
	.mobile-reader-document__block--poem {
		text-align: center;
	}

	.mobile-reader-document__block--aside,
	.mobile-reader-document__block--note,
	.mobile-reader-document__block--boxed {
		padding: 0.75em 0.85em;
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		border-radius: var(--sy-border-radius);
		background: rgb(128 128 128 / 8%);
	}

	.mobile-reader-document__block--poem {
		width: max-content;
		max-width: 100%;
		margin-inline: auto;
		white-space: pre-wrap;
	}

	.mobile-reader-document__thematic-break {
		height: 1px;
		border: 0;
		margin: 1.1em 0 1.5em;
		background: var(--reader-border-color, var(--sy-color--grey-2));
	}

	.mobile-reader-document__block--table {
		max-height: var(--reader-table-max-height, none);
		overflow: auto;
		margin: 0 0 1.25em;
	}

	.mobile-reader-document__data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95em;
	}

	.mobile-reader-document__data-table td,
	.mobile-reader-document__data-table th {
		border: 1px solid var(--reader-border-color, var(--sy-color--grey-2));
		padding: 0.35em 0.45em;
		vertical-align: top;
	}

	.mobile-reader-document__data-table th {
		background: rgb(128 128 128 / 10%);
		font-weight: var(--sy-font-weight--bold);
		text-align: start;
	}

	.mobile-reader-document__figure {
		margin: 0 0 1.25em;
		text-align: center;
	}

	.mobile-reader-document__inline-image {
		max-width: 70%;
		max-height: var(--reader-image-max-height, none);
		height: auto;
		display: inline-block;
		object-fit: contain;
	}

	.mobile-reader-document__image-caption {
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-size: 0.9em;
		font-style: italic;
	}

	.mobile-reader-document__block--code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.mobile-reader-document__block--list-bullet {
		position: relative;
		padding-left: calc(1.15em + var(--reader-list-depth-offset, 0em));
	}

	.mobile-reader-document__block--list-bullet::before {
		content: '•';
		position: absolute;
		left: var(--reader-list-depth-offset, 0);
		top: 0;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
	}

	.mobile-reader-document__block--list-ordered {
		position: relative;
		padding-left: calc(1.85em + var(--reader-list-depth-offset, 0em));
	}

	.mobile-reader-document__block--list-ordered::before {
		content: attr(data-ordinal) '. ';
		position: absolute;
		left: var(--reader-list-depth-offset, 0);
		top: 0;
		min-width: 1.35em;
		text-align: start;
		color: var(--reader-muted-text, var(--sy-color--grey-3));
		font-variant-numeric: tabular-nums;
	}

	blockquote.mobile-reader-document__block {
		white-space: normal;
		margin: 0 0 1.1em;
		padding: 0.35em 0 0.35em 1em;
		border-left: 0.28em solid var(--reader-border-color, var(--sy-color--grey-2));
		color: var(--reader-muted-text, var(--sy-color--grey-4));
		font-style: italic;
	}

	h1.mobile-reader-document__block,
	h2.mobile-reader-document__block,
	h3.mobile-reader-document__block,
	h4.mobile-reader-document__block,
	h5.mobile-reader-document__block,
	h6.mobile-reader-document__block {
		white-space: normal;
		line-height: 1.35;
		color: var(--reader-page-text, var(--sy-color--grey-4));
		margin: 0 0 0.75em;
	}

	h1.mobile-reader-document__block {
		font-size: 1.32em;
	}

	h2.mobile-reader-document__block {
		font-size: 1.18em;
	}

	h3.mobile-reader-document__block {
		font-size: 1.08em;
	}

	h4.mobile-reader-document__block {
		font-size: 1.03em;
	}

	h5.mobile-reader-document__block,
	h6.mobile-reader-document__block {
		font-size: 1em;
	}

	.mobile-reader-document__token {
		display: inline;
		border: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		color: inherit;
		font: inherit;
	}

	.mobile-reader-document__token:active {
		color: var(--reader-link-color, var(--sy-color--blue));
	}
</style>
