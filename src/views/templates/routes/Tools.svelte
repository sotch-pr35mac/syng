<script lang="ts">
	import { onMount } from 'svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
	import ColorizedToolOutput from '@/components/Tools/ColorizedToolOutput.svelte';
	import TextConversionToolPanel from '@/components/Tools/TextConversionToolPanel.svelte';
	import ToolsOverlays from '@/components/Tools/ToolsOverlays.svelte';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
	import {
		textConversionHeadingId,
		textConversionTabs,
	} from '@/composables/textConversionTools.js';
	import { toolsRoute } from '@/composables/toolsRoute.svelte.js';

	const isMacos = platform() === 'macos';
	const outputText = $derived(toolsRoute.activeTool.getOutputText());

	onMount(() => toolsRoute.startPlaceholderRotation());
</script>

<div class="tools">
	<div class="tools__title" data-tauri-drag-region={isMacos ? true : undefined}>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Extras</h1>
	</div>

	<div class="tools__tabs" role="tablist" aria-label="Extras tools" use:tabNavigation>
		{#each textConversionTabs as tab (tab.name)}
			<SyTab
				role="tab"
				id={`tools-${tab.name}-tab`}
				aria-controls="tools-panel"
				active={toolsRoute.activeTab === tab.name}
				onclick={() => toolsRoute.setActiveTab(tab.name)}
			>
				{tab.label}
			</SyTab>
		{/each}
	</div>

	<div
		role="tabpanel"
		id="tools-panel"
		aria-labelledby={`tools-${toolsRoute.activeTab}-tab`}
		tabindex="0"
		class="tools__content"
		use:scrollRestore={'tools-content'}
	>
		<TextConversionToolPanel
			tool={toolsRoute.activeTool.name}
			busy={toolsRoute.operationState.busy}
			status={toolsRoute.operationState.status}
			label={toolsRoute.activeTool.label}
			headingId={textConversionHeadingId(toolsRoute.activeTool.name, 'desktop')}
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
	</div>
</div>

<ToolsOverlays />

<style>
	.tools {
		display: flex;
		flex-direction: column;
		width: -webkit-fill-available;
		overflow: hidden;
		padding: 0 var(--sy-space--extra-large);
		background-color: var(--sy-color--white);
	}
	.tools__title {
		padding: var(--sy-space--extra-large) var(--sy-space);
	}
	.tools__tabs {
		flex-wrap: wrap;
		display: flex;
		gap: var(--sy-space--large);
		padding: 0 var(--sy-space);
		border-bottom: var(--sy-border);
		margin-bottom: var(--sy-space--extra-large);
	}
	.tools__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--sy-space) var(--sy-space--extra-large);
	}
</style>
