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
		disabledConfirmTooltip?: string;
		errorMessage?: string;
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
		disabledConfirmTooltip = '',
		errorMessage = '',
		width = 'var(--sy-reader-import-modal-width)',
		onclose = () => {},
		onconfirm = () => {},
		body: bodySnippet,
	}: Props = $props();
	const disabledReasonId = `reader-confirm-disabled-${crypto.randomUUID()}`;
</script>

<SyModal {title} {visible} {onclose}>
	{#snippet body()}
		<div class="reader-modal-shell__body" style={`width: ${width};`} aria-busy={busy}>
			{@render bodySnippet?.()}
			{#if errorMessage}
				<p class="reader-modal-shell__error">{errorMessage}</p>
			{/if}
		</div>
		<span class="sy-sr-only" role="status">{busy ? busyLabel : ''}</span>
	{/snippet}
	{#snippet footer()}
		<SyButton size="large" onclick={onclose}>{cancelLabel}</SyButton>
		{#if disabled && disabledConfirmTooltip}
			<span class="sy-tooltip--container">
				<SyButton
					size="large"
					color="green"
					{disabled}
					onclick={onconfirm}
					aria-describedby={disabledReasonId}
				>
					{busy ? busyLabel : confirmLabel}
				</SyButton>
				<span class="sy-tooltip--body sy-tooltip--body-top" id={disabledReasonId}
					><p>{disabledConfirmTooltip}</p></span
				>
			</span>
		{:else}
			<SyButton size="large" color="green" {disabled} onclick={onconfirm}>
				{busy ? busyLabel : confirmLabel}
			</SyButton>
		{/if}
	{/snippet}
</SyModal>

<style>
	.reader-modal-shell__error {
		margin: var(--sy-space--none);
		color: var(--sy-color--red);
	}

	.reader-modal-shell__body {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
</style>
