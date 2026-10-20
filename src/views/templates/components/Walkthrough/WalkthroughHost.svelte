<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { BookOpen, Check, List, Plus } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { searchStore } from '@/composables/search.svelte.js';
	import { portal } from '@/actions/portal.svelte.js';
	import { walkthroughStore as tour } from '@/stores/walkthrough.svelte.js';
	import {
		GUIDE_LABELS,
		hasSuitableContent,
		SAMPLE_TITLE,
		SAMPLE_WORD_COUNT,
	} from '@/components/Walkthrough/walkthroughContent.js';
	const GUTTER = 16;
	const TARGET_PADDING = 6;
	const POPUP_PADDING = 10;
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
	const explainingLinks = $derived(tour.guide === 'dictionary' && tour.step?.id === 'links');
	const explainingPopup = $derived(explainingLinks && Boolean(searchStore.popoverWord));
	const target = $derived.by(() => {
		void geometryRevision;
		return tour.phase === 'guiding'
			? explainingPopup
				? tour.target('dictionary-popup')
				: (tour.target(tour.step?.target) ?? tour.target(tour.step?.fallbackTarget))
			: undefined;
	});
	const exampleKind = $derived(tour.preparation.choose ?? tour.step?.example);
	let needsExample = $state(false);
	const contentKey = $derived(`${tour.phase}:${tour.guide}:${tour.step?.id ?? ''}`);

	$effect(() => {
		void contentKey;
		const view = explainingPopup ? 'dictionary-popup' : 'instructions';
		untrack(() => tour.markStepPresented(view));
	});

	async function addExample(kind: 'document' | 'list'): Promise<void> {
		const focusedControl = document.activeElement;
		await tour.addExample(kind);
		await tick();
		if (
			tour.exampleAdded &&
			focusedControl &&
			!focusedControl.isConnected &&
			document.activeElement === document.body
		) {
			heading?.focus({ preventScroll: true });
		}
	}

	$effect(() => {
		if (explainingLinks) {
			return () => searchStore.closePopoverDictionary();
		}
		return undefined;
	});

	$effect(() => {
		void contentKey;
		void tour.preparation;
		needsExample = false;
		if (!exampleKind) {
			return undefined;
		}
		if (tour.phase === 'choosing') {
			needsExample = !tour.preparation.choices?.length;
			return undefined;
		}
		if (tour.phase !== 'guiding') {
			return undefined;
		}
		let canceled = false;
		void hasSuitableContent(exampleKind)
			.then((available) => {
				if (!canceled) {
					needsExample = !available;
				}
				return undefined;
			})
			.catch(() => {});
		return () => {
			canceled = true;
		};
	});

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
			// Include the popup arrow and the mobile sheet's header/handle, even at viewport edges.
			const padding = explainingPopup ? POPUP_PADDING : TARGET_PADDING;
			const edgeInset = explainingPopup ? 0 : GUTTER / 2;
			const left = Math.max(viewportLeft + edgeInset, measured.left - padding);
			const top = Math.max(viewportTop + edgeInset, measured.top - padding);
			anchor = {
				left,
				top,
				width: Math.max(0, Math.min(right - edgeInset, measured.right + padding) - left),
				height: Math.max(0, Math.min(bottom - edgeInset, measured.bottom + padding) - top),
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
		if (!explainingPopup) {
			element.scrollIntoView?.({
				block: explainingLinks ? 'center' : 'nearest',
				inline: 'nearest',
				behavior: 'instant',
			});
		}
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
			void tour.start(tour.guide, {}, true, 'retry');
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
			if (event.key === 'Escape' && explainingPopup && !secondaryOpen) {
				event.preventDefault();
				event.stopPropagation();
				searchStore.closePopoverDictionary();
				return;
			}
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
			secondaryOpen = Array.from(
				document.querySelectorAll(
					'.sy-modal--active, .sy-dropdown--active, [data-walkthrough-secondary="true"]'
				)
			).some(
				(element) =>
					!(
						explainingLinks &&
						element.getAttribute('data-walkthrough-secondary') === 'true' &&
						element.closest('[data-walkthrough-target="dictionary-popup"]')
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
		document.addEventListener('animationend', resize, true);
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
			document.removeEventListener('animationend', resize, true);
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
		<svg class="walkthrough__shade" width="100%" height="100%" aria-hidden="true">
			<defs>
				<mask
					id="walkthrough-mask"
					maskUnits="userSpaceOnUse"
					x="0"
					y="0"
					width="100%"
					height="100%"
				>
					<rect width="100%" height="100%" fill="white" />
					{#if anchor && tour.phase === 'guiding'}
						<rect
							x={anchor.left}
							y={anchor.top}
							width={anchor.width}
							height={anchor.height}
							rx="8"
							fill="black"
						/>
					{/if}
				</mask>
			</defs>
			<rect
				width="100%"
				height="100%"
				fill="rgba(0, 0, 0, 0.26)"
				mask="url(#walkthrough-mask)"
			/>
		</svg>
		{#if anchor && tour.phase === 'guiding'}
			<div
				class="walkthrough__spotlight"
				style={`left:${anchor.left}px;top:${anchor.top}px;width:${anchor.width}px;height:${anchor.height}px`}
				aria-hidden="true"
			></div>
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
			{:else if tour.phase === 'feature-invitation'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					{tour.guide === 'quiz'
						? 'Try a quick quiz tour?'
						: tour.guide === 'flashcards'
							? 'Try a quick flashcards tour?'
							: 'Try a quick reading tour?'}
				</h2>
				<p id="walkthrough-description">
					{tour.guide === 'quiz'
						? 'Learn how questions, answers, and the timer work. Your quiz timer is paused while this invitation or the guide is open.'
						: tour.guide === 'flashcards'
							? 'Learn how to flip cards and move through your list.'
							: 'Learn how to look up words, turn pages, and adjust your reading view.'}
					You can skip at any time or replay from Settings → Walkthrough.
				</p>
				<div class="walkthrough__actions">
					<SyButton style="ghost" onclick={tour.skip}>Not now</SyButton>
					<SyButton
						color="blue"
						onclick={() => tour.start(tour.guide, tour.preparation.context)}
						>Start tour</SyButton
					>
				</div>
			{:else if tour.phase === 'choosing'}
				<h2 id="walkthrough-heading" tabindex="-1" bind:this={heading}>
					{tour.guide ? GUIDE_LABELS[tour.guide] : 'Choose content'}
				</h2>
				<p id="walkthrough-description">
					{tour.preparation.choose === 'document'
						? 'Choose a document to read.'
						: `Choose a saved list${tour.guide === 'quiz' ? ' with at least four words' : ''}.`}
				</p>
				<div class="walkthrough__choices">
					{#each tour.preparation.choices ?? [] as choice (choice.context.documentId ?? choice.context.listName)}
						<SyButton
							style="ghost"
							onclick={() => tour.start(tour.guide, choice.context, false, 'choice')}
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
					{explainingPopup ? 'Explore the popup dictionary' : tour.step.title}
				</h2>
				<p id="walkthrough-description">
					{explainingPopup
						? 'Read the meaning here and use + to save the word. Close the popup to try another blue link, or choose Next to continue the tour.'
						: tour.step.body}
				</p>
				{#if targetMissing}<p role="status">
						This control isn’t available right now. You can continue or retry.
					</p>
					<SyButton style="ghost" onclick={retry}>Retry</SyButton>{/if}
			{/if}
			{#if exampleKind && needsExample}
				<div class="walkthrough__example">
					<div class="walkthrough__example-icon">
						{#if exampleKind === 'document'}
							<BookOpen size="18" aria-hidden="true" />
						{:else}
							<List size="18" aria-hidden="true" />
						{/if}
					</div>
					<div class="walkthrough__example-details">
						<span class="walkthrough__example-title">{SAMPLE_TITLE}</span>
						<p id="walkthrough-sample-description">
							{exampleKind === 'document'
								? 'Sample story · easy → advanced'
								: `${SAMPLE_WORD_COUNT} words · HSK 1–9`}
						</p>
					</div>
					<SyButton
						aria-label={exampleKind === 'document'
							? 'Add sample document'
							: 'Add sample words'}
						aria-describedby="walkthrough-sample-description"
						disabled={tour.exampleBusy}
						onclick={() => addExample(exampleKind)}
					>
						<span class="walkthrough__example-button">
							<Plus size="14" aria-hidden="true" />
							{tour.exampleBusy ? 'Adding…' : 'Add'}
						</span>
					</SyButton>
				</div>
			{/if}
			<div class:walkthrough__example-notice={tour.exampleAdded} role="status">
				{#if tour.exampleAdded}
					<Check size="16" aria-hidden="true" />
					<span>
						{tour.exampleAdded === 'document'
							? 'Added to your Reader library.'
							: 'Added to your vocabulary lists.'}
					</span>
				{/if}
			</div>
			{#if tour.error}<p role="alert">{tour.error}</p>{/if}
			{#if tour.phase === 'guiding'}
				<div class="walkthrough__navigation">
					<SyButton
						style="ghost"
						size="large"
						disabled={tour.stepIndex === 0}
						onclick={tour.back}>Back</SyButton
					>
					<span class="walkthrough__progress" aria-live="polite" aria-atomic="true">
						{tour.stepIndex + 1} of {tour.stepCount}
					</span>
					<SyButton
						color="blue"
						size="large"
						aria-label={tour.stepIndex === tour.stepCount - 1 ? 'Finish tour' : 'Next'}
						onclick={tour.next}
						>{tour.stepIndex === tour.stepCount - 1 ? 'Finish' : 'Next'}</SyButton
					>
				</div>
				<div class="walkthrough__skip">
					<SyButton style="ghost" size="small" onclick={tour.skip}>Skip tour</SyButton>
				</div>
			{:else if tour.phase !== 'invitation' && tour.phase !== 'feature-invitation'}
				<div class="walkthrough__actions">
					<SyButton style="ghost" size="small" onclick={tour.skip}>Skip tour</SyButton>
					{#if tour.phase === 'error'}<SyButton color="blue" onclick={retry}
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
	.walkthrough__shade {
		position: fixed;
		pointer-events: none;
		z-index: var(--sy-z-index--top-1);
	}
	.walkthrough__shade {
		inset: 0;
	}
	.walkthrough__spotlight {
		box-sizing: border-box;
		border: 2px solid var(--sy-color--blue-2);
		border-radius: calc(var(--sy-border-radius) * 2);
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
		color: var(--sy-color--grey-5);
		font-size: var(--sy-font-size--small);
		font-variant-numeric: tabular-nums;
		text-align: center;
		white-space: nowrap;
	}
	.walkthrough__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 16px;
	}
	.walkthrough__actions :global(button) {
		flex-shrink: 0;
	}
	.walkthrough__actions :global(button:first-child) {
		margin-right: auto;
	}
	.walkthrough__navigation {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: var(--sy-space);
		margin-top: var(--sy-space--extra-large);
	}
	.walkthrough__navigation :global(button:first-child) {
		justify-self: start;
	}
	.walkthrough__navigation :global(button:last-child) {
		justify-self: end;
	}
	.walkthrough__skip {
		margin-top: var(--sy-space);
		text-align: center;
	}
	.walkthrough :global(button:focus-visible),
	h2:focus-visible {
		outline: 2px solid var(--sy-color--blue-2);
		outline-offset: 3px;
	}
	h2:focus:not(:focus-visible) {
		outline: none;
	}
	.walkthrough__example {
		margin-top: 12px;
		padding-top: 12px;
		border-top: var(--sy-border);
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--sy-space--large);
	}
	.walkthrough__example-icon {
		display: flex;
		color: var(--sy-text--muted);
	}
	.walkthrough__example-details {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.walkthrough__example-title {
		font-size: 0.8125rem;
		font-weight: var(--sy-font-weight--bold);
	}
	.walkthrough__example-button {
		display: inline-flex;
		align-items: center;
		gap: var(--sy-space);
	}
	.walkthrough__example :global(button) {
		margin: 0;
	}
	.walkthrough__example p {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		margin: var(--sy-space--small) 0 0;
	}
	.walkthrough__example-notice {
		display: flex;
		align-items: center;
		gap: var(--sy-space);
		font-size: var(--sy-font-size--small);
		margin-top: 12px;
	}
	.walkthrough__example-notice :global(svg) {
		flex-shrink: 0;
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
