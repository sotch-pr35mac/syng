<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { portal } from '@/actions/portal.svelte.js';
	import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
	import { GUIDE_LABELS } from '@/components/Walkthrough/walkthroughContent.js';
	const GUTTER = 16;
	const TARGET_PADDING = 6;
	const TARGET_WAIT_MS = 5000;
	const CARD_WIDTH = 336;
	const INITIAL_CARD_HEIGHT = 260;
	let card = $state<HTMLDivElement>();
	let heading = $state<HTMLHeadingElement>();
	let anchor = $state<{ left: number; top: number; width: number; height: number }>();
	let cardStyle = $state('');
	let targetMissing = $state(false);
	let secondaryOpen = $state(false);
	let geometryRevision = $state(0);
	const target = $derived.by(() => {
		void geometryRevision;
		return tour.phase === 'guiding'
			? (tour.target(tour.step?.target) ?? tour.target(tour.step?.fallbackTarget))
			: undefined;
	});
	const exampleKind = $derived(tour.preparation.choose ?? tour.step?.example);
	const existingExample = $derived(
		exampleKind === 'document'
			? tour.preferences.examples.documentId
			: tour.preferences.examples.listName
	);
	const contentKey = $derived(`${tour.phase}:${tour.guide}:${tour.step?.id ?? ''}`);

	function measure(): void {
		const viewport = window.visualViewport;
		const styles = card ? getComputedStyle(card) : undefined;
		const safeTop =
			Number.parseFloat(styles?.getPropertyValue('--walkthrough-safe-top') ?? '') || 0;
		const safeBottom =
			Number.parseFloat(styles?.getPropertyValue('--walkthrough-safe-bottom') ?? '') || 0;
		const safeLeft =
			Number.parseFloat(styles?.getPropertyValue('--walkthrough-safe-left') ?? '') || 0;
		const safeRight =
			Number.parseFloat(styles?.getPropertyValue('--walkthrough-safe-right') ?? '') || 0;
		const viewportTop = (viewport?.offsetTop ?? 0) + safeTop;
		const viewportLeft = (viewport?.offsetLeft ?? 0) + safeLeft;
		const viewportWidth = (viewport?.width ?? window.innerWidth) - safeLeft - safeRight;
		const viewportHeight = (viewport?.height ?? window.innerHeight) - safeTop - safeBottom;
		const right = viewportLeft + viewportWidth;
		const bottom = viewportTop + viewportHeight;
		const measured = target?.getBoundingClientRect();
		if (measured && measured.width > 0 && measured.height > 0) {
			const left = Math.max(viewportLeft + GUTTER / 2, measured.left - TARGET_PADDING);
			const top = Math.max(viewportTop + GUTTER / 2, measured.top - TARGET_PADDING);
			anchor = {
				left,
				top,
				width: Math.max(
					0,
					Math.min(right - GUTTER / 2, measured.right + TARGET_PADDING) - left
				),
				height: Math.max(
					0,
					Math.min(bottom - GUTTER / 2, measured.bottom + TARGET_PADDING) - top
				),
			};
		} else {
			anchor = undefined;
		}
		const width = Math.min(CARD_WIDTH, viewportWidth - GUTTER * 2);
		const height = Math.min(
			card?.getBoundingClientRect().height || INITIAL_CARD_HEIGHT,
			viewportHeight - GUTTER * 2
		);
		let left = viewportLeft + (viewportWidth - width) / 2;
		let top = viewportTop + (viewportHeight - height) / 2;
		if (anchor) {
			if (anchor.left + anchor.width + width + GUTTER * 2 <= right) {
				left = anchor.left + anchor.width + GUTTER;
				top = anchor.top;
			} else if (anchor.left - width - GUTTER >= viewportLeft + GUTTER) {
				left = anchor.left - width - GUTTER;
				top = anchor.top;
			} else {
				const spaceAbove = anchor.top - viewportTop;
				const spaceBelow = bottom - anchor.top - anchor.height;
				top =
					spaceAbove > spaceBelow
						? anchor.top - height - GUTTER
						: anchor.top + anchor.height + GUTTER;
			}
		}
		left = Math.max(viewportLeft + GUTTER, Math.min(left, right - width - GUTTER));
		top = Math.max(viewportTop + GUTTER, Math.min(top, bottom - height - GUTTER));
		cardStyle = `left:${left}px;top:${top}px;width:${width}px;max-height:${viewportHeight - GUTTER * 2}px`;
	}

	$effect(() => {
		void contentKey;
		void target;
		void card;
		void geometryRevision;
		if (tour.phase === 'suspended') {
			return;
		}
		untrack(measure);
	});

	$effect(() => {
		if (!card || typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const observer = new ResizeObserver(() => {
			geometryRevision += 1;
		});
		observer.observe(card);
		return () => observer.disconnect();
	});

	$effect(() => {
		void contentKey;
		targetMissing = false;
		if (tour.phase !== 'guiding' || target) {
			return undefined;
		}
		const timer = setTimeout(() => {
			targetMissing = true;
		}, TARGET_WAIT_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		void contentKey;
		let canceled = false;
		void tick()
			.then(() => {
				if (!canceled) {
					heading?.focus({ preventScroll: true });
				}
				return undefined;
			})
			.catch(() => {});
		return () => {
			canceled = true;
		};
	});

	$effect(() => {
		const element = target;
		if (!element) {
			return undefined;
		}
		element.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		const description = element.getAttribute('aria-describedby');
		const originalTabIndex = element.getAttribute('tabindex');
		element.setAttribute(
			'aria-describedby',
			[description, 'walkthrough-description'].filter(Boolean).join(' ')
		);
		const observer =
			typeof ResizeObserver === 'undefined'
				? undefined
				: new ResizeObserver(() => {
						geometryRevision += 1;
					});
		observer?.observe(element);
		return () => {
			observer?.disconnect();
			if (originalTabIndex === null) {
				element.removeAttribute('tabindex');
			} else {
				element.setAttribute('tabindex', originalTabIndex);
			}
			if (description === null) {
				element.removeAttribute('aria-describedby');
			} else {
				element.setAttribute('aria-describedby', description);
			}
		};
	});

	function focusTarget(): void {
		const focusable =
			'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],select:not(:disabled),[tabindex]:not([disabled])';
		const element = target?.matches(focusable)
			? target
			: target?.querySelector<HTMLElement>(focusable);
		if (element) {
			element.focus();
		} else if (target) {
			target.tabIndex = -1;
			target.focus();
		}
	}

	function retry(): void {
		if (tour.guide) {
			void tour.start(tour.guide, {}, true);
		}
	}

	onMount(() => {
		const previousFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		let animationFrame = 0;
		const resize = () => {
			cancelAnimationFrame(animationFrame);
			animationFrame = requestAnimationFrame(() => {
				geometryRevision += 1;
			});
		};
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !secondaryOpen) {
				event.preventDefault();
				event.stopPropagation();
				tour.skip();
			}
			if (event.key === 'F6') {
				event.preventDefault();
				if (card?.contains(document.activeElement)) {
					focusTarget();
				} else {
					heading?.focus();
				}
			}
		};
		const detectSecondary = () => {
			secondaryOpen = Boolean(
				document.querySelector(
					'.sy-modal--active, .sy-dropdown--active, [data-walkthrough-secondary="true"]'
				)
			);
			if (secondaryOpen) {
				tour.suspend();
			}
		};
		const mutations = new MutationObserver(detectSecondary);
		mutations.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'data-walkthrough-secondary'],
		});
		document.addEventListener('keydown', keydown, true);
		document.addEventListener('transitionend', resize, true);
		window.addEventListener('resize', resize);
		window.addEventListener('scroll', resize, true);
		window.visualViewport?.addEventListener('resize', resize);
		window.visualViewport?.addEventListener('scroll', resize);
		detectSecondary();
		return () => {
			mutations.disconnect();
			cancelAnimationFrame(animationFrame);
			document.removeEventListener('keydown', keydown, true);
			document.removeEventListener('transitionend', resize, true);
			window.removeEventListener('resize', resize);
			window.removeEventListener('scroll', resize, true);
			window.visualViewport?.removeEventListener('resize', resize);
			window.visualViewport?.removeEventListener('scroll', resize);
			if (
				document.activeElement === document.body ||
				card?.contains(document.activeElement)
			) {
				if (previousFocus?.isConnected) {
					previousFocus.focus({ preventScroll: true });
				}
			}
		};
	});
</script>

<div class="walkthrough" use:portal={{ attributes: { 'data-sy-portal-overlay': 'true' } }}>
	{#if tour.phase === 'suspended'}
		<div class="walkthrough__resume" role="region" aria-label="Paused walkthrough">
			<span>Guide paused</span>
			<SyButton size="small" disabled={secondaryOpen} onclick={tour.resume}>Resume</SyButton>
			<SyButton size="small" style="ghost" onclick={tour.skip}>Skip tour</SyButton>
		</div>
	{:else}
		{#if anchor && tour.phase === 'guiding'}
			<div
				class="walkthrough__spotlight"
				style={`left:${anchor.left}px;top:${anchor.top}px;width:${anchor.width}px;height:${anchor.height}px`}
				aria-hidden="true"
			></div>
		{:else}
			<div class="walkthrough__backdrop" aria-hidden="true"></div>
		{/if}
		<div
			class="walkthrough__card"
			role="dialog"
			aria-modal="false"
			aria-labelledby="walkthrough-heading"
			aria-describedby="walkthrough-description"
			bind:this={card}
			style={cardStyle}
		>
			{#if tour.phase === 'invitation'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					You’re ready to explore Syng
				</h2>
				<p id="walkthrough-description">
					Take a quick tour to learn how to look up words, save vocabulary, and practice.
				</p>
				<div class="walkthrough__actions">
					<SyButton style="ghost" onclick={tour.skip}>Skip tour</SyButton><SyButton
						color="blue"
						onclick={() => tour.start('app')}>Show me around</SyButton
					>
				</div>
			{:else if tour.phase === 'choosing'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					{tour.guide ? GUIDE_LABELS[tour.guide] : 'Choose content'}
				</h2>
				<p id="walkthrough-description">
					{tour.preparation.choose === 'document'
						? 'Choose a document to read, or add our example to your library.'
						: `Choose a saved list${tour.guide === 'quiz' ? ' with at least four words' : ''}, or add our example vocabulary.`}
				</p>
				<div class="walkthrough__choices">
					{#each tour.preparation.choices ?? [] as choice (choice.context.documentId ?? choice.context.listName)}
						<SyButton
							style="ghost"
							onclick={() => tour.start(tour.guide, choice.context)}
							>{choice.label}</SyButton
						>
					{/each}
				</div>
				{#if !tour.preparation.choices?.length}<p>
						No suitable {tour.preparation.choose === 'document' ? 'documents' : 'lists'} yet.
					</p>{/if}
			{:else if tour.phase === 'loading'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					Opening your guide
				</h2>
				<p id="walkthrough-description" role="status">Preparing this screen…</p>
			{:else if tour.phase === 'error'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					The guide couldn’t open
				</h2>
				<p id="walkthrough-description">You can retry or continue exploring Syng.</p>
			{:else if tour.step}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					{tour.step.title}
				</h2>
				<p id="walkthrough-description">{tour.step.body}</p>
				<p class="walkthrough__progress" aria-live="polite" aria-atomic="true">
					{tour.stepIndex + 1} of {tour.stepCount}
				</p>
				{#if target}<button class="walkthrough__focus" onclick={focusTarget}
						>Focus highlighted control</button
					>{/if}
				{#if targetMissing}<p role="status">
						This control isn’t available right now. You can continue or retry.
					</p>
					<SyButton style="ghost" onclick={retry}>Retry</SyButton>{/if}
			{/if}
			{#if exampleKind && (tour.phase === 'choosing' || tour.phase === 'guiding')}
				<div class="walkthrough__example">
					<SyButton
						size="small"
						disabled={tour.exampleBusy}
						onclick={() => tour.addExample(exampleKind)}
						>{tour.exampleBusy
							? 'Adding example…'
							: `${existingExample ? 'Use' : 'Add'} example ${exampleKind === 'document' ? 'document' : 'vocabulary'}`}</SyButton
					>
					{#if existingExample && tour.phase === 'choosing'}<SyButton
							size="small"
							style="ghost"
							disabled={tour.exampleBusy}
							onclick={() => tour.addExample(exampleKind, true)}
							>Add a fresh example</SyButton
						>{/if}
					<p>
						Added examples stay in your {exampleKind === 'document'
							? 'library'
							: 'lists'}. You can edit or delete them normally.
					</p>
				</div>
			{/if}
			{#if tour.error}<p role="alert">{tour.error}</p>{/if}
			{#if tour.phase !== 'invitation'}
				<div class="walkthrough__actions">
					<SyButton style="ghost" onclick={tour.skip}>Skip tour</SyButton>
					{#if tour.phase === 'guiding'}
						{#if tour.stepIndex > 0}<SyButton style="ghost" onclick={tour.back}
								>Back</SyButton
							>{/if}
						<SyButton color="blue" onclick={tour.next}
							>{tour.stepIndex === tour.stepCount - 1
								? 'Finish tour'
								: 'Next'}</SyButton
						>
					{:else if tour.phase === 'error'}<SyButton color="blue" onclick={retry}
							>Retry</SyButton
						>{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.walkthrough {
		font-family: var(--sy-font-family);
		color: var(--sy-color--black);
	}
	.walkthrough__spotlight,
	.walkthrough__backdrop {
		position: fixed;
		pointer-events: none;
		z-index: var(--sy-z-index--top-1);
	}
	.walkthrough__backdrop {
		inset: 0;
		background: rgba(0, 0, 0, 0.26);
	}
	.walkthrough__spotlight {
		box-sizing: border-box;
		border: 2px solid var(--sy-color--blue-2);
		border-radius: calc(var(--sy-border-radius) * 2);
		box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.26);
	}
	.walkthrough__card,
	.walkthrough__resume {
		position: fixed;
		box-sizing: border-box;
		z-index: var(--sy-z-index--top);
		padding: var(--sy-space--extra-large);
		background: var(--sy-color--white);
		border-radius: calc(var(--sy-border-radius) * 2);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
	}
	.walkthrough__card {
		--walkthrough-safe-top: env(safe-area-inset-top, 0px);
		--walkthrough-safe-bottom: env(safe-area-inset-bottom, 0px);
		--walkthrough-safe-left: env(safe-area-inset-left, 0px);
		--walkthrough-safe-right: env(safe-area-inset-right, 0px);
		overflow-y: auto;
		overscroll-behavior: contain;
		line-height: 1.5;
	}
	.walkthrough__resume {
		right: max(16px, env(safe-area-inset-right));
		bottom: max(16px, env(safe-area-inset-bottom));
		max-width: calc(100vw - 32px);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
	}
	h2 {
		font-size: var(--sy-font-size--large);
		line-height: 1.35;
		margin: 0 0 12px;
		text-wrap: balance;
	}
	p {
		font-size: 0.875rem;
		margin: 0 0 12px;
	}
	.walkthrough__progress {
		font-variant-numeric: tabular-nums;
		margin-top: 16px;
	}
	.walkthrough__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 16px;
	}
	.walkthrough__actions :global(button:first-child) {
		margin-right: auto;
	}
	.walkthrough :global(button) {
		min-height: 44px;
	}
	.walkthrough :global(button:focus-visible),
	h2:focus-visible {
		outline: 2px solid var(--sy-color--blue-2);
		outline-offset: 3px;
	}
	h2:focus:not(:focus-visible) {
		outline: none;
	}
	.walkthrough__focus {
		background: none;
		border: 0;
		padding: 0;
		color: var(--sy-color--black);
		font: inherit;
		font-size: 0.75rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.walkthrough__example {
		margin-top: 12px;
		padding-top: 12px;
		border-top: var(--sy-border);
	}
	.walkthrough__example p {
		font-size: 0.75rem;
		margin: 8px 0 0;
	}
	.walkthrough__choices {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	@media (prefers-reduced-motion: reduce) {
		.walkthrough :global(*) {
			transition: none !important;
			animation: none !important;
			scroll-behavior: auto !important;
		}
	}
</style>
