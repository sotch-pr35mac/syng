<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronUp, Info } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import type { TextConversionToolVariant } from '@/types/textConversionTool.js';

	const {
		label,
		headingId,
		collapsed,
		variant = 'desktop',
		draggableTitle = false,
		onBack,
		onInfo,
		onToggleCollapse,
	}: {
		label: string;
		headingId: string;
		collapsed: boolean;
		variant?: TextConversionToolVariant;
		draggableTitle?: boolean;
		onBack: () => void;
		onInfo: () => void;
		onToggleCollapse: () => void;
	} = $props();
</script>

<header
	class="tool-page-header"
	class:tool-page-header--mobile={variant === 'mobile'}
	data-tauri-drag-region={draggableTitle ? true : undefined}
>
	<SyButton
		style="ghost"
		classes={['tool-page-header__button']}
		aria-label="All tools"
		title="All tools"
		guideTarget="extras-tools"
		onclick={onBack}
	>
		<ChevronLeft size="20" />
	</SyButton>
	<h1 id={headingId} tabindex="-1" data-tauri-drag-region={draggableTitle ? true : undefined}>
		{label}
	</h1>
	<SyButton
		style="ghost"
		classes={['tool-page-header__button']}
		aria-label={`Learn about ${label}`}
		title="Learn about this tool"
		onclick={onInfo}
	>
		<Info size="16" />
	</SyButton>
	<SyButton
		style="ghost"
		classes={['tool-page-header__button', 'tool-page-header__collapse']}
		aria-label={collapsed ? `Expand ${label} input` : `Collapse ${label} input`}
		aria-expanded={!collapsed}
		aria-controls={!collapsed ? `${headingId}-input` : undefined}
		onclick={onToggleCollapse}
	>
		{#if collapsed}<ChevronDown size="17" />{:else}<ChevronUp size="17" />{/if}
	</SyButton>
</header>

<style>
	.tool-page-header {
		position: sticky;
		top: 0;
		z-index: var(--sy-z-index--base);
		background-color: var(--sy-surface--content);
		display: flex;
		align-items: center;
		gap: var(--sy-space);
		padding-block: var(--sy-space--extra-large) var(--sy-space--large);
	}
	h1 {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
		font-size: var(--sy-font-size--heading);
	}
	.tool-page-header :global(.tool-page-header__button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin: 0;
		padding: var(--sy-space);
	}
	.tool-page-header :global(.tool-page-header__collapse) {
		margin-inline-start: auto;
	}
	.tool-page-header--mobile {
		background-color: var(--sy-surface--chrome);
		padding-block: var(--sy-mobile-space--large) var(--sy-mobile-space--medium);
	}
	.tool-page-header--mobile h1 {
		font-size: var(--sy-font-size--mobile-heading);
	}
	.tool-page-header--mobile :global(.tool-page-header__button) {
		min-width: var(--sy-mobile-touch-target);
		min-height: var(--sy-mobile-touch-target);
	}
</style>
