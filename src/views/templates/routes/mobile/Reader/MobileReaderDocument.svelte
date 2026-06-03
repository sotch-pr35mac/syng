<script lang="ts">
	import { ChevronLeft, SlidersHorizontal } from 'lucide-svelte';
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
	import { readerDocumentRouteStore } from '@/stores/readerRoute.svelte.js';
	import { isAndroid, isIos } from '@/utils/device.js';

	type Props = {
		params?: {
			id?: string;
		};
	};

	const { params = {} }: Props = $props();
	const DEFAULT_PAGE_FONT_SIZE = 19;
	const BODY_BLOCK_GAP_EM = 1.25;
	const HEADING_FONT_SCALE = 1.28;
	const LIST_NESTING_INDENT_EM = 1.15;
	const PAGE_CURL_DURATION_MS = 720;

	let pageElement = $state<HTMLElement | undefined>(undefined);
	let characterMeasureElement = $state<HTMLElement | undefined>(undefined);

	const reader = createReaderDocumentController({
		pageFontSize: DEFAULT_PAGE_FONT_SIZE,
		bodyBlockGapEm: BODY_BLOCK_GAP_EM,
		headingFontScale: HEADING_FONT_SCALE,
		listNestingIndentEm: LIST_NESTING_INDENT_EM,
		pageCurlDurationMs: PAGE_CURL_DURATION_MS,
		swipeEnabled: true,
		getRouteParamId: () => params.id,
		getPageElement: () => pageElement,
		getCharacterMeasureElement: () => characterMeasureElement,
		onMissingDocumentId: () => {
			if (readerDocumentRouteStore.value) {
				window.location.hash = `#/read/document/${encodeURIComponent(readerDocumentRouteStore.value)}`;
				return;
			}
			if (readerRoute.activeDocument) {
				window.location.hash = `#/read/document/${encodeURIComponent(readerRoute.activeDocument._id)}`;
			}
		},
	});

	// Local aliases so the template can narrow these inside `{#if}`/`{#each}`;
	// the type-checker does not narrow getter accesses on the controller.
	const activeDocument = $derived(reader.activeDocument);
	const currentPage = $derived(reader.currentPage);
	const pageCurl = $derived(reader.pageCurl);
</script>

<div
	class="mobile-reader-document"
	style={activeDocument && currentPage ? reader.readerThemeStyle : ''}
>
	{#if activeDocument && currentPage}
		<div class="mobile-reader-document__reader-header">
			<SyButton style="ghost" size="small" onclick={reader.backToLibrary}>
				<ChevronLeft size="18" />
			</SyButton>
			<span class="mobile-reader-document__document-title">{activeDocument.title}</span>
			<div class="mobile-reader-document__header-actions">
				<SyButton
					style="ghost"
					size="small"
					aria-label="Reader settings"
					aria-pressed={reader.readerSettingsPopoverVisible}
					onclick={reader.toggleReaderSettingsPopover}
				>
					<SlidersHorizontal size="18" />
				</SyButton>
			</div>
		</div>
		<SyPopover
			visible={reader.readerSettingsPopoverVisible}
			anchor={reader.readerSettingsPopoverAnchor}
			ignoreElement={reader.readerSettingsButtonElement}
			horizontalAlign="end"
			mobileTitle="Reader settings"
			onclose={reader.closeReaderSettingsPopover}
		>
			<div class="mobile-reader-document__settings-popover" aria-label="Reader settings">
				<div class="mobile-reader-document__settings-section">
					<span class="mobile-reader-document__settings-label">Theme</span>
					<ReaderThemeSelector
						colorTheme={reader.readerSettings.colorTheme}
						systemPrefersDark={reader.systemPrefersDark}
						onchange={reader.setReaderTheme}
					/>
				</div>
				<div class="mobile-reader-document__settings-section">
					<span class="mobile-reader-document__settings-label">Text size</span>
					<ReaderTextSizeSelector
						fontSizePercent={reader.readerSettings.fontSizePercent}
						canDecrease={reader.canDecreaseFontSize}
						canIncrease={reader.canIncreaseFontSize}
						onchange={reader.changeReaderFontSize}
					/>
				</div>
			</div>
		</SyPopover>
		<main
			class="mobile-reader-document__stage"
			class:mobile-reader-document__stage--android={isAndroid()}
			use:readerPageSwipe={reader.readerPageSwipeOptions}
		>
			<span
				bind:this={characterMeasureElement}
				class="mobile-reader-document__measure-text"
				aria-hidden="true"
			>
				{reader.characterMeasureSample}
			</span>
			<article
				bind:this={pageElement}
				class="mobile-reader-document__page mobile-reader-document__page--base"
				class:mobile-reader-document__page--ios={isIos()}
				class:mobile-reader-document__page--android={isAndroid()}
				class:mobile-reader-document__page--turning={reader.turningPage}
				class:mobile-reader-document__page--vertical={reader.activeDocumentVerticalWriting}
			>
				{#each currentPage.blocks as block (block.id)}
					{#if block.layout_mode === 'atomic' && block.kind === 'thematic_break'}
						<hr
							class="mobile-reader-document__block mobile-reader-document__thematic-break"
							data-reader-atomic-block-id={block.sourceBlockId}
						/>
					{:else if block.layout_mode === 'atomic' && block.kind === 'table'}
						{@const tableSource = reader.getSourceBlock(block)}
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
																		reader.openToken(
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
						{@const imageSource = reader.getSourceBlock(block)}
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
										onload={reader.schedulePageOverflowCheck}
									/>
								{:else if imageSource.text}
									<figcaption class="mobile-reader-document__image-caption">
										{imageSource.text}
									</figcaption>
								{/if}
							</figure>
						{/if}
					{:else}
						{@const sourceBlock = reader.getSourceBlock(block)}
						<svelte:element
							this={reader.getBlockTag(block, sourceBlock)}
							class="mobile-reader-document__block"
							class:mobile-reader-document__block--code={block.kind === 'code_block'}
							class:mobile-reader-document__block--aside={block.kind === 'aside'}
							class:mobile-reader-document__block--note={Boolean(
								reader.getBlockStyle(sourceBlock).note
							)}
							class:mobile-reader-document__block--boxed={Boolean(
								reader.getBlockStyle(sourceBlock).boxed
							)}
							class:mobile-reader-document__block--poem={Boolean(
								reader.getBlockStyle(sourceBlock).poem
							)}
							class:mobile-reader-document__block--small={Boolean(
								reader.getBlockStyle(sourceBlock).small_text
							)}
							class:mobile-reader-document__block--centered={Boolean(
								reader.getBlockStyle(sourceBlock).centered
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
							style={reader.getBlockCssStyle(sourceBlock)}
						>
							{#each readerRoute.getBlockSegments(block) as segment, index (index)}
								{#if segment.type === 'token'}
									<button
										class="mobile-reader-document__token"
										class:mobile-reader-document__token--active={readerRoute.tokensMatchDictionarySelection(
											segment.token,
											readerRoute.dictionaryToken
										)}
										onclick={(event) => reader.openToken(event, segment.token)}
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
			{#if pageCurl}
				<div class="mobile-reader-document__page-curl" aria-hidden="true">
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
