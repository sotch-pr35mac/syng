<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, ChevronRight, Copy, Info, Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import ColorizedPinyin from '@/components/ColorizedText/ColorizedPinyin.svelte';
	import ColorizedPinyinText from '@/components/ColorizedText/ColorizedPinyinText.svelte';
	import { toolsActiveTabStore } from '@/stores/tools.svelte.js';
	import {
		segmentsToCharacterText,
		segmentsToPinyinText,
		toolsStore,
	} from '@/composables/tools.svelte.js';
	import { handleError } from '@/utils/error.js';
	import type { ToolName } from '@/types/tools.js';

	const tabs: { name: ToolName; label: string }[] = [
		{ name: 'pinyinify', label: 'Pinyin' },
		{ name: 'converter', label: 'Convert' },
		{ name: 'colorize', label: 'Color' },
		{ name: 'prettify', label: 'Prettify' },
	];
	const PLACEHOLDER_ROTATION_MS = 2000;
	const placeholders: Record<ToolName, string[]> = {
		pinyinify: ['中文', '你好，今天怎么样？', 'Paste Chinese text to add pinyin.'],
		converter: ['繁體字', '简体字', 'Paste Simplified or Traditional Chinese.'],
		colorize: ['中文', 'ni3 hao3', 'nǐ hǎo', 'Paste characters or pinyin to color by tone.'],
		prettify: ['ni3 hao3', 'nǐ hǎo', 'Paste pinyin with numbers or tone marks.'],
	};
	const toolInfo: Record<ToolName, { title: string; body: string }> = {
		pinyinify: {
			title: 'Pinyinify',
			body: 'Pinyinify segments Chinese text with the dictionary and adds pinyin with tone marks while preserving punctuation, spacing, and non-Chinese text.',
		},
		converter: {
			title: 'Convert',
			body: 'Convert switches Chinese text between Simplified and Traditional. Automatic mode detects the current script and converts to the opposite script.',
		},
		colorize: {
			title: 'Colorize',
			body: 'Colorize applies your tone colors to Chinese characters or pinyin. Automatic mode detects whether the input is characters or pinyin and preserves the original character script.',
		},
		prettify: {
			title: 'Prettify',
			body: 'Prettify switches pinyin between tone-number notation and tone marks. Automatic mode detects the notation in your input and converts to the other style.',
		},
	};

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

	const pinyinifyText = $derived(segmentsToPinyinText(toolsStore.pinyinifyResult));
	const colorizeModeForOutput = $derived(
		toolsStore.colorizeResolvedMode ??
			(toolsStore.colorizeMode === 'pinyin' ? 'pinyin' : 'characters')
	);
	const colorizeText = $derived(
		colorizeModeForOutput === 'pinyin'
			? toolsStore.colorizeRawPinyin || segmentsToPinyinText(toolsStore.colorizeResult)
			: segmentsToCharacterText(toolsStore.colorizeResult, toolsStore.colorizeResolvedScript)
	);
	const activeInfo = $derived(infoTool ? toolInfo[infoTool] : null);
	const activePlaceholder = $derived(
		placeholders[activeTab][placeholderIndex % placeholders[activeTab].length]
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

{#snippet toolHeading(tool: ToolName, label: string, headingId: string)}
	<div class="mobile-tools__tool-heading">
		<h2 id={headingId}>{label}</h2>
		<button
			type="button"
			class="mobile-tools__icon-button sy-tooltip--container"
			aria-label={`Learn about ${label}`}
			onclick={() => (infoTool = tool)}
		>
			<Info size="15" />
			<div class="sy-tooltip--body sy-tooltip--body-bottom"><p>Learn about this tool</p></div>
		</button>
		<button
			type="button"
			class="mobile-tools__icon-button"
			aria-label={inputCollapsed[tool] ? `Expand ${label} input` : `Collapse ${label} input`}
			onclick={() => toggleInput(tool)}
		>
			{#if inputCollapsed[tool]}
				<ChevronRight size="17" />
			{:else}
				<ChevronDown size="17" />
			{/if}
		</button>
	</div>
{/snippet}

<div class="mobile-tools">
	<header class="mobile-tools__header">
		<div class="mobile-tools__tabs" aria-label="Extras tools">
			{#each tabs as tab (tab.name)}
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
		{#if activeTab === 'pinyinify'}
			<section class="mobile-tools__panel" aria-labelledby="mobile-pinyinify-heading">
				{@render toolHeading('pinyinify', 'Pinyinify', 'mobile-pinyinify-heading')}
				{#if !inputCollapsed.pinyinify}
					<textarea
						aria-label="Pinyinify input"
						placeholder={activePlaceholder}
						value={toolsStore.pinyinifyInput}
						oninput={(event) =>
							toolsStore.setPinyinifyInput(
								(event.currentTarget as HTMLTextAreaElement).value
							)}
					></textarea>
					<SyButton onclick={toolsStore.doPinyinify} center>
						<Play size="16" />
						<span>Process</span>
					</SyButton>
				{/if}
				<div class="mobile-tools__output" aria-label="Pinyinify output">
					<p>{pinyinifyText}</p>
					<SyButton
						style="ghost"
						onclick={() => {
							copyText(pinyinifyText);
						}}
						disabled={!pinyinifyText}
					>
						<Copy size="16" />
					</SyButton>
				</div>
			</section>
		{:else if activeTab === 'converter'}
			<section class="mobile-tools__panel" aria-labelledby="mobile-converter-heading">
				{@render toolHeading('converter', 'Convert', 'mobile-converter-heading')}
				{#if !inputCollapsed.converter}
					<textarea
						aria-label="Converter input"
						placeholder={activePlaceholder}
						value={toolsStore.converterInput}
						oninput={(event) =>
							toolsStore.setConverterInput(
								(event.currentTarget as HTMLTextAreaElement).value
							)}
					></textarea>
					<div class="mobile-tools__controls">
						<SyButtonBar size="small">
							<SyButton
								grouped
								color={toolsStore.converterDirection === 'automatic'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setConverterDirection('automatic')}
							>
								Automatic
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.converterDirection === 'to_simplified'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setConverterDirection('to_simplified')}
							>
								Simplified
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.converterDirection === 'to_traditional'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setConverterDirection('to_traditional')}
							>
								Traditional
							</SyButton>
						</SyButtonBar>
						{#if toolsStore.converterDecision}
							<p class="mobile-tools__decision">{toolsStore.converterDecision}</p>
						{/if}
						<SyButton onclick={toolsStore.doConvert} center>
							<Play size="16" />
							<span>Process</span>
						</SyButton>
					</div>
				{/if}
				<div class="mobile-tools__output" aria-label="Converter output">
					<p>{toolsStore.converterResult}</p>
					<SyButton
						style="ghost"
						onclick={() => {
							copyText(toolsStore.converterResult);
						}}
						disabled={!toolsStore.converterResult}
					>
						<Copy size="16" />
					</SyButton>
				</div>
			</section>
		{:else if activeTab === 'colorize'}
			<section class="mobile-tools__panel" aria-labelledby="mobile-colorize-heading">
				{@render toolHeading('colorize', 'Colorize', 'mobile-colorize-heading')}
				{#if !inputCollapsed.colorize}
					<textarea
						aria-label="Colorize input"
						placeholder={activePlaceholder}
						value={toolsStore.colorizeInput}
						oninput={(event) =>
							toolsStore.setColorizeInput(
								(event.currentTarget as HTMLTextAreaElement).value
							)}
					></textarea>
					<div class="mobile-tools__controls">
						<SyButtonBar size="small">
							<SyButton
								grouped
								color={toolsStore.colorizeMode === 'automatic' ? 'blue' : undefined}
								onclick={() => toolsStore.setColorizeMode('automatic')}
							>
								Auto
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.colorizeMode === 'characters'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setColorizeMode('characters')}
							>
								Characters
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.colorizeMode === 'pinyin' ? 'blue' : undefined}
								onclick={() => toolsStore.setColorizeMode('pinyin')}
							>
								Pinyinify
							</SyButton>
						</SyButtonBar>
						{#if toolsStore.colorizeMode !== 'pinyin'}
							<SyButtonBar size="small">
								<SyButton
									grouped
									color={toolsStore.colorizeScript === 'automatic'
										? 'blue'
										: undefined}
									onclick={() => toolsStore.setColorizeScript('automatic')}
								>
									Auto
								</SyButton>
								<SyButton
									grouped
									color={toolsStore.colorizeScript === 'simplified'
										? 'blue'
										: undefined}
									onclick={() => toolsStore.setColorizeScript('simplified')}
								>
									Simplified
								</SyButton>
								<SyButton
									grouped
									color={toolsStore.colorizeScript === 'traditional'
										? 'blue'
										: undefined}
									onclick={() => toolsStore.setColorizeScript('traditional')}
								>
									Traditional
								</SyButton>
							</SyButtonBar>
						{/if}
						{#if toolsStore.colorizeDecision}
							<p class="mobile-tools__decision">{toolsStore.colorizeDecision}</p>
						{/if}
						<SyButton onclick={toolsStore.doColorize} center>
							<Play size="16" />
							<span>Process</span>
						</SyButton>
					</div>
				{/if}
				<div
					class="mobile-tools__output mobile-tools__output--large"
					aria-label="Colorize output"
				>
					<p>
						{#if colorizeModeForOutput === 'pinyin'}
							{#if toolsStore.colorizeRawPinyin}
								<ColorizedPinyinText text={toolsStore.colorizeRawPinyin} />
							{:else}
								<ColorizedPinyin segments={toolsStore.colorizeResult} />
							{/if}
						{:else}
							{#each toolsStore.colorizeResult as segment, index (index)}
								{#if segment.word_data}
									<ChineseCharacters
										characters={toolsStore.colorizeResolvedScript ===
										'automatic'
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
					</p>
					<SyButton
						style="ghost"
						onclick={() => {
							copyText(colorizeText);
						}}
						disabled={!colorizeText}
					>
						<Copy size="16" />
					</SyButton>
				</div>
			</section>
		{:else}
			<section class="mobile-tools__panel" aria-labelledby="mobile-prettify-heading">
				{@render toolHeading('prettify', 'Prettify', 'mobile-prettify-heading')}
				{#if !inputCollapsed.prettify}
					<textarea
						aria-label="Prettify input"
						placeholder={activePlaceholder}
						value={toolsStore.prettifyInput}
						oninput={(event) =>
							toolsStore.setPrettifyInput(
								(event.currentTarget as HTMLTextAreaElement).value
							)}
					></textarea>
					<div class="mobile-tools__controls">
						<SyButtonBar size="small">
							<SyButton
								grouped
								color={toolsStore.prettifyDirection === 'automatic'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setPrettifyDirection('automatic')}
							>
								Auto
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.prettifyDirection === 'to_marks'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setPrettifyDirection('to_marks')}
							>
								Marks
							</SyButton>
							<SyButton
								grouped
								color={toolsStore.prettifyDirection === 'to_numbers'
									? 'blue'
									: undefined}
								onclick={() => toolsStore.setPrettifyDirection('to_numbers')}
							>
								Numbers
							</SyButton>
						</SyButtonBar>
						{#if toolsStore.prettifyDecision}
							<p class="mobile-tools__decision">{toolsStore.prettifyDecision}</p>
						{/if}
						<SyButton onclick={toolsStore.doPrettify} center>
							<Play size="16" />
							<span>Process</span>
						</SyButton>
					</div>
				{/if}
				<div class="mobile-tools__output" aria-label="Prettify output">
					<p>{toolsStore.prettifyResult}</p>
					<SyButton
						style="ghost"
						onclick={() => {
							copyText(toolsStore.prettifyResult);
						}}
						disabled={!toolsStore.prettifyResult}
					>
						<Copy size="16" />
					</SyButton>
				</div>
			</section>
		{/if}
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
	.mobile-tools__panel {
		display: flex;
		flex-direction: column;
		gap: var(--sy-mobile-space--large);
	}
	.mobile-tools__tool-heading {
		display: flex;
		align-items: center;
		gap: var(--sy-mobile-space--medium);
	}
	.mobile-tools__tool-heading h2 {
		margin: 0;
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--bold);
	}
	.mobile-tools__icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--sy-mobile-touch-target);
		height: var(--sy-mobile-touch-target);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sy-color--grey-5);
	}
	.mobile-tools__panel textarea {
		width: 100%;
		box-sizing: border-box;
		min-height: 132px;
		padding: var(--sy-mobile-space--large);
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background-color: var(--sy-color--white);
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: 16px;
		line-height: 1.5;
		resize: vertical;
	}
	.mobile-tools__controls {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sy-mobile-space--medium);
	}
	.mobile-tools__decision {
		margin: 0;
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--mobile-small);
		line-height: 1.4;
	}
	.mobile-tools__output {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--sy-mobile-space--medium);
		align-items: start;
		min-height: 88px;
		padding: var(--sy-mobile-space--large);
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
		background-color: var(--sy-color--grey-2);
	}
	.mobile-tools__output--large {
		font-size: var(--sy-font-size--mobile-large);
	}
	.mobile-tools__output p {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}
	:global(.mobile-tools .sy-button) {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-mobile-space--medium);
	}
	.mobile-tools__info {
		margin: 0;
		line-height: 1.5;
	}
</style>
