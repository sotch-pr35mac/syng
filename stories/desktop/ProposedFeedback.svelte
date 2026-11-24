<script lang="ts">
	import { tick } from 'svelte';
	import { X } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';

	type Sample = 'modal' | 'popover' | 'toast';
	const { sample }: { sample: Sample } = $props();
	const descriptions: Record<Sample, string> = {
		modal: 'The selected plain shell: a quiet rim, a centered entrance, and a directional shadow.',
		popover:
			'A contextual surface that opens from its source with a small directional contraction and reverses on close.',
		toast: 'A brief status surface that condenses toward its screen edge on exit, with the same motion grammar.',
	};
	let open = $state(false);
	let instant = $state(false);
	let closeButton = $state<HTMLButtonElement>();
	let dialog = $state<HTMLElement>();

	async function show(event: MouseEvent): Promise<void> {
		instant = event.detail === 0;
		open = true;
		if (sample === 'modal') {
			await tick();
			closeButton?.focus({ preventScroll: true });
		}
	}

	async function dismiss(event?: MouseEvent | KeyboardEvent): Promise<void> {
		instant = event instanceof KeyboardEvent || event?.detail === 0;
		open = false;
		if (sample === 'modal') {
			await tick();
			document.getElementById('proposal-modal-trigger')?.focus({ preventScroll: true });
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!open) {
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			void dismiss(event);
			return;
		}
		if (sample !== 'modal' || event.key !== 'Tab' || !dialog) {
			return;
		}
		const focusable = Array.from(
			dialog.querySelectorAll<HTMLElement>(
				'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
			)
		);
		if (!focusable.length) {
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="catalog" class:catalog--instant={instant}>
	<header>
		<p class="eyebrow">Syng · proposal specimen</p>
		<h1>
			{sample === 'modal' ? 'Modal' : sample === 'popover' ? 'Popover' : 'Toast'} motion
		</h1>
		<p>{descriptions[sample]}</p>
		<p class="qualification">
			{sample === 'modal'
				? 'The plain treatment is now the live SyModal standard. Open its Element story to inspect current behavior.'
				: 'The live Sy component now uses the approved material direction. Compare its Element story for current behavior and motion.'}
		</p>
	</header>

	<section class="stage" class:stage--modal={sample === 'modal'}>
		{#if sample === 'modal'}
			<div class="stage-content" inert={open}>
				<h2>Plain modal reference</h2>
				<p>This reference shows the shell direction selected for the standard component.</p>
				<SyButton id="proposal-modal-trigger" onclick={show}>Open reference modal</SyButton>
			</div>
			<button
				class="modal-backdrop"
				class:modal-backdrop--open={open}
				aria-label="Close proposed modal"
				tabindex="-1"
				inert={!open}
				onclick={dismiss}
			></button>
			<div
				class="proposal-modal"
				class:proposal-modal--open={open}
				role={open ? 'dialog' : undefined}
				aria-modal={open ? 'true' : undefined}
				aria-labelledby={open ? 'proposal-modal-title' : undefined}
				aria-hidden={!open}
				inert={!open}
				bind:this={dialog}
			>
				<div class="proposal-modal__header">
					<h2 id="proposal-modal-title">Remove this word?</h2>
					<button
						class="icon-button"
						aria-label="Close proposed modal"
						bind:this={closeButton}
						onclick={dismiss}><X size="18" aria-hidden="true" /></button
					>
				</div>
				<p>The word will leave this list. You can add it again from Search.</p>
				<div class="proposal-modal__actions">
					<SyButton style="ghost" onclick={dismiss}>Cancel</SyButton>
					<SyButton color="red" onclick={dismiss}>Remove word</SyButton>
				</div>
			</div>
		{:else if sample === 'popover'}
			<div class="stage-content">
				<h2>Dictionary link</h2>
				<p>Click the highlighted word to inspect the attached detail surface.</p>
				<div class="popover-anchor">
					<button
						class="word-trigger"
						aria-expanded={open}
						aria-controls="proposal-popover"
						onclick={(event) => (open ? dismiss(event) : show(event))}>学习</button
					>
					<div
						id="proposal-popover"
						class="proposal-popover"
						class:proposal-popover--open={open}
						role={open ? 'dialog' : undefined}
						aria-label={open ? 'Quick dictionary preview' : undefined}
						aria-hidden={!open}
						inert={!open}
					>
						<div class="proposal-popover__header">
							<strong>学习 <span>xuéxí</span></strong>
							<button
								class="icon-button"
								aria-label="Close proposed popover"
								onclick={dismiss}><X size="16" aria-hidden="true" /></button
							>
						</div>
						<p>to study; to learn</p>
						<SyButton size="small" onclick={dismiss}>View entry</SyButton>
					</div>
				</div>
			</div>
		{:else}
			<div class="stage-content">
				<h2>Saved list feedback</h2>
				<p>Use the action to inspect a status notification at the corner.</p>
				<SyButton onclick={show}>Show proposed toast</SyButton>
			</div>
			<div
				class="proposal-toast"
				class:proposal-toast--open={open}
				role="status"
				aria-live="polite"
				aria-hidden={!open}
				inert={!open}
			>
				<div>
					<strong>Your list was saved</strong>
					<span>The latest changes are available offline.</span>
				</div>
				<button class="toast-action" onclick={dismiss}>Undo</button>
				<button
					class="icon-button"
					aria-label="Dismiss proposed notification"
					onclick={dismiss}><X size="16" aria-hidden="true" /></button
				>
			</div>
		{/if}
	</section>

	<div class="notes">
		{#if sample === 'modal'}
			<p>
				The layered option changes only the shell: a crisper 9px corner, a fine rim, and a
				more directional shadow. If that still feels generic, the modal can stay quiet and
				let its motion and clear task do the work.
			</p>
		{/if}
		<strong>Motion contract</strong>
		<table>
			<thead
				><tr
					><th scope="col">Surface</th><th scope="col">Origin</th><th scope="col"
						>Timing</th
					></tr
				></thead
			>
			<tbody>
				<tr><td>Dropdown</td><td>Selected trigger</td><td>Fast · 190ms</td></tr>
				<tr><td>Popover</td><td>Clicked word or control</td><td>Regular · 240ms</td></tr>
				<tr><td>Toast</td><td>Arrival edge</td><td>Fast · 190ms</td></tr>
				<tr><td>Modal</td><td>Viewport center</td><td>Regular · 240ms</td></tr>
			</tbody>
		</table>
		<p>
			This table describes the original studies. The live Popover retains its earlier anchor
			entrance and exit animation and outside-click behavior; its material treatment now uses
			the shared raised shadow. Toast uses the corner-origin motion. The plain modal shell is
			the adopted standard.
		</p>
	</div>
</main>

<style>
	.catalog {
		--proposal-ease: cubic-bezier(0.22, 1, 0.36, 1);
		--proposal-motion-fast: 190ms;
		--proposal-motion-regular: 240ms;
		box-sizing: border-box;
		width: min(980px, 100vw);
		min-height: 100vh;
		padding: 40px 44px 70px;
		background: var(--sy-surface--canvas);
		color: var(--sy-color--black);
	}
	.eyebrow {
		margin: 0 0 8px;
		color: var(--sy-content-list-title);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	header h1 {
		margin: 0 0 10px;
		font-size: var(--sy-font-size--heading);
	}
	header p {
		max-width: 680px;
		line-height: var(--sy-line-height--body);
	}
	.qualification {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
	}
	.stage {
		position: relative;
		box-sizing: border-box;
		width: min(760px, 100%);
		min-height: 340px;
		overflow: hidden;
		margin: 28px 0 24px;
		padding: 34px;
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.stage-content h2 {
		margin: 0 0 8px;
		font-size: var(--sy-font-size--large);
	}
	.stage-content p {
		max-width: 360px;
		margin: 0 0 22px;
		line-height: var(--sy-line-height--body);
	}
	.notes {
		max-width: 740px;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}
	.notes p {
		margin-top: 6px;
		color: var(--sy-text--secondary);
	}
	table {
		width: 100%;
		margin-top: 10px;
		border-collapse: collapse;
		text-align: left;
	}
	th,
	td {
		padding: 6px 12px 6px 0;
		border-bottom: var(--sy-surface-border);
	}
	th {
		color: var(--sy-text--muted);
		font-weight: var(--sy-font-weight--regular);
	}
	.modal-backdrop {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: 0;
		background: var(--sy-color--modal-overlay);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--proposal-motion-regular) var(--proposal-ease);
	}
	.modal-backdrop--open {
		opacity: 0.56;
		pointer-events: auto;
	}
	.proposal-modal {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 2;
		box-sizing: border-box;
		width: min(380px, calc(100% - 32px));
		padding: var(--sy-modal-padding);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--modal);
		background: var(--sy-surface--floating);
		box-shadow: var(--sy-shadow--dialog);
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, calc(-50% + 8px)) scale(0.96);
		transition:
			transform var(--sy-motion--overlay-regular) var(--sy-ease--overlay),
			opacity var(--sy-motion--overlay-fast) var(--sy-ease--overlay);
	}
	.proposal-modal--open {
		opacity: 1;
		pointer-events: auto;
		transform: translate(-50%, -50%) scale(1);
	}
	.proposal-modal__header,
	.proposal-popover__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.proposal-modal__header h2 {
		margin: 0 0 12px;
		font-size: var(--sy-font-size--large);
	}
	.proposal-modal > p,
	.proposal-popover > p {
		margin: 0;
		line-height: var(--sy-line-height--body);
	}
	.proposal-modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 22px;
	}
	.icon-button {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		flex: none;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--sy-text--muted);
		cursor: pointer;
	}
	.icon-button:hover,
	.icon-button:focus-visible {
		background: var(--sy-surface--well);
		color: var(--sy-color--black);
	}
	.word-trigger {
		margin: 8px 0 0;
		padding: 2px 4px;
		border: 0;
		border-radius: var(--sy-border-radius);
		background: transparent;
		color: var(--sy-text--blue);
		font: inherit;
		font-size: var(--sy-font-size--large);
		cursor: pointer;
	}
	.word-trigger:hover,
	.word-trigger:focus-visible {
		background: var(--sy-surface--well);
	}
	.popover-anchor {
		position: relative;
		width: max-content;
	}
	.proposal-popover {
		position: absolute;
		top: calc(100% + 10px);
		left: -8px;
		z-index: 1;
		box-sizing: border-box;
		width: min(294px, calc(100vw - 132px));
		padding: 15px;
		border: var(--sy-surface-border);
		border-radius: 11px;
		background: var(--sy-surface--floating);
		box-shadow:
			0 12px 30px rgba(0, 0, 0, 0.18),
			0 2px 7px rgba(0, 0, 0, 0.09);
		opacity: 0;
		pointer-events: none;
		transform-origin: 32px -10px;
		transform: translateY(-8px) scale(0.89, 0.82);
		transition:
			transform var(--proposal-motion-regular) var(--proposal-ease),
			opacity var(--proposal-motion-fast) var(--proposal-ease);
	}
	.proposal-popover--open {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0) scale(1);
	}
	.proposal-popover::before {
		content: '';
		position: absolute;
		top: -7px;
		left: 26px;
		width: 12px;
		height: 12px;
		background: var(--sy-surface--floating);
		border-top: var(--sy-surface-border);
		border-left: var(--sy-surface-border);
		transform: rotate(45deg);
	}
	.proposal-popover__header strong {
		font-size: var(--sy-font-size--medium);
	}
	.proposal-popover__header span {
		color: var(--sy-text--muted);
		font-weight: var(--sy-font-weight--regular);
	}
	.proposal-popover :global(.sy-button) {
		margin: 18px 0 0;
	}
	.proposal-toast {
		position: absolute;
		top: 18px;
		right: 18px;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		gap: 14px;
		box-sizing: border-box;
		width: min(355px, calc(100% - 36px));
		padding: 13px 14px;
		border: var(--sy-surface-border);
		border-radius: 10px;
		background: var(--sy-surface--floating);
		box-shadow:
			0 9px 26px rgba(0, 0, 0, 0.16),
			0 2px 6px rgba(0, 0, 0, 0.08);
		opacity: 0;
		pointer-events: none;
		transform-origin: 100% 0;
		transform: translateY(-7px) scale(0.94, 0.88);
		transition:
			transform var(--proposal-motion-fast) var(--proposal-ease),
			opacity var(--proposal-motion-fast) var(--proposal-ease);
	}
	.proposal-toast--open {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0) scale(1);
	}
	.proposal-toast > div {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: var(--sy-font-size--small);
	}
	.proposal-toast > div span {
		color: var(--sy-text--secondary);
	}
	.toast-action {
		align-self: center;
		padding: 4px;
		border: 0;
		background: transparent;
		color: var(--sy-text--blue);
		font: inherit;
		font-size: var(--sy-font-size--small);
		cursor: pointer;
	}
	.catalog--instant .modal-backdrop,
	.catalog--instant .proposal-modal,
	.catalog--instant .proposal-popover,
	.catalog--instant .proposal-toast {
		transition: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		.proposal-modal,
		.proposal-popover,
		.proposal-toast {
			transform: none;
			transition: opacity 100ms linear;
		}
		.proposal-modal {
			transform: translate(-50%, -50%);
		}
	}
	@media (max-width: 600px) {
		.catalog {
			padding: 24px 20px 60px;
		}
		.stage {
			padding: 22px;
		}
	}
</style>
