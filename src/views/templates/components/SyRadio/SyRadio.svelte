<script lang="ts">
	interface Props {
		name: string;
		value: string;
		checked: boolean;
		disabled?: boolean;
		onchange?: (event: Event) => void;
	}

	const { name, value, checked, disabled = false, onchange }: Props = $props();
</script>

<input type="radio" {name} {value} {checked} {disabled} {onchange} />

<style>
	input {
		appearance: none;
		display: inline-grid;
		place-content: center;
		box-sizing: border-box;
		width: 18px;
		height: 18px;
		flex: 0 0 18px;
		margin: 0;
		border: 1px solid var(--sy-control--border);
		border-radius: 50%;
		background: var(--sy-surface--content);
		cursor: pointer;
	}
	input::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--sy-color--blue-2);
		transform: scale(0);
		transition: transform var(--sy-transition-duration) ease;
	}
	input:checked {
		border-color: var(--sy-color--blue-2);
	}
	input:checked::before {
		transform: scale(1);
	}
	input:focus-visible {
		outline: 2px solid var(--sy-focus-color);
		outline-offset: 2px;
	}
	input:disabled {
		opacity: 0.5;
		cursor: default;
	}
	@media (prefers-reduced-motion: reduce) {
		input::before {
			transition: none;
		}
	}
	@media (forced-colors: active) {
		input {
			appearance: auto;
		}
		input::before {
			display: none;
		}
	}
</style>
