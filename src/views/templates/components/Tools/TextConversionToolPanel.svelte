<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown, ChevronRight, Copy, Info, Play } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import type { ToolName } from '@/types/tools.js';
	import type {
		TextConversionControlGroup,
		TextConversionToolVariant,
	} from '@/types/textConversionTool.js';

	interface Props {
		tool: ToolName;
		label: string;
		headingId: string;
		inputLabel: string;
		inputValue: string;
		placeholder: string;
		outputLabel: string;
		outputText: string;
		collapsed: boolean;
		variant?: TextConversionToolVariant;
		controlGroups?: TextConversionControlGroup[];
		decisionText?: string;
		outputLarge?: boolean;
		customOutput?: Snippet;
		onInputChange: (text: string) => void;
		onProcess: () => void;
		onCopy: (text: string) => void;
		onInfo: (tool: ToolName) => void;
		onToggleCollapse: (tool: ToolName) => void;
	}

	const {
		tool,
		label,
		headingId,
		inputLabel,
		inputValue,
		placeholder,
		outputLabel,
		outputText,
		collapsed,
		variant = 'desktop',
		controlGroups = [],
		decisionText = '',
		outputLarge = false,
		customOutput,
		onInputChange,
		onProcess,
		onCopy,
		onInfo,
		onToggleCollapse,
	}: Props = $props();

	const isMobile = $derived(variant === 'mobile');
	const buttonBarSize = $derived(isMobile ? 'small' : 'medium');
	const copyButtonClasses = $derived(isMobile ? [] : ['sy-tooltip--container']);
	const visibleControlGroups = $derived(controlGroups.filter((group) => group.visible !== false));

	function handleInput(event: Event): void {
		onInputChange((event.currentTarget as HTMLTextAreaElement).value);
	}
</script>

<section
	class="text-conversion-tool"
	class:text-conversion-tool--mobile={isMobile}
	aria-labelledby={headingId}
>
	<div class="text-conversion-tool__heading">
		<h2 id={headingId}>{label}</h2>
		<button
			type="button"
			class="text-conversion-tool__icon-button sy-tooltip--container"
			aria-label={`Learn about ${label}`}
			onclick={() => onInfo(tool)}
		>
			<Info size="15" />
			{#if !isMobile}
				<div class="sy-tooltip--body sy-tooltip--body-bottom">
					<p>Learn about this tool</p>
				</div>
			{/if}
		</button>
		<button
			type="button"
			class="text-conversion-tool__icon-button"
			aria-label={collapsed ? `Expand ${label} input` : `Collapse ${label} input`}
			onclick={() => onToggleCollapse(tool)}
		>
			{#if collapsed}
				<ChevronRight size="17" />
			{:else}
				<ChevronDown size="17" />
			{/if}
		</button>
	</div>

	{#if !collapsed}
		<textarea aria-label={inputLabel} {placeholder} value={inputValue} oninput={handleInput}
		></textarea>
		<div
			class="text-conversion-tool__controls"
			class:text-conversion-tool__controls--empty={visibleControlGroups.length === 0 &&
				!decisionText}
		>
			{#each visibleControlGroups as group (group.id)}
				<SyButtonBar size={buttonBarSize} aria-label={group.ariaLabel}>
					{#each group.options as option (option.id)}
						<SyButton
							grouped
							color={option.active ? 'blue' : undefined}
							onclick={option.onSelect}
						>
							{isMobile ? (option.mobileLabel ?? option.label) : option.label}
						</SyButton>
					{/each}
				</SyButtonBar>
			{/each}
			{#if decisionText}
				<p class="text-conversion-tool__decision">{decisionText}</p>
			{/if}
			<SyButton onclick={onProcess} center>
				<Play size="16" />
				<span>Process</span>
			</SyButton>
		</div>
	{/if}

	<div
		class="text-conversion-tool__output"
		class:text-conversion-tool__output--large={outputLarge}
		aria-label={outputLabel}
	>
		<p>
			{#if customOutput}
				{@render customOutput()}
			{:else}
				{outputText}
			{/if}
		</p>
		<SyButton
			style="ghost"
			classes={copyButtonClasses}
			onclick={() => onCopy(outputText)}
			disabled={!outputText}
		>
			<Copy size="16" />
			{#if !isMobile}
				<div class="sy-tooltip--body sy-tooltip--body-bottom"><p>Copy</p></div>
			{/if}
		</SyButton>
	</div>
</section>

<style>
	.text-conversion-tool {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: 100%;
	}
	.text-conversion-tool__heading {
		display: flex;
		align-items: center;
		gap: var(--sy-space);
	}
	.text-conversion-tool__heading h2 {
		margin: 0;
		font-size: var(--sy-font-size--large);
	}
	.text-conversion-tool__icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sy-color--grey-5);
		cursor: pointer;
	}
	.text-conversion-tool__icon-button:hover {
		color: var(--sy-color--blue);
	}
	.text-conversion-tool textarea {
		width: 100%;
		box-sizing: border-box;
		min-height: 150px;
		resize: vertical;
		padding: var(--sy-space--large);
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background-color: var(--sy-color--white);
		color: var(--sy-color--black);
		font-family: var(--sy-font-family);
		font-size: var(--sy-font-size--medium);
		line-height: 1.6;
	}
	.text-conversion-tool__controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sy-space);
	}
	.text-conversion-tool__controls--empty {
		align-items: center;
	}
	.text-conversion-tool__decision {
		margin: 0;
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--small);
	}
	.text-conversion-tool__output {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--sy-space--large);
		align-items: start;
		min-height: 96px;
		padding: var(--sy-space--large);
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		background-color: var(--sy-color--grey-2);
	}
	.text-conversion-tool__output--large {
		font-size: var(--sy-font-size--large);
	}
	.text-conversion-tool__output p {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.6;
	}
	:global(.text-conversion-tool__controls .sy-button) {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
	}
	.text-conversion-tool--mobile {
		gap: var(--sy-mobile-space--large);
	}
	.text-conversion-tool--mobile .text-conversion-tool__heading {
		gap: var(--sy-mobile-space--medium);
	}
	.text-conversion-tool--mobile .text-conversion-tool__heading h2 {
		font-size: var(--sy-font-size--mobile-large);
		font-weight: var(--sy-font-weight--bold);
	}
	.text-conversion-tool--mobile .text-conversion-tool__icon-button {
		width: var(--sy-mobile-touch-target);
		height: var(--sy-mobile-touch-target);
	}
	.text-conversion-tool--mobile textarea {
		min-height: 132px;
		padding: var(--sy-mobile-space--large);
		border: var(--sy-mobile-surface-border);
		font-size: 16px;
		line-height: 1.5;
	}
	.text-conversion-tool--mobile .text-conversion-tool__controls {
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sy-mobile-space--medium);
	}
	.text-conversion-tool--mobile .text-conversion-tool__decision {
		font-size: var(--sy-font-size--mobile-small);
		line-height: 1.4;
	}
	.text-conversion-tool--mobile .text-conversion-tool__output {
		gap: var(--sy-mobile-space--medium);
		min-height: 88px;
		padding: var(--sy-mobile-space--large);
		border: var(--sy-mobile-surface-border);
	}
	.text-conversion-tool--mobile .text-conversion-tool__output--large {
		font-size: var(--sy-font-size--mobile-large);
	}
	.text-conversion-tool--mobile .text-conversion-tool__output p {
		line-height: 1.5;
	}
	:global(.text-conversion-tool--mobile .sy-button) {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-mobile-space--medium);
	}
</style>
