<script lang="ts">
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';

	import { onMount } from 'svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
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
		<div
			class="mobile-tools__tabs"
			role="tablist"
			aria-label="Extras tools"
			use:tabNavigation
			use:walkthroughTarget={'extras-tabs'}
		>
			{#each textConversionTabs as tab (tab.name)}
				<SyTab
					variant="mobile"
					role="tab"
					id={`mobile-tools-${tab.name}-tab`}
					aria-controls="mobile-tools-panel"
					active={toolsRoute.activeTab === tab.name}
					onclick={() => toolsRoute.setActiveTab(tab.name)}
				>
					{tab.label}
				</SyTab>
			{/each}
		</div>
	</header>

	<div
		role="tabpanel"
		id="mobile-tools-panel"
		aria-labelledby={`mobile-tools-${toolsRoute.activeTab}-tab`}
		tabindex="0"
		class="mobile-tools__content"
	>
		<TextConversionToolPanel
			variant="mobile"
			tool={toolsRoute.activeTool.name}
			busy={toolsRoute.operationState.busy}
			status={toolsRoute.operationState.status}
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
		flex-wrap: wrap;
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
