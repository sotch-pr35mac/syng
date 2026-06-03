<script lang="ts">
	import { onMount } from 'svelte';
	import { platform } from '@tauri-apps/plugin-os';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import TextConversionToolPanel from '@/components/Tools/TextConversionToolPanel.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import ColorizedPinyin from '@/components/ColorizedText/ColorizedPinyin.svelte';
	import ColorizedRawPinyinText from '@/components/ColorizedText/ColorizedRawPinyinText.svelte';
	import { scrollRestore } from '@/actions/scrollRestore.svelte.js';
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

	const isMacos = platform() === 'macos';
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

<div class="tools">
	<div class="tools__title" data-tauri-drag-region={isMacos ? true : undefined}>
		<h1 data-tauri-drag-region={isMacos ? true : undefined}>Extras</h1>
	</div>

	<div class="tools__tabs" aria-label="Extras tools">
		{#each textConversionTabs as tab (tab.name)}
			<SyTab active={activeTab === tab.name} onclick={() => setActiveTab(tab.name)}>
				{tab.label}
			</SyTab>
		{/each}
	</div>

	<div class="tools__content" use:scrollRestore={'tools-content'}>
		<TextConversionToolPanel
			tool={activeTool.name}
			label={activeTool.label}
			headingId={textConversionHeadingId(activeTool.name, 'desktop')}
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
			<p class="tools__info">{activeInfo.body}</p>
		{/if}
	{/snippet}
</SyModal>

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
	.tools__info {
		max-width: 420px;
		margin: 0;
		line-height: 1.5;
	}
</style>
