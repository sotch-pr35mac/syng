<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';

	type Props = {
		cancelLabel?: string;
		confirmLabel?: string;
		busyLabel?: string;
		busy?: boolean;
		disabled?: boolean;
		oncancel?: () => void;
		onconfirm?: () => void;
	};

	const {
		cancelLabel = 'Cancel',
		confirmLabel = 'Save',
		busyLabel = confirmLabel,
		busy = false,
		disabled = false,
		oncancel = () => {},
		onconfirm = () => {},
	}: Props = $props();
</script>

<SyButton size="large" onclick={oncancel}>{cancelLabel}</SyButton>
<SyButton size="large" color="green" disabled={disabled} onclick={onconfirm}>
	{busy ? busyLabel : confirmLabel}
</SyButton>
