<script lang="ts">
	/**
	 * Owns entry/breakdown navigation, responsive presentation, focus, and history.
	 * DictionaryEntry renders the reusable entry body; it does not own this stack.
	 */
	import { onMount, tick, untrack } from 'svelte';
	import DictionaryEntry from '@/components/DictionaryContent/DictionaryEntry.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { lookupDictionary } from '@/utils/dictionaryLookup.js';
	import { lexicalDisplayId } from '@/types/dictionary.js';
	import { isMobile, isMobileLayout } from '@/utils/device.js';
	import { subscribeSystemTypography } from '@/composables/systemTypography.js';
	import { swipeBack } from '@/actions/swipeBack.svelte.js';
	import { breakdownHistory } from '@/composables/breakdownHistory.js';
	import { mobileBreakdown } from '@/stores/mobileBreakdown.js';
	import { createBreakdownTelemetry, breakdownSource } from '@/composables/breakdownTelemetry.js';
	import type { BreakdownCloseReason } from '@/types/telemetry.js';
	import {
		normalizeDictionaryLookupRequest,
		type DictionaryLookupRequest,
	} from '@/composables/dictionaryPopover.svelte.js';
	import type { SearchEntry } from '@/types/search.js';
	import type { BreakdownSelection } from '@/types/characterBreakdown.js';
	const {
		word,
		context = 'page',
		initialSelection,
		onviewchange,
		onexit,
		onclose,
		...entryProps
	}: {
		word?: SearchEntry;
		/**
		 * page: companion pane or mobile route; popup: compact replacement views;
		 * screen: routed mobile breakdown with an existing route Back step.
		 */
		context?: 'page' | 'popup' | 'screen';
		initialSelection?: BreakdownSelection;
		onviewchange?: (active: boolean) => void;
		onexit?: () => void;
		onclose?: () => void;
		[key: string]: any;
	} = $props();
	/**
	 * One local entry or breakdown view. Keeping covered views mounted preserves
	 * character selection; saved focus/scroll restore the caller on Back.
	 * This is UI navigation state, separate from dictionary data and browser history.
	 */
	type DictionaryNavigationView = {
		id: number;
		kind: 'breakdown' | 'entry';
		word: SearchEntry;
		selection: BreakdownSelection;
		results?: SearchEntry[];
		resultIndex?: number;
		focus?: HTMLElement;
		scroll?: { node: HTMLElement; top: number }[];
	};
	let retained = $state<DictionaryNavigationView[]>([]);
	let frames = $state<DictionaryNavigationView[]>([]),
		wide = $state(false);
	let host: HTMLElement, entry: ReturnType<typeof DictionaryEntry>;
	let Panel =
		$state<
			typeof import('@/components/CharacterBreakdown/CharacterBreakdown.svelte').default
		>();
	let panelFailed = $state(false);
	let previousId: string | undefined,
		serial = 0;
	let nestedRequest = 0;
	let history = $state<ReturnType<typeof breakdownHistory>>();
	const mobile = isMobileLayout();
	const COMPANION_MIN_REM = 38.75,
		DEFAULT_ROOT_FONT_SIZE = 16;
	const companion = $derived(context === 'page' && !mobile && wide);
	const popupLookups = $derived(companion || context === 'screen');
	const replaced = $derived(frames.length > 0 && !companion);
	const breakdownTelemetry = createBreakdownTelemetry();
	let closeReason: BreakdownCloseReason = 'navigation';
	function selection(): BreakdownSelection {
		return {
			script:
				dictionaryDisplaySettingsStore.settings.characterSet === 'traditional'
					? 'traditional'
					: 'simplified',
			index: 0,
			pinned: null,
		};
	}
	async function loadPanel() {
		if (Panel || panelFailed) {
			return;
		}
		try {
			Panel = (await import('@/components/CharacterBreakdown/CharacterBreakdown.svelte'))
				.default;
		} catch {
			panelFailed = true;
		}
	}
	function breakdownView(target: SearchEntry, chosen = selection()): DictionaryNavigationView {
		return {
			id: ++serial,
			kind: 'breakdown',
			word: target,
			selection: chosen,
			focus: document.activeElement as HTMLElement,
		};
	}
	function push(next: DictionaryNavigationView) {
		if (next.kind === 'breakdown' && frames.length) {
			breakdownTelemetry.interact({ action: 'nested_breakdown_opened' });
		}
		next.scroll = [
			...host.querySelectorAll<HTMLElement>('.dictionary-content-container, .body'),
		]
			.filter((node) => node.getClientRects().length > 0)
			.map((node) => ({ node, top: node.scrollTop }));
		frames = [...frames, next];
		void focusNavigationView(next);
	}
	async function focusNavigationView(next: DictionaryNavigationView) {
		if (next.kind === 'breakdown') {
			await loadPanel();
		}
		await tick();
		if (host?.isConnected && frames[frames.length - 1]?.id === next.id) {
			host.querySelector<HTMLElement>('.frame:last-child button')?.focus();
		}
	}

	function trim(depth: number) {
		const previous = frames[depth];
		frames = frames.slice(0, depth);
		void tick().then(() => {
			previous?.focus?.focus({ preventScroll: true });
			previous?.scroll?.forEach(({ node, top }) => {
				node.scrollTop = top;
			});
			return undefined;
		});
	}
	export function back() {
		if (frames.length === 1) {
			closeReason = 'back';
		}
		if (context === 'screen' && frames.length === 1) {
			breakdownTelemetry.close('back');
			onexit?.();
			return;
		}
		if (!companion && history?.back()) {
			return;
		} else {
			trim(Math.max(0, frames.length - 1));
		}
	}
	function dismissPanel() {
		closeReason = 'dismissed';
		trim(0);
	}
	function closePopup() {
		breakdownTelemetry.close('dismissed');
		onclose?.();
	}
	function toggle() {
		if (frames.length) {
			if (companion) {
				dismissPanel();
			} else {
				back();
			}
			return;
		}
		if (mobile && context === 'page') {
			Object.assign(mobileBreakdown, {
				word,
				selection: selection(),
				scroll: entry?.scrollPosition(),
				lists: entryProps.lists ?? [],
				origin: window.location.hash,
			});
			window.location.hash = '#/breakdown';
			return;
		}
		push(breakdownView(word, retained[0]?.word === word ? retained[0].selection : selection()));
	}
	async function nested(request: DictionaryLookupRequest) {
		const requestId = ++nestedRequest;
		const currentView = frames[frames.length - 1];
		const lookup = normalizeDictionaryLookupRequest(request);
		if (popupLookups) {
			entryProps.onlink?.(lookup);
			return;
		}
		const { results: rows, resultIndex } = await lookupDictionary(lookup).catch(() => ({
			results: [],
			resultIndex: 0,
		}));
		if (
			rows.length &&
			requestId === nestedRequest &&
			currentView === frames[frames.length - 1]
		) {
			if (popupLookups) {
				entryProps.onlink?.(lookup);
			} else {
				componentLookup(lookup.text, rows, lookup.anchor, resultIndex);
			}
		}
	}
	function componentLookup(
		character: string,
		rows: SearchEntry[],
		anchor: DOMRect,
		resultIndex = 0
	) {
		if (popupLookups) {
			entryProps.onlink?.({ text: character, exactOnly: true, anchor });
			return;
		}
		push({
			id: ++serial,
			kind: 'entry',
			word: rows[resultIndex],
			results: rows,
			resultIndex,
			selection: selection(),
			focus: document.activeElement as HTMLElement,
		});
	}
	$effect(() => {
		const id = word ? String(lexicalDisplayId(word)) : undefined;
		if (id === previousId) {
			return;
		}
		previousId = id;
		const target = word;
		untrack(() => {
			if (context === 'screen' && target) {
				frames = [breakdownView(target, initialSelection ?? selection())];
				void focusNavigationView(frames[0]);
			} else if (companion && frames.length && target) {
				breakdownTelemetry.interact({ action: 'entry_changed' });
				frames = [breakdownView(target)];
			} else {
				frames = [];
			}
		});
	});
	$effect(() => {
		const current = frames.filter((item) => item.kind === 'breakdown').pop();
		if (current) {
			breakdownTelemetry.open({
				surface:
					context === 'screen'
						? 'mobile_screen'
						: context === 'popup'
							? 'popup'
							: companion
								? 'sidebar'
								: 'entry',
				source: breakdownSource(
					context === 'screen' ? (mobileBreakdown.origin ?? '') : window.location.hash
				),
				character_count: [...current.word[current.selection.script]].length,
			});
		} else {
			breakdownTelemetry.close(closeReason);
			closeReason = 'navigation';
		}
	});

	$effect(() => {
		history?.sync(companion ? 0 : Math.max(0, frames.length - (context === 'screen' ? 1 : 0)));
	});

	$effect(() => {
		onviewchange?.(replaced);
	});
	$effect(() => {
		if (frames.length) {
			retained = frames;
		}
	});
	onMount(() => {
		const measure = () => {
			wide =
				host.getBoundingClientRect().width >=
				COMPANION_MIN_REM *
					(parseFloat(getComputedStyle(document.documentElement).fontSize) ||
						DEFAULT_ROOT_FONT_SIZE);
		};
		const observer =
			typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
		observer?.observe(host);
		measure();
		const unsubscribe = subscribeSystemTypography(measure);
		window.addEventListener('resize', measure);
		// A popup rendered in SySnapSheet navigates within the sheet. Other mobile
		// replacement views keep their browser/system Back history.
		if (isMobile() && !(mobile && context === 'popup')) {
			history = breakdownHistory((depth) => {
				if (depth === 0 && context !== 'screen') {
					closeReason = 'back';
				}
				trim(depth + (context === 'screen' ? 1 : 0));
			});
		}
		// A mobile route remounts the originating page; restore its dictionary's own scroll.
		if (
			mobile &&
			context === 'page' &&
			mobileBreakdown.origin === window.location.hash &&
			mobileBreakdown.word &&
			word &&
			lexicalDisplayId(mobileBreakdown.word) === lexicalDisplayId(word)
		) {
			void tick().then(() => {
				entry?.scrollPosition(mobileBreakdown.scroll);
				host.querySelector<HTMLButtonElement>(
					'button[aria-label="Character Breakdown"]'
				)?.focus({ preventScroll: true });
				mobileBreakdown.origin = undefined;
				return undefined;
			});
		}
		return () => {
			breakdownTelemetry.close('navigation');
			observer?.disconnect();
			unsubscribe();
			window.removeEventListener('resize', measure);
			history?.destroy();
		};
	});
</script>

<div class="dictionary-layout" class:companion class:open={frames.length > 0} bind:this={host}>
	<div class="root-entry" hidden={replaced || context === 'screen'}>
		<DictionaryEntry
			bind:this={entry}
			{word}
			{...entryProps}
			onbreakdown={toggle}
			breakdownOpen={frames.length > 0}
		/>
	</div>
	<div class="breakdown-host" inert={frames.length === 0} aria-hidden={frames.length === 0}>
		<div class="breakdown-inner">
			{#each retained as item, i (item.id)}
				<div
					class="frame"
					hidden={i !== retained.length - 1}
					use:swipeBack={{ enabled: isMobile() && !companion, onBack: back }}
				>
					{#if item.kind === 'breakdown'}
						{#if Panel}<Panel
								word={item.word}
								selection={item.selection}
								onselection={(value) => (item.selection = value)}
								{companion}
								onback={companion ? dismissPanel : back}
								onclose={context === 'popup' ? closePopup : undefined}
								oninteraction={breakdownTelemetry.interact}
								onlookup={componentLookup}
								onlink={nested}
							/>
						{:else}<SyButton onclick={back}>Back</SyButton>
							<p role="status">
								{panelFailed
									? 'Character breakdown could not be loaded.'
									: 'Loading character breakdown…'}
							</p>
						{/if}
					{:else}
						<div class="nested-header">
							<SyButton style="ghost" center onclick={back}
								><ChevronLeft size="18" /><span>Back</span></SyButton
							>
							{#if item.results.length > 1}
								<SyButton
									style="ghost"
									center
									aria-label="Previous dictionary result"
									disabled={item.resultIndex === 0}
									onclick={() => {
										item.resultIndex--;
										item.word = item.results[item.resultIndex];
									}}><ChevronLeft size="18" /></SyButton
								>
								<span>{item.resultIndex + 1} of {item.results.length}</span>
								<SyButton
									style="ghost"
									center
									aria-label="Next dictionary result"
									disabled={item.resultIndex === item.results.length - 1}
									onclick={() => {
										item.resultIndex++;
										item.word = item.results[item.resultIndex];
									}}><ChevronRight size="18" /></SyButton
								>
							{/if}
							{#if context === 'popup'}<div class="nested-close">
									<SyButton
										style="ghost"
										size="small"
										aria-label="Close dictionary"
										onclick={closePopup}><X size="16" /></SyButton
									>
								</div>{/if}
						</div>
						<DictionaryEntry
							{...entryProps}
							word={item.word}
							onlink={nested}
							onbreakdown={() => push(breakdownView(item.word))}
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.dictionary-layout {
		display: flex;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
	.root-entry {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	[hidden] {
		display: none !important;
	}
	.breakdown-host {
		min-width: 0;
		min-height: 0;
		width: 0;
		overflow: hidden;
	}
	.open .breakdown-host {
		width: 100%;
	}
	.breakdown-inner {
		height: 100%;
	}
	.frame {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--sy-color--white);
	}
	.companion .breakdown-host {
		flex: none;
		transition: width 0.22s ease;
	}
	.companion.open .breakdown-host {
		width: 18.75rem;
		transition: width 0.22s ease;
	}
	.companion .breakdown-inner {
		width: 18.75rem;
		height: 100%;
		border-left: var(--sy-border);
		box-sizing: border-box;
	}
	.nested-close {
		display: flex;
		align-items: center;
		margin-left: auto;
	}
	.nested-header {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.4rem 0.6rem;
		border-bottom: var(--sy-border);
		flex-shrink: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.companion .breakdown-host,
		.companion.open .breakdown-host {
			transition: none;
		}
	}
</style>
