<script lang="ts">
	import { ChevronLeft, ChevronRight, Search, X } from 'lucide-svelte';
	import BreakdownText from '@/components/CharacterBreakdown/BreakdownText.svelte';
	import type { DictionaryLookupRequest } from '@/composables/dictionaryPopover.svelte.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import {
		loadBreakdown,
		loadBreakdownGeometry,
		lookupCharacter,
		nearestComponent,
	} from '@/utils/characterBreakdown.js';
	import {
		COMPONENT_ROLES,
		type BreakdownSelection,
		type CharacterBreakdownRecord,
		type CharacterGeometry,
	} from '@/types/characterBreakdown.js';
	import type { BreakdownInteraction } from '@/types/telemetry.js';
	import type { SearchEntry } from '@/types/search.js';
	import { handleError } from '@/utils/index.js';
	interface Props {
		word: SearchEntry;
		selection: BreakdownSelection;
		onselection: (value: BreakdownSelection) => void;
		oninteraction?: (detail: BreakdownInteraction) => void;
		companion?: boolean;
		onclose?: () => void;
		onback: () => void;
		onlink: (request: DictionaryLookupRequest) => void;
		onlookup: (character: string, entries: SearchEntry[], anchor: DOMRect) => void;
	}
	const {
		word,
		selection,
		onselection,
		oninteraction,
		companion = false,
		onback,
		onclose,
		onlookup,
		onlink,
	}: Props = $props();
	const GLYPH_SIZE = 1024,
		GLYPH_BASELINE = 900;
	let record = $state<CharacterBreakdownRecord | null>(null);
	let geometry = $state<CharacterGeometry | null>(null);
	let entries = $state<Record<string, SearchEntry[]>>({});
	let loading = $state(true),
		failed = $state(false),
		hover = $state<number | null>(null);
	const characters = $derived([...word[selection.script]]);
	const character = $derived(characters[selection.index] ?? characters[0]);
	const active = $derived(hover ?? selection.pinned);
	$effect(() => {
		const requested = character;
		let cancelled = false;
		record = null;
		geometry = null;
		entries = {};
		loading = true;
		failed = false;
		hover = null;
		async function load() {
			try {
				const found = await loadBreakdown(requested);
				if (cancelled) {
					return;
				}
				record = found;
				loading = false;
				if (!found) {
					return;
				}
				void loadBreakdownGeometry(found)
					.then((value) => {
						if (!cancelled) {
							geometry = value;
						}
						return undefined;
					})
					.catch((error) => {
						if (!cancelled) {
							handleError(
								`Could not load breakdown graphics for ${requested}.`,
								error,
								{
									silent: true,
									telemetryMessage: 'Could not load breakdown graphics.',
									privateValues: [requested, encodeURIComponent(requested)],
								}
							);
						}
					});
				const glyphs = [
					...new Set(
						[found.radical, ...found.components.map((p) => p.character)].filter(Boolean)
					),
				];
				await Promise.all(
					glyphs.map(async (glyph) => {
						const rows = await lookupCharacter(glyph).catch(() => []);
						if (!cancelled) {
							entries = { ...entries, [glyph]: rows };
						}
					})
				);
			} catch (error) {
				if (!cancelled) {
					handleError(`Could not load breakdown data for ${requested}.`, error, {
						silent: true,
						telemetryMessage: 'Could not load breakdown data.',
						privateValues: [requested],
					});
					failed = true;
					loading = false;
				}
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	});
	function interact(
		action: BreakdownInteraction['action'],
		component?: number,
		input?: BreakdownInteraction['input']
	) {
		oninteraction?.({
			action,
			character_position: selection.index + 1,
			script: selection.script,
			...(component !== undefined ? { component_position: component + 1 } : {}),
			...(input ? { input } : {}),
		});
	}
	function preview(index: number | null, input: BreakdownInteraction['input']) {
		hover = index;
		if (index !== null) {
			interact('component_previewed', index, input);
		}
	}
	function descriptionLookup(request: DictionaryLookupRequest) {
		interact('description_lookup');
		onlink(request);
	}
	function select(index: number) {
		oninteraction?.({
			action: 'character_changed',
			character_position: index + 1,
			script: selection.script,
		});
		onselection({ ...selection, index, pinned: null });
		hover = null;
	}
	function pin(index: number, input: BreakdownInteraction['input'] = 'control') {
		interact(
			selection.pinned === index ? 'component_deselected' : 'component_selected',
			index,
			input
		);
		onselection({ ...selection, pinned: selection.pinned === index ? null : index });
	}
	function move(event: PointerEvent | MouseEvent) {
		if (!record || !geometry) {
			return;
		}
		const rect =
			event.currentTarget instanceof Element
				? event.currentTarget.getBoundingClientRect()
				: null;
		if (!rect) {
			return;
		}
		const closest = nearestComponent(
			record,
			geometry,
			((event.clientX - rect.left) / rect.width) * GLYPH_SIZE,
			GLYPH_BASELINE - ((event.clientY - rect.top) / rect.height) * GLYPH_SIZE,
			hover
		);
		preview(closest, 'glyph');
	}
	function lookupCurrentCharacter(event: MouseEvent) {
		interact('character_lookup');
		onlink({
			text: character,
			exactOnly: true,
			anchor: (event.currentTarget as HTMLElement).getBoundingClientRect(),
		});
	}

	function lookup(
		glyph: string,
		event: MouseEvent,
		action: 'component_lookup' | 'radical_lookup' = 'component_lookup',
		component?: number
	) {
		interact(action, component);
		onlookup(
			glyph,
			entries[glyph],
			(event.currentTarget as HTMLElement).getBoundingClientRect()
		);
	}
</script>

<section class="breakdown" aria-label="Character Breakdown">
	<header>
		{#if !companion}<SyButton
				style="ghost"
				center
				onclick={onback}
				aria-label="Back to dictionary"><ChevronLeft size="18" /><span>Back</span></SyButton
			>{/if}
		{#if onclose}<SyButton
				style="ghost"
				size="small"
				aria-label="Close dictionary"
				onclick={onclose}><X size="16" /></SyButton
			>{:else}<h2>Character Breakdown</h2>{/if}
		{#if companion}<SyButton
				style="ghost"
				onclick={onback}
				aria-label="Close character breakdown"><X size="18" /></SyButton
			>{/if}
	</header>
	<div class="body">
		{#if characters.length > 1}
			<div class="character-nav">
				<SyButton
					style="ghost"
					aria-label="Previous character"
					disabled={selection.index <= 0}
					onclick={() => select(selection.index - 1)}><ChevronLeft size="18" /></SyButton
				>
				<span aria-live="polite"
					>{character} <small>{selection.index + 1} of {characters.length}</small></span
				>
				<SyButton
					style="ghost"
					aria-label="Next character"
					disabled={selection.index >= characters.length - 1}
					onclick={() => select(selection.index + 1)}><ChevronRight size="18" /></SyButton
				>
			</div>
		{/if}
		{#if word.simplified !== word.traditional}
			<div class="scripts" role="group" aria-label="Character form">
				{#each ['simplified', 'traditional'] as script (script)}
					<button
						type="button"
						aria-pressed={selection.script === script}
						onclick={() => {
							if (script !== selection.script) {
								oninteraction?.({
									action: 'script_changed',
									script: script as BreakdownSelection['script'],
									character_position: Math.min(
										selection.index + 1,
										[...word[script]].length
									),
								});
							}
							onselection({
								script: script as BreakdownSelection['script'],
								index: Math.min(selection.index, [...word[script]].length - 1),
								pinned: null,
							});
						}}>{script === 'simplified' ? 'Simplified' : 'Traditional'}</button
					>
				{/each}
			</div>
		{/if}
		<div class="glyph">
			{#if geometry && record}
				<svg
					viewBox="0 0 1024 1024"
					role="img"
					aria-label={character}
					onpointermove={move}
					onpointerleave={() => (hover = null)}
				>
					<g transform="translate(0 900) scale(1 -1)">
						{#each geometry.strokes as stroke, i (i)}
							<path
								d={stroke}
								class:selected={active !== null &&
									record.components[active]?.strokes?.includes(i)}
								class:muted={active !== null &&
									record.components[active]?.strokes?.length &&
									!record.components[active]?.strokes?.includes(i)}
							/>
						{/each}
					</g>
				</svg>
				{#if record.components.some((part) => part.strokes?.length)}<button
						class="glyph-hit"
						type="button"
						aria-label="Select highlighted component"
						tabindex="-1"
						onpointermove={move}
						onpointerleave={() => (hover = null)}
						onclick={(event) => {
							move(event);
							if (hover !== null) {
								pin(hover, 'glyph');
							}
							hover = null;
						}}
					></button>{/if}
			{:else}<span>{character}</span>{/if}
		</div>
		<div class="character-lookup">
			<SyButton style="ghost" color="blue" center onclick={lookupCurrentCharacter}>
				<Search size="16" /><span>Look up this character</span>
			</SyButton>
		</div>
		{#if loading}<p role="status">Loading character data…</p>
		{:else if failed}<p role="status">Character data could not be loaded.</p>
		{:else}
			{#if record?.formation || record?.components.length}
				{#if !record.verified}<p class="verification">Unverified by Dong Chinese</p>{/if}
				{#if record.formation}<p class="formation">
						<BreakdownText text={record.formation} onlink={descriptionLookup} />
					</p>{/if}
				{#if record.components.length}
					<div class="components" role="group" aria-label="Components">
						{#each record.components as part, i (i)}
							<div
								class="component"
								role="group"
								aria-label="Component {i + 1}"
								class:active={active === i}
								onpointerenter={() => preview(i, 'control')}
								onpointerleave={() => (hover = null)}
							>
								{#if part.character}
									{#if entries[part.character]?.length}<button
											type="button"
											class="component-character link"
											aria-label="Look up {part.character}"
											onclick={(event) =>
												lookup(
													part.character,
													event,
													'component_lookup',
													i
												)}>{part.character}</button
										>
									{:else}<span class="component-character">{part.character}</span
										>{/if}
								{:else if geometry && part.strokes?.length}
									<svg
										class="fragment"
										viewBox="0 0 1024 1024"
										role="img"
										aria-label="Unnamed component"
										><g transform="translate(0 900) scale(1 -1)"
											>{#each part.strokes as j (j)}<path
													d={geometry.strokes[j]}
												/>{/each}</g
										></svg
									>
								{/if}
								<button
									type="button"
									class="role"
									aria-pressed={selection.pinned === i}
									aria-label="Component {i + 1}: {part.roles
										.map((r) => COMPONENT_ROLES[r])
										.join(', ') || 'Unclassified'}"
									onfocus={() => preview(i, 'keyboard')}
									onblur={() => (hover = null)}
									onclick={(event) =>
										pin(i, event.detail === 0 ? 'keyboard' : 'control')}
									>{part.roles.map((r) => COMPONENT_ROLES[r]).join(' · ') ||
										'Component'}</button
								>
							</div>
						{/each}
					</div>
					<div class="notes" aria-live="polite">
						{#each record.components as part, i (i)}
							<div class:shown={active === i} aria-hidden={active !== i}>
								{#if part.note}<p>
										<BreakdownText
											text={part.note}
											onlink={descriptionLookup}
										/>
									</p>{/if}
								{#if part.changedForm}<small>Changed form</small>{/if}
								{#if part.historicalSound}<small>Historical pronunciation</small
									>{/if}
								{#if part.originalMeaning}<small>Original meaning</small>{/if}
							</div>
						{/each}
					</div>
				{/if}
			{:else}<p class="formation">
					Formation information is not available for this character.
				</p>{/if}
			{#if record?.radical || record?.strokeCount}
				<dl>
					{#if record.radical}<div>
							<dt>Dictionary radical</dt>
							<dd>
								{#if entries[record.radical]?.length}<button
										type="button"
										class="link"
										aria-label="Look up radical {record.radical}"
										onclick={(event) =>
											lookup(record.radical, event, 'radical_lookup')}
										>{record.radical}</button
									>{:else}{record.radical}{/if}
							</dd>
						</div>{/if}
					{#if record.strokeCount}<div>
							<dt>Strokes</dt>
							<dd>{record.strokeCount}</dd>
						</div>{/if}
				</dl>
			{/if}
		{/if}
	</div>
</section>

<style>
	.breakdown {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		color: var(--sy-color--black);
		background: var(--sy-color--white);
		font-family: var(--sy-font-family);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		padding: 0.4rem 0.6rem;
		border-bottom: var(--sy-border);
		flex-shrink: 0;
	}
	h2 {
		font-size: 0.9rem;
		font-weight: 500;
		margin: 0;
	}
	.body {
		padding: 0.75rem 1rem;
		overflow: auto;
		min-height: 0;
	}
	.character-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.character-nav span {
		font-size: 1.25rem;
	}
	small {
		font-size: 0.75rem;
		color: var(--sy-text--muted);
	}
	.character-nav small {
		margin-left: 0.5rem;
	}
	button {
		font: inherit;
		color: inherit;
		cursor: pointer;
		border: 0;
		background: transparent;
		min-height: 44px;
	}
	button:focus-visible {
		outline: 2px solid var(--sy-text--blue);
		outline-offset: 2px;
	}
	.scripts {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}
	.scripts button {
		font-size: 0.75rem;
		padding: 0 0.5rem;
	}
	.scripts button[aria-pressed='true'] {
		color: var(--sy-text--blue);
		box-shadow: inset 0 -2px var(--sy-text--blue);
	}
	.character-lookup {
		display: flex;
		justify-content: center;
		margin-bottom: 0.5rem;
	}
	.character-lookup span {
		margin-inline-start: 0.35rem;
	}

	.glyph {
		position: relative;
		width: 10rem;
		height: 10rem;
		margin: 0.25rem auto;
		display: grid;
		place-items: center;
	}
	.glyph > span {
		font-size: 8rem;
		line-height: 1;
	}
	.glyph svg {
		width: 100%;
		height: 100%;
	}
	.glyph-hit {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	path {
		fill: var(--sy-color--black);
		transition:
			fill 0.12s,
			opacity 0.12s;
	}
	path.selected {
		fill: var(--sy-text--blue);
	}
	path.muted {
		opacity: 0.24;
	}
	.formation {
		font-size: 0.875rem;
		line-height: 1.65;
		margin: 0.6rem 0 1rem;
	}
	.verification {
		color: var(--sy-text--muted);
		font-size: 0.75rem;
		margin: 0.5rem 0;
	}
	.components {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.component {
		display: flex;
		align-items: center;
		border: var(--sy-border);
		border-radius: var(--sy-border-radius);
		min-width: 0;
	}
	.component.active {
		border-color: var(--sy-text--blue);
		box-shadow: inset 0 0 0 1px var(--sy-text--blue);
	}
	.component-character {
		display: grid;
		place-items: center;
		font-size: 1.6rem;
		min-width: 44px;
	}
	.fragment {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
	}
	.role {
		color: var(--sy-text--blue);
		text-decoration: none;
		font-size: 0.75rem;
		text-align: left;
		padding: 0.4rem;
		flex: 1;
		overflow-wrap: anywhere;
	}
	.notes {
		display: grid;
		margin: 0.75rem 0;
		font-size: 0.8rem;
		line-height: 1.6;
	}
	.notes > div {
		grid-area: 1/1;
		visibility: hidden;
		pointer-events: none;
	}
	.notes > div.shown {
		visibility: visible;
		pointer-events: auto;
	}
	.notes p {
		margin: 0;
	}
	.notes small {
		display: block;
	}
	dl {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		border-top: var(--sy-border);
		margin: 1rem 0 0;
		padding-top: 0.8rem;
	}
	dl div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	dt {
		font-size: 0.7rem;
		color: var(--sy-text--muted);
	}
	dd {
		margin: 0;
		font-size: 1.25rem;
	}
	.link {
		color: var(--sy-text--blue);
		text-decoration: none;
	}
	@media (prefers-reduced-motion: reduce) {
		path {
			transition: none;
		}
	}
</style>
