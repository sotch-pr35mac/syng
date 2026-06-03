/**
 * Shared controller for the desktop and mobile reader document views. Both
 * routes render the same paginated document with the same lifecycle (load by
 * route id, observe the page for resize, snapshot pages for the curl
 * animation, measure atomic-block heights) and differ only in layout constants,
 * swipe gating, missing-document navigation, and their own markup/CSS.
 *
 * The component keeps ownership of the `bind:this` element refs (passed back in
 * via accessors) and its platform-specific constants; everything else — state,
 * derived values, effects, and the page-turn/overflow/layout logic — lives here
 * so the two views stay in lockstep.
 */
import { onMount, tick } from 'svelte';
import type { ReaderPageSwipeOptions } from '@/actions/readerPageSwipe.svelte.js';
import { readerRoute } from '@/composables/reader.svelte.js';
import {
	getReaderColorTheme,
	getReaderColorThemeSettings,
	READER_FONT_SIZE_MAX_PERCENT,
	READER_FONT_SIZE_MIN_PERCENT,
} from '@/utils/readerSettings.js';
import type {
	ReaderBlockStyleExtension,
	ReaderColorThemeId,
	ReaderContentBlock,
	ReaderDocument,
	ReaderThemeSettings,
	ReaderToken,
} from '@/types/reader.js';
import { readerSettingsStore } from '@/stores/readerSettings.svelte.js';
import {
	createReaderPageSnapshot,
	READER_IMAGE_MAX_HEIGHT_RATIO,
	READER_TABLE_MAX_HEIGHT_RATIO,
	type ReaderPage,
	type ReaderPageBlock,
} from '@/utils/readerPagination.js';

const CHARACTER_MEASURE_SAMPLE = '汉字阅读天地学习语言文字故事春夏秋冬';
const HEADING_LINE_HEIGHT = 1.5;
const MAX_HEADING_LEVEL = 6;
const DEFAULT_HEADING_LEVEL = 2;
const LINE_HEIGHT_FALLBACK_MULTIPLIER = 2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type ReaderPageTurnDirection = 'next' | 'previous';
type ReaderBlockTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'pre' | 'p';

/** Snapshot images and direction for the page-curl overlay while a turn animates. */
export type ReaderPageCurl = {
	currentImage: string;
	targetImage: string;
	direction: ReaderPageTurnDirection;
};

export type ReaderDocumentControllerOptions = {
	/** Base page font size in pixels before the user font-size percentage. */
	pageFontSize: number;
	/** Vertical gap between blocks, expressed in `em` of the page font. */
	bodyBlockGapEm: number;
	/** Heading font size relative to the body font, used for capacity estimates. */
	headingFontScale: number;
	/** Per-level indent applied to nested list items, in `em`. */
	listNestingIndentEm: number;
	/** Page-curl animation duration in milliseconds. */
	pageCurlDurationMs: number;
	/** Whether swipe-to-turn is enabled on this platform (gated further by animation state). */
	swipeEnabled: boolean;
	/** Pointer types the swipe action accepts; `undefined` accepts all. */
	swipeAcceptedPointerTypes?: readonly string[];
	/** Reads the current route's document id param (`$props` lives in the component). */
	getRouteParamId: () => string | undefined;
	/** Reads the component's `bind:this` page element. */
	getPageElement: () => HTMLElement | undefined;
	/** Reads the component's `bind:this` character-measurement element. */
	getCharacterMeasureElement: () => HTMLElement | undefined;
	/** Navigates when the route resolves without a document id (differs per platform). */
	onMissingDocumentId: () => void;
};

export type ReaderDocumentController = ReturnType<typeof createReaderDocumentController>;

export function createReaderDocumentController(options: ReaderDocumentControllerOptions) {
	const activeDocument = $derived(readerRoute.activeDocument);
	const routeDocumentId = $derived(
		options.getRouteParamId() ? decodeURIComponent(options.getRouteParamId()!) : undefined
	);
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
			`--reader-page-font-size: ${(options.pageFontSize * readerSettings.fontSizePercent) / 100}px`,
			`--reader-page-line-height: ${readerSettings.lineHeight}`,
			`--reader-image-max-height: ${pageContentHeight ? `${pageContentHeight * READER_IMAGE_MAX_HEIGHT_RATIO}px` : 'none'}`,
			`--reader-table-max-height: ${pageContentHeight ? `${pageContentHeight * READER_TABLE_MAX_HEIGHT_RATIO}px` : 'none'}`,
		].join(';')
	);
	let turningPage = $state(false);
	let turningPageDirection = $state<ReaderPageTurnDirection | undefined>(undefined);
	let currentPageImage = $state<string | undefined>(undefined);
	let targetPageImage = $state<string | undefined>(undefined);
	let pendingTargetPageIndex = $state<number | undefined>(undefined);
	const pageCurl = $derived<ReaderPageCurl | undefined>(
		turningPage && currentPageImage && targetPageImage && turningPageDirection
			? {
					currentImage: currentPageImage,
					targetImage: targetPageImage,
					direction: turningPageDirection,
				}
			: undefined
	);
	const readerPageSwipeOptions = $derived<ReaderPageSwipeOptions>({
		enabled: options.swipeEnabled && !turningPage,
		acceptedPointerTypes: options.swipeAcceptedPointerTypes,
		onTurnPage: turnPage,
	});
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
			options.onMissingDocumentId();
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
		const pageElement = options.getPageElement();
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
		if (options.getPageElement()) {
			updatePageLayout().catch(() => {});
		}
	});

	$effect(() => {
		currentPage;
		options.getPageElement();
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
				`--reader-list-depth-offset: ${Math.max(0, listDepth) * options.listNestingIndentEm}em`
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

	/** Resolves the original source block a paginated page block was sliced from. */
	function getSourceBlock(block: ReaderPageBlock): ReaderContentBlock | undefined {
		return activeDocument?.blocks.find((candidate) => candidate.id === block.sourceBlockId);
	}

	/** Picks the semantic element a block renders as, clamping heading levels to h1–h6. */
	function getBlockTag(
		block: ReaderPageBlock,
		sourceBlock: ReaderContentBlock | undefined
	): ReaderBlockTag {
		if (block.kind === 'heading') {
			const headingLevel = Math.min(
				MAX_HEADING_LEVEL,
				Math.max(1, sourceBlock?.heading_level ?? DEFAULT_HEADING_LEVEL)
			);
			return `h${headingLevel}` as ReaderBlockTag;
		}
		if (block.kind === 'blockquote') {
			return 'blockquote';
		}
		if (block.kind === 'code_block') {
			return 'pre';
		}
		return 'p';
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
		const pageElement = options.getPageElement();
		if (!pageElement) {
			return;
		}

		const pageStyles = getComputedStyle(pageElement);
		const fontSize = parsePixelValue(pageStyles.fontSize, options.pageFontSize);
		const lineHeight = parsePixelValue(
			pageStyles.lineHeight,
			fontSize * LINE_HEIGHT_FALLBACK_MULTIPLIER
		);
		const paddingX =
			parsePixelValue(pageStyles.paddingLeft, 0) +
			parsePixelValue(pageStyles.paddingRight, 0);
		const paddingY =
			parsePixelValue(pageStyles.paddingTop, 0) +
			parsePixelValue(pageStyles.paddingBottom, 0);
		const contentHeight = pageElement.clientHeight - paddingY;
		const characterMeasureElement = options.getCharacterMeasureElement();
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
			blockGap: fontSize * options.bodyBlockGapEm,
			headingLineHeight: fontSize * options.headingFontScale * HEADING_LINE_HEIGHT,
			headingGap: fontSize * options.bodyBlockGapEm,
			headingFontScale: options.headingFontScale,
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
		const pageElement = options.getPageElement();
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

	async function turnPage(direction: ReaderPageTurnDirection): Promise<void> {
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
			const pageElement = options.getPageElement();
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

	return {
		characterMeasureSample: CHARACTER_MEASURE_SAMPLE,
		pageCurlDurationMs: options.pageCurlDurationMs,
		get activeDocument(): ReaderDocument | undefined {
			return activeDocument;
		},
		get currentPage(): ReaderPage | undefined {
			return currentPage;
		},
		get readerSettings(): ReaderThemeSettings {
			return readerSettings;
		},
		get systemPrefersDark(): boolean {
			return systemPrefersDark;
		},
		get readerThemeStyle(): string {
			return readerThemeStyle;
		},
		get activeDocumentVerticalWriting(): boolean {
			return activeDocumentVerticalWriting;
		},
		get canDecreaseFontSize(): boolean {
			return canDecreaseFontSize;
		},
		get canIncreaseFontSize(): boolean {
			return canIncreaseFontSize;
		},
		get turningPage(): boolean {
			return turningPage;
		},
		get pageCurl(): ReaderPageCurl | undefined {
			return pageCurl;
		},
		get readerSettingsPopoverVisible(): boolean {
			return readerSettingsPopoverVisible;
		},
		get readerSettingsPopoverAnchor(): DOMRect | undefined {
			return readerSettingsPopoverAnchor;
		},
		get readerSettingsButtonElement(): HTMLElement | undefined {
			return readerSettingsButtonElement;
		},
		get readerPageSwipeOptions(): ReaderPageSwipeOptions {
			return readerPageSwipeOptions;
		},
		openToken,
		getBlockStyle,
		getBlockCssStyle,
		getSourceBlock,
		getBlockTag,
		backToLibrary,
		setReaderTheme,
		changeReaderFontSize,
		toggleReaderSettingsPopover,
		closeReaderSettingsPopover,
		schedulePageOverflowCheck,
		turnPage,
		completePageTurn,
		clearPageTurn,
	};
}
