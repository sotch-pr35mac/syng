<script lang="ts">
	import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import ReaderThemeSelector from '@/components/Reader/ReaderThemeSelector.svelte';
	import ReaderTextSizeSelector from '@/components/Reader/ReaderTextSizeSelector.svelte';
	import DictionaryPopover from '@/components/DictionaryPopover/DictionaryPopover.svelte';
	import CssPageCurlOverlay from '@/components/Reader/CssPageCurlOverlay.svelte';
	import { readerPageSwipe } from '@/actions/readerPageSwipe.svelte.js';
	import { readerRoute } from '@/composables/reader.svelte.js';
	import { createReaderDocumentController } from '@/composables/readerDocument.svelte.js';
	import { bookmarksStore } from '@/stores/bookmarks.svelte.js';
	import { isIPad } from '@/utils/device.js';

	type Props = {
		params?: {
			id?: string;
		};
	};

	const { params = {} }: Props = $props();
	const DEFAULT_PAGE_FONT_SIZE = 20;
	const BODY_BLOCK_GAP_EM = 1.4;
	const HEADING_FONT_SCALE = 1.35;
	const LIST_NESTING_INDENT_EM = 1.25;
	const PAGE_CURL_DURATION_MS = 760;
	const READER_SETTINGS_POPOVER_WIDTH_PX = 470;
	const IPAD_READER_PAGE_SWIPE_POINTER_TYPES = ['touch'] as const;
	const isMacos = platform() === 'macos';
	const isIPadDevice = isIPad();

	let pageElement = $state<HTMLElement | undefined>(undefined);
	let characterMeasureElement = $state<HTMLElement | undefined>(undefined);

	const reader = createReaderDocumentController({
		pageFontSize: DEFAULT_PAGE_FONT_SIZE,
		bodyBlockGapEm: BODY_BLOCK_GAP_EM,
		headingFontScale: HEADING_FONT_SCALE,
		listNestingIndentEm: LIST_NESTING_INDENT_EM,
		pageCurlDurationMs: PAGE_CURL_DURATION_MS,
		swipeEnabled: isIPadDevice,
		swipeAcceptedPointerTypes: IPAD_READER_PAGE_SWIPE_POINTER_TYPES,
		getRouteParamId: () => params.id,
		getPageElement: () => pageElement,
		getCharacterMeasureElement: () => characterMeasureElement,
		onMissingDocumentId: () => {
			window.location.hash = '#/read';
		},
	});

	// Local aliases so the template can narrow these inside `{#if}`/`{#each}`;
	// the type-checker does not narrow getter accesses on the controller.
	const activeDocument = $derived(reader.activeDocument);
	const currentPage = $derived(reader.currentPage);
	const pageCurl = $derived(reader.pageCurl);
</script>

<div class="reader" style={activeDocument ? reader.readerThemeStyle : ''}>
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
				onclick={reader.backToLibrary}
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
				aria-pressed={reader.readerSettingsPopoverVisible}
				onclick={reader.toggleReaderSettingsPopover}
			>
				<SlidersHorizontal size="20" />
			</SyButton>
			<SyPopover
				visible={reader.readerSettingsPopoverVisible}
				anchor={reader.readerSettingsPopoverAnchor}
				ignoreElement={reader.readerSettingsButtonElement}
				horizontalAlign="end"
				width={READER_SETTINGS_POPOVER_WIDTH_PX}
				mobileTitle="Reader settings"
				onclose={reader.closeReaderSettingsPopover}
			>
				<div class="reader__settings-popover" aria-label="Reader settings">
					<div class="reader__settings-section">
						<span class="reader__settings-label">Theme</span>
						<ReaderThemeSelector
							colorTheme={reader.readerSettings.colorTheme}
							systemPrefersDark={reader.systemPrefersDark}
							onchange={reader.setReaderTheme}
						/>
					</div>
					<div class="reader__settings-section">
						<span class="reader__settings-label">Text size</span>
						<ReaderTextSizeSelector
							fontSizePercent={reader.readerSettings.fontSizePercent}
							canDecrease={reader.canDecreaseFontSize}
							canIncrease={reader.canIncreaseFontSize}
							onchange={reader.changeReaderFontSize}
						/>
					</div>
				</div>
			</SyPopover>
		</div>
	</div>

	{#if activeDocument && currentPage}
		<main
			class="reader__stage"
			class:reader__stage--ipad={isIPadDevice}
			use:readerPageSwipe={reader.readerPageSwipeOptions}
		>
			<button
				class="reader__page-turn reader__page-turn--previous"
				disabled={!readerRoute.canGoPrevious || reader.turningPage}
				aria-label="Previous page"
				onclick={() => reader.turnPage('previous')}
			>
				<ChevronLeft size="28" />
			</button>
			<span
				bind:this={characterMeasureElement}
				class="reader__measure-text"
				aria-hidden="true"
			>
				{reader.characterMeasureSample}
			</span>
			<article
				bind:this={pageElement}
				class="reader__page reader__page--base"
				class:reader__page--turning={reader.turningPage}
				class:reader__page--vertical={reader.activeDocumentVerticalWriting}
			>
				{#each currentPage.blocks as block (block.id)}
					{#if block.layout_mode === 'atomic' && block.kind === 'thematic_break'}
						<hr
							class="reader__block reader__thematic-break"
							data-reader-atomic-block-id={block.sourceBlockId}
						/>
					{:else if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = reader.getSourceBlock(block)}
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
																				reader.openToken(
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
																			reader.openToken(
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
						{@const imageSource = reader.getSourceBlock(block)}
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
										onload={reader.schedulePageOverflowCheck}
									/>
								{:else if imageSource.text}
									<figcaption class="reader__image-caption">
										{imageSource.text}
									</figcaption>
								{/if}
							</figure>
						{/if}
					{:else}
						{@const sourceBlock = reader.getSourceBlock(block)}
						<svelte:element
							this={reader.getBlockTag(block, sourceBlock)}
							class="reader__block"
							class:reader__block--code={block.kind === 'code_block'}
							class:reader__block--aside={block.kind === 'aside'}
							class:reader__block--note={Boolean(
								reader.getBlockStyle(sourceBlock).note
							)}
							class:reader__block--boxed={Boolean(
								reader.getBlockStyle(sourceBlock).boxed
							)}
							class:reader__block--poem={Boolean(
								reader.getBlockStyle(sourceBlock).poem
							)}
							class:reader__block--small={Boolean(
								reader.getBlockStyle(sourceBlock).small_text
							)}
							class:reader__block--centered={Boolean(
								reader.getBlockStyle(sourceBlock).centered
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
							style={reader.getBlockCssStyle(sourceBlock)}
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
												onclick={(event) =>
													reader.openToken(event, segment.token)}
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
											onclick={(event) =>
												reader.openToken(event, segment.token)}
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
			{#if pageCurl}
				<div class="reader__page-curl" aria-hidden="true">
					<CssPageCurlOverlay
						currentImage={pageCurl.currentImage}
						targetImage={pageCurl.targetImage}
						direction={pageCurl.direction}
						durationMs={reader.pageCurlDurationMs}
						oncomplete={() => {
							reader.completePageTurn().catch(reader.clearPageTurn);
						}}
					/>
				</div>
			{/if}
			<button
				class="reader__page-turn reader__page-turn--next"
				disabled={!readerRoute.canGoNext || reader.turningPage}
				aria-label="Next page"
				onclick={() => reader.turnPage('next')}
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
		padding-top: max(var(--sy-space--large), env(safe-area-inset-top, 0px));
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

	.reader__stage--ipad {
		/* Hand horizontal swipes to the page-turn handler instead of letting the
		   webview treat them as back/forward navigation, while keeping vertical
		   gestures for the system. */
		touch-action: pan-y;
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
