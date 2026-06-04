<script lang="ts">
	import { onMount } from 'svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import ColorizedToolOutput from '@/components/Tools/ColorizedToolOutput.svelte';
	import TextConversionToolPanel from '@/components/Tools/TextConversionToolPanel.svelte';
	import ToolsOverlays from '@/components/Tools/ToolsOverlays.svelte';
	import {
		textConversionHeadingId,
		textConversionTabs,
	} from '@/composables/textConversionTools.js';
	import { toolsRoute } from '@/composables/toolsRoute.svelte.js';

	const outputText = $derived(toolsRoute.activeTool.getOutputText());

	onMount(() => toolsRoute.startPlaceholderRotation());
</script>

<div class="mobile-tools">
	<header class="mobile-tools__header">
		<div class="mobile-tools__tabs" aria-label="Extras tools">
			{#each textConversionTabs as tab (tab.name)}
				<SyTab
					variant="mobile"
					active={toolsRoute.activeTab === tab.name}
					onclick={() => toolsRoute.setActiveTab(tab.name)}
				>
					{tab.label}
				</SyTab>
			{/each}
		</div>
	</header>

	<div class="mobile-tools__content">
		<TextConversionToolPanel
			variant="mobile"
			tool={toolsRoute.activeTool.name}
			label={toolsRoute.activeTool.label}
			headingId={textConversionHeadingId(toolsRoute.activeTool.name, 'mobile')}
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
	.mobile-tools {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--sy-color--white);
	}
	.mobile-tools__header {
		flex-shrink: 0;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
		background-color: var(--sy-color--white);
		border-bottom: var(--sy-mobile-surface-border);
	}
	.mobile-tools__tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-mobile-space--medium);
	}
	.mobile-tools__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: calc(var(--sy-mobile-space--extra-small) * 5);
	}
</style>
