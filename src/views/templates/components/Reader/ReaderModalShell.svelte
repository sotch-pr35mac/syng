<script lang="ts">
	import type { Snippet } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';

	type Props = {
		visible?: boolean;
		title?: string;
		disabled?: boolean;
		busy?: boolean;
		confirmLabel?: string;
		busyLabel?: string;
		cancelLabel?: string;
		width?: string;
		onclose?: () => void;
		onconfirm?: () => Promise<void> | void;
		body?: Snippet;
	};

	const {
		visible = false,
		title = '',
		disabled = false,
		busy = false,
		confirmLabel = 'Import',
		busyLabel = 'Importing...',
		cancelLabel = 'Cancel',
		width = 'var(--sy-reader-import-modal-width)',
		onclose = () => {},
		onconfirm = () => {},
		body: bodySnippet,
	}: Props = $props();
</script>

<SyModal {title} {visible} {onclose}>
	{#snippet body()}
		<div class="reader-modal-shell__body" style={`width: ${width};`}>
			{@render bodySnippet?.()}
		</div>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={onclose}>{cancelLabel}</SyButton>
		<SyButton size="large" color="green" {disabled} onclick={onconfirm}>
			{busy ? busyLabel : confirmLabel}
		</SyButton>
	{/snippet}
</SyModal>

<style>
	.reader-modal-shell__body {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		max-width: 100%;
	}
</style>
