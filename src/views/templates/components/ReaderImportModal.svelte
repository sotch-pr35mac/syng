<script lang="ts">
	import type { Snippet } from 'svelte';
	import ReaderModalFooter from '@/components/ReaderModalFooter.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';

	type Props = {
		visible?: boolean;
		title?: string;
		disabled?: boolean;
		busy?: boolean;
		confirmLabel?: string;
		busyLabel?: string;
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
		onclose = () => {},
		onconfirm = () => {},
		body: bodySnippet,
	}: Props = $props();
</script>

<SyModal {title} {visible} {onclose}>
	{#snippet body()}
		<div class="reader-import-modal__body">
			{@render bodySnippet?.()}
		</div>
	{/snippet}
	{#snippet footer()}
		<ReaderModalFooter
			{disabled}
			{confirmLabel}
			{busyLabel}
			{busy}
			oncancel={onclose}
			{onconfirm}
		/>
	{/snippet}
</SyModal>

<style>
	.reader-import-modal__body {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		width: var(--sy-reader-import-modal-width);
		max-width: 100%;
	}
</style>
