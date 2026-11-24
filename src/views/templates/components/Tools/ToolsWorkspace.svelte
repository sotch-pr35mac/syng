<script lang="ts">
	import { tick, untrack } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import ToolIllustration from '@/components/Tools/ToolIllustration.svelte';
	import TextConversionToolPanel from '@/components/Tools/TextConversionToolPanel.svelte';
	import ColorizedToolOutput from '@/components/Tools/ColorizedToolOutput.svelte';
	import WordFrequencyPanel from '@/components/Tools/WordFrequencyPanel.svelte';
	import ToolsOverlays from '@/components/Tools/ToolsOverlays.svelte';
	import { extrasTools, toolsRoute } from '@/composables/toolsRoute.svelte.js';
	import { textConversionHeadingId } from '@/composables/textConversionTools.js';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import { isAndroid } from '@/utils/device.js';
	import type { ToolName } from '@/types/tools.js';
	import type { TextConversionToolVariant } from '@/types/textConversionTool.js';

	const {
		variant = 'desktop',
		draggableTitle = false,
	}: {
		variant?: TextConversionToolVariant;
		draggableTitle?: boolean;
	} = $props();
	const mobile = $derived(variant === 'mobile');
	const outputText = $derived(toolsRoute.activeTool?.getOutputText() ?? '');
	let workspace: HTMLDivElement | undefined;

	$effect(() => {
		if (walkthroughStore.isOverview('/tools')) {
			// Reveal the toolbox when the tour arrives or resumes on this mounted route.
			untrack(() => toolsRoute.selectTool(null));
		}
	});
	$effect(() => {
		if (toolsRoute.activeTool) {
			return toolsRoute.startPlaceholderRotation();
		}
		return undefined;
	});

	async function openTool(tool: ToolName) {
		toolsRoute.selectTool(tool);
		await tick();
		if (toolsRoute.selectedTool === tool && workspace?.isConnected) {
			workspace.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
		}
	}

	async function showToolbox() {
		const previousTool = toolsRoute.selectedTool;
		toolsRoute.selectTool(null);
		await tick();
		if (!toolsRoute.selectedTool && workspace?.isConnected) {
			workspace
				.querySelector<HTMLElement>(`[data-tool="${previousTool}"]`)
				?.focus({ preventScroll: true });
		}
	}
</script>

<div
	class="tools-workspace"
	class:tools-workspace--mobile={mobile}
	class:tools-workspace--android={isAndroid()}
	bind:this={workspace}
>
	{#if toolsRoute.selectedTool === null}
		<header
			class="tools-workspace__header"
			data-tauri-drag-region={draggableTitle ? true : undefined}
		>
			<h1 data-tauri-drag-region={draggableTitle ? true : undefined}>Extras</h1>
		</header>
	{/if}
	{#key toolsRoute.selectedTool}
		<div
			class="tools-workspace__content"
			data-sy-primary-scroll={mobile ? true : undefined}
			use:swipeBack={{
				enabled: mobile && toolsRoute.selectedTool !== null,
				onBack: showToolbox,
			}}
			use:scrollRestore={`tools-${variant}-${toolsRoute.selectedTool ?? 'toolbox'}`}
		>
			{#if toolsRoute.selectedTool === null}
				<section
					class="toolbox"
					aria-label="Extras tools"
					use:walkthroughTarget={'extras-tools'}
				>
					{#each extrasTools as tool (tool.name)}
						<SyButton
							style="ghost"
							classes={['toolbox__tile']}
							data-tool={tool.name}
							onclick={() => openTool(tool.name)}
						>
							<span class="toolbox__illustration"
								><ToolIllustration tool={tool.name} /></span
							>
							<span class="toolbox__label">{tool.label}</span>
						</SyButton>
					{/each}
				</section>
			{:else if toolsRoute.selectedTool === 'frequency'}
				<WordFrequencyPanel {variant} {draggableTitle} onBack={showToolbox} />
			{:else if toolsRoute.activeTool}
				<TextConversionToolPanel
					{variant}
					{draggableTitle}
					onBack={showToolbox}
					tool={toolsRoute.activeTool.name}
					busy={toolsRoute.operationState.busy}
					status={toolsRoute.operationState.status}
					label={toolsRoute.activeTool.label}
					headingId={textConversionHeadingId(toolsRoute.activeTool.name, variant)}
					inputLabel={toolsRoute.activeTool.inputLabel}
					inputValue={toolsRoute.activeTool.getInput()}
					placeholder={toolsRoute.activePlaceholder}
					outputLabel={toolsRoute.activeTool.outputLabel}
					{outputText}
					collapsed={toolsRoute.isInputCollapsed(toolsRoute.activeTool.name)}
					controlGroups={toolsRoute.activeTool.getControlGroups?.() ?? []}
					decisionText={toolsRoute.activeTool.getDecisionText?.() ?? ''}
					outputLarge={toolsRoute.activeTool.outputLarge}
					onInputChange={toolsRoute.activeTool.setInput}
					onProcess={toolsRoute.activeTool.process}
					onCopy={toolsRoute.copyText}
					onInfo={toolsRoute.openInfo}
					onToggleCollapse={toolsRoute.toggleInput}
				>
					{#snippet customOutput()}
						<ColorizedToolOutput tool={toolsRoute.activeTool.name} {outputText} />
					{/snippet}
				</TextConversionToolPanel>
			{/if}
		</div>
	{/key}
</div>
<ToolsOverlays />

<style>
	.tools-workspace {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		height: 100%;
		overflow: hidden;
		padding-inline: var(--sy-space--extra-large);
		background-color: var(--sy-surface--content);
	}
	.tools-workspace__header {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.tools-workspace__header h1 {
		margin: 0;
	}
	.tools-workspace__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--sy-space) var(--sy-space--extra-large);
	}
	.toolbox {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: var(--sy-space--extra-large);
		padding-block: var(--sy-space--extra-large);
		align-items: start;
	}
	:global(.toolbox__tile) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sy-space--large);
		margin: 0;
		padding: var(--sy-space--large);
		min-width: 0;
		font-size: var(--sy-tool-label-size);
	}
	.toolbox__illustration {
		display: block;
		width: var(--sy-tool-illustration-size);
		max-width: 100%;
		aspect-ratio: 1;
		/* Reader's shadow values follow the illustration silhouette instead of a card box. */
		filter: drop-shadow(var(--sy-tool-shadow, var(--sy-shadow)));
		transition:
			filter var(--sy-transition-duration--control),
			transform var(--sy-transition-duration--artwork);
	}
	.toolbox__label {
		padding-bottom: var(--sy-space--large);
	}
	@media (hover: hover) {
		:global(.toolbox__tile:hover) .toolbox__illustration {
			transform: translateY(var(--sy-hover-lift));
			--sy-tool-shadow: var(--sy-shadow--active);
		}
	}
	:global(.toolbox__tile:focus-visible) .toolbox__illustration,
	:global(.toolbox__tile:active) .toolbox__illustration {
		--sy-tool-shadow: var(--sy-shadow--active);
	}
	:global(.toolbox__tile:active) .toolbox__illustration {
		transition: none;
	}
	/* Android WebView can leave stale route pixels when compositing these filters.
	   Keep the artwork and motion, but omit silhouette shadows on that platform. */
	.tools-workspace--android .toolbox__illustration {
		filter: none;
	}
	.tools-workspace--mobile {
		background-color: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
		padding-inline: 0;
	}
	.tools-workspace--mobile .tools-workspace__header {
		padding: var(--sy-mobile-space--large);
	}
	.tools-workspace--mobile h1 {
		font-size: var(--sy-font-size--mobile-heading);
	}
	.tools-workspace--mobile .tools-workspace__content {
		padding-inline: var(--sy-tool-page-inset-mobile);
	}
	.tools-workspace--mobile .toolbox {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
		gap: var(--sy-mobile-space--large);
	}
	.tools-workspace--mobile :global(.toolbox__tile) {
		font-size: var(--sy-font-size--mobile-small);
	}
	.tools-workspace--mobile .toolbox__illustration {
		width: var(--sy-tool-illustration-size-mobile);
	}
	@media (prefers-reduced-motion: reduce) {
		.toolbox__illustration {
			transform: none !important;
			transition: none;
		}
	}
</style>
