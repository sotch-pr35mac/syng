<script lang="ts">
	import { onMount } from 'svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import TextConversionToolPanel from '@/components/Tools/TextConversionToolPanel.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import ColorizedPinyin from '@/components/ColorizedText/ColorizedPinyin.svelte';
	import ColorizedRawPinyinText from '@/components/ColorizedText/ColorizedRawPinyinText.svelte';
	import { toolsActiveTabStore } from '@/stores/tools.svelte.js';
	import {
		colorizeModeForOutput,
		textConversionHeadingId,
		textConversionPlaceholders,
		textConversionTabs,
		textConversionToolConfigs,
		textConversionToolInfo,
	} from '@/composables/textConversionTools.js';
	import { toolsStore } from '@/composables/tools.svelte.js';
	import { handleError } from '@/utils/error.js';
	import type { ToolName } from '@/types/tools.js';

	const PLACEHOLDER_ROTATION_MS = 2000;

	let activeTab = $state<ToolName>(toolsActiveTabStore.value);
	let showCopyToast = $state(false);
	let placeholderIndex = $state(0);
	let infoTool = $state<ToolName | null>(null);
	let inputCollapsed = $state<Record<ToolName, boolean>>({
		pinyinify: false,
		converter: false,
		colorize: false,
		prettify: false,
	});

	const activeTool = $derived(textConversionToolConfigs[activeTab]);
	const activeInfo = $derived(infoTool ? textConversionToolInfo[infoTool] : null);
	const activePlaceholder = $derived(
		textConversionPlaceholders[activeTab][
			placeholderIndex % textConversionPlaceholders[activeTab].length
		]
	);

	onMount(() => {
		const interval = window.setInterval(() => {
			placeholderIndex += 1;
		}, PLACEHOLDER_ROTATION_MS);
		return () => window.clearInterval(interval);
	});

	function setActiveTab(tab: ToolName): void {
		activeTab = tab;
		toolsActiveTabStore.set(tab);
	}

	function toggleInput(tool: ToolName): void {
		inputCollapsed = { ...inputCollapsed, [tool]: !inputCollapsed[tool] };
	}

	async function copyText(text: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			showCopyToast = true;
		} catch (error) {
			handleError('Copy failed.', error);
		}
	}
</script>

<div class="mobile-tools">
	<header class="mobile-tools__header">
		<div class="mobile-tools__tabs" aria-label="Extras tools">
			{#each textConversionTabs as tab (tab.name)}
				<SyTab
					variant="mobile"
					active={activeTab === tab.name}
					onclick={() => setActiveTab(tab.name)}
				>
					{tab.label}
				</SyTab>
			{/each}
		</div>
	</header>

	<div class="mobile-tools__content">
		<TextConversionToolPanel
			variant="mobile"
			tool={activeTool.name}
			label={activeTool.label}
			headingId={textConversionHeadingId(activeTool.name, 'mobile')}
			inputLabel={activeTool.inputLabel}
			inputValue={activeTool.getInput()}
			placeholder={activePlaceholder}
			outputLabel={activeTool.outputLabel}
			outputText={activeTool.getOutputText()}
			collapsed={inputCollapsed[activeTool.name]}
			controlGroups={activeTool.getControlGroups?.() ?? []}
			decisionText={activeTool.getDecisionText?.() ?? ''}
			outputLarge={activeTool.outputLarge}
			onInputChange={activeTool.setInput}
			onProcess={activeTool.process}
			onCopy={copyText}
			onInfo={(tool) => (infoTool = tool)}
			onToggleCollapse={toggleInput}
		>
			{#snippet customOutput()}
				{#if activeTab === 'colorize'}
					{#if colorizeModeForOutput() === 'pinyin'}
						{#if toolsStore.colorizeRawPinyin}
							<ColorizedRawPinyinText text={toolsStore.colorizeRawPinyin} />
						{:else}
							<ColorizedPinyin segments={toolsStore.colorizeResult} />
						{/if}
					{:else}
						{#each toolsStore.colorizeResult as segment, index (index)}
							{#if segment.word_data}
								<ChineseCharacters
									characters={toolsStore.colorizeResolvedScript === 'automatic'
										? segment.source
										: toolsStore.colorizeResolvedScript === 'simplified'
											? segment.word_data.simplified
											: segment.word_data.traditional}
									tones={segment.word_data.tone_marks}
								/>
							{:else}
								{segment.source}
							{/if}
						{/each}
					{/if}
				{:else}
					{activeTool.getOutputText()}
				{/if}
			{/snippet}
		</TextConversionToolPanel>
	</div>
</div>

<SyToast
	visible={showCopyToast}
	message="Copied to clipboard."
	corner="bottom-right"
	ondismiss={() => (showCopyToast = false)}
/>

<SyModal
	title={activeInfo?.title ?? ''}
	visible={infoTool !== null}
	onclose={() => (infoTool = null)}
>
	{#snippet body()}
		{#if activeInfo}
			<p class="mobile-tools__info">{activeInfo.body}</p>
		{/if}
	{/snippet}
</SyModal>

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
	.mobile-tools__info {
		margin: 0;
		line-height: 1.5;
	}
</style>
