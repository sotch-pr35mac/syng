<script lang="ts">
	import { tick } from 'svelte';
	import { Check, ChevronDown, ExternalLink } from 'lucide-svelte';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';

	type Sample = 'collapsibleList' | 'dropdown' | 'radioChoices';
	const { sample }: { sample: Sample } = $props();

	const disclosureRows = [
		{
			id: 'overview',
			title: 'About your data',
			detail: 'Syng keeps your words and reading material on this device.',
		},
		{
			id: 'updates',
			title: 'Updates',
			detail: 'Check for a newer version and review what has changed.',
		},
	];
	const dropdownItems = [
		{ id: 'original', label: 'Original appearance' },
		{ id: 'contrast', label: 'Increase Contrast' },
		{ id: 'system', label: 'Follow system' },
	];
	let expandedId = $state<string | null>('overview');
	let dropdownOpen = $state(false);
	let selectedDropdown = $state('original');
	let selectedChoice = $state('both');
	let dropdownRoot = $state<HTMLDivElement>();
	let dropdownTrigger = $state<HTMLButtonElement>();
	let dropdownMenu = $state<HTMLDivElement>();

	async function openDropdown(): Promise<void> {
		dropdownOpen = true;
		await tick();
		dropdownMenu?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')?.focus();
	}

	function closeDropdown(): void {
		dropdownOpen = false;
		dropdownTrigger?.focus();
	}

	function handleWindowPointerdown(event: PointerEvent): void {
		if (dropdownOpen && !dropdownRoot?.contains(event.target as Node)) {
			dropdownOpen = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (dropdownOpen && event.key === 'Escape') {
			event.preventDefault();
			closeDropdown();
		}
	}
	function handleMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Tab') {
			dropdownOpen = false;
			return;
		}
		const items = [
			...(dropdownMenu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
		];
		const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
		let nextIndex: number;
		if (event.key === 'ArrowDown') {
			nextIndex = (currentIndex + 1) % items.length;
		} else if (event.key === 'ArrowUp') {
			nextIndex = (currentIndex - 1 + items.length) % items.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = items.length - 1;
		} else {
			return;
		}
		event.preventDefault();
		items[nextIndex]?.focus();
	}

	const heading = $derived(
		sample === 'collapsibleList'
			? 'One list, expandable rows'
			: sample === 'dropdown'
				? 'A menu that grows from its trigger'
				: 'A radio group with a shared track'
	);
	const description = $derived(
		sample === 'collapsibleList'
			? 'Proposal: keep each target inset from its detail so the hover treatment reads as a distinct control.'
			: sample === 'dropdown'
				? 'Proposal: make the floating panel and its items follow one inset-corner rule, with short anchored motion.'
				: 'Proposal: keep native single-choice behavior while a shared pill glides and settles into place.'
	);
</script>

<svelte:window onpointerdown={handleWindowPointerdown} onkeydown={handleWindowKeydown} />

<main class="proposal-page">
	<header>
		<p class="eyebrow">Adopted design reference</p>
		<h1>{heading}</h1>
		<p>{description}</p>
	</header>
	<div class="stage">
		{#if sample === 'collapsibleList'}
			<section class="example">
				<h2 class="sy-content-list-title">Help &amp; information</h2>
				<div class="disclosure-list">
					{#each disclosureRows as row (row.id)}
						<div class="disclosure-row">
							<button
								type="button"
								class="disclosure-trigger"
								aria-expanded={expandedId === row.id}
								aria-controls={`proposal-disclosure-${row.id}`}
								onclick={() => (expandedId = expandedId === row.id ? null : row.id)}
							>
								<span>{row.title}</span>
								<ChevronDown size={16} aria-hidden="true" />
							</button>
							<div
								id={`proposal-disclosure-${row.id}`}
								class="disclosure-detail"
								class:disclosure-detail--open={expandedId === row.id}
								aria-hidden={expandedId !== row.id}
								inert={expandedId !== row.id}
							>
								<div class="disclosure-detail__clip"><p>{row.detail}</p></div>
							</div>
						</div>
					{/each}
					<a
						class="disclosure-link"
						href="#external-destination"
						onclick={(event) => event.preventDefault()}
					>
						<span>Read the full guide</span><ExternalLink
							size={15}
							aria-hidden="true"
						/>
					</a>
				</div>
			</section>
		{:else if sample === 'dropdown'}
			<section class="example">
				<span class="control-label">Appearance</span>
				<div class="dropdown-root" bind:this={dropdownRoot}>
					<button
						bind:this={dropdownTrigger}
						type="button"
						class="dropdown-trigger"
						aria-haspopup="menu"
						aria-expanded={dropdownOpen}
						aria-controls="proposal-dropdown-menu"
						onclick={() => (dropdownOpen ? closeDropdown() : openDropdown())}
					>
						{dropdownItems.find((item) => item.id === selectedDropdown)?.label}
						<ChevronDown size={16} aria-hidden="true" />
					</button>
					<div
						bind:this={dropdownMenu}
						id="proposal-dropdown-menu"
						class="dropdown-menu"
						class:dropdown-menu--open={dropdownOpen}
						role="menu"
						aria-label="Appearance"
						aria-hidden={!dropdownOpen}
						inert={!dropdownOpen}
						onkeydown={handleMenuKeydown}
					>
						{#each dropdownItems as item (item.id)}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={selectedDropdown === item.id}
								onclick={() => {
									selectedDropdown = item.id;
									closeDropdown();
								}}
							>
								<span class="menu-check"
									>{#if selectedDropdown === item.id}<Check
											size={15}
											aria-hidden="true"
										/>{/if}</span
								>
								{item.label}
							</button>
						{/each}
					</div>
				</div>
				<p class="geometry">14px outer radius = 10px item radius + 4px inset padding</p>
			</section>
		{:else}
			<section class="example">
				<fieldset class="radio-fieldset">
					<legend>Character set</legend>
					<SyRadioGroup selectedValue={selectedChoice}>
						{#each [{ value: 'both', label: 'Both' }, { value: 'simplified', label: 'Simplified' }, { value: 'traditional', label: 'Traditional' }] as choice (choice.value)}
							<label>
								<SyRadio
									name="proposal-character-set"
									value={choice.value}
									checked={selectedChoice === choice.value}
									onchange={() => (selectedChoice = choice.value)}
								/>
								<span>{choice.label}</span>
							</label>
						{/each}
					</SyRadioGroup>
				</fieldset>
				<p class="geometry">
					15px outer radius = 11px selection radius + 4px inset padding
				</p>
				<p class="supporting">
					The sliding highlight signals one choice without a separate radio glyph. Pointer
					changes carry a small settling motion; keyboard selection and Reduced Motion
					snap immediately.
				</p>
			</section>
		{/if}
	</div>
	<aside class="proposal-note">
		<strong>Adopted direction</strong>
		<span>
			The live Sy component now uses this direction. Compare its Element story for the current
			implementation.
		</span>
	</aside>
</main>

<style>
	.proposal-page {
		box-sizing: border-box;
		width: min(1100px, 100vw);
		min-height: 100vh;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		color: var(--sy-color--black);
	}
	header {
		max-width: 730px;
	}
	.eyebrow {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 5px 0 8px;
		font-size: var(--sy-font-size--heading);
	}
	header p:last-child {
		margin: 0;
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--secondary);
	}
	.stage {
		box-sizing: border-box;
		margin-top: 28px;
		min-height: 330px;
		padding: 35px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.example {
		max-width: 530px;
	}
	.example h2 {
		margin: 0 0 13px;
	}
	.disclosure-list {
		overflow: hidden;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.disclosure-row + .disclosure-row,
	.disclosure-link {
		border-top: var(--sy-border);
	}
	.disclosure-row {
		padding: 4px 6px;
	}
	.disclosure-trigger,
	.disclosure-link {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		min-height: 52px;
		padding: 12px 16px;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.disclosure-trigger {
		min-height: 44px;
		padding: 10px;
		border-radius: 7px;
	}
	.disclosure-trigger:hover,
	.disclosure-link:hover {
		background: var(--sy-color--grey-2);
	}
	.disclosure-trigger :global(svg) {
		transition: transform 220ms ease;
	}
	.disclosure-trigger[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	.disclosure-detail {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 240ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 190ms ease;
	}
	.disclosure-detail--open {
		grid-template-rows: 1fr;
		opacity: 1;
	}
	.disclosure-detail__clip {
		min-height: 0;
		overflow: hidden;
	}
	.disclosure-detail p {
		margin: 8px 10px 10px;
		padding: 12px 14px;
		border-radius: 7px;
		background: var(--sy-surface--well);
		color: var(--sy-text--secondary);
		font-size: 0.875rem;
		line-height: var(--sy-line-height--body);
	}
	.control-label,
	.radio-fieldset legend {
		display: block;
		margin-bottom: 10px;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}
	.dropdown-root {
		position: relative;
		width: min(300px, 100%);
	}
	.dropdown-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		width: 100%;
		min-height: 42px;
		padding: 8px 12px;
		border: var(--sy-surface-border);
		border-radius: 9px;
		background: var(--sy-surface--content);
		color: inherit;
		font: inherit;
		cursor: pointer;
		box-shadow: var(--sy-shadow);
	}
	.dropdown-trigger :global(svg) {
		transition: transform 180ms ease;
	}
	.dropdown-trigger[aria-expanded='true'] :global(svg) {
		transform: rotate(180deg);
	}
	.dropdown-menu {
		position: absolute;
		z-index: 2;
		top: calc(100% + 7px);
		left: 0;
		box-sizing: border-box;
		width: 100%;
		padding: 4px;
		border: var(--sy-surface-border);
		border-radius: 14px;
		background: var(--sy-surface--floating);
		box-shadow:
			0 10px 30px #1e2a3d38,
			0 2px 8px #1e2a3d1c;
		transform-origin: 18px -7px;
		transform: translateY(-4px) scale(0.82, 0.62);
		opacity: 0;
		pointer-events: none;
		transition:
			transform 190ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 140ms ease;
	}
	.dropdown-menu--open {
		transform: translateY(0) scale(1);
		opacity: 1;
		pointer-events: auto;
	}
	.dropdown-menu button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 38px;
		padding: 8px 10px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
	}
	.dropdown-menu button:hover,
	.dropdown-menu button:focus-visible {
		background: var(--sy-surface--well);
	}
	.menu-check {
		display: inline-flex;
		width: 15px;
		height: 15px;
		color: var(--sy-text--blue);
	}
	.geometry,
	.supporting {
		margin-top: 18px;
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}
	.radio-fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.proposal-note {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		max-width: 720px;
		margin-top: 24px;
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
	}
	.proposal-note strong {
		color: var(--sy-text--blue);
	}
	@media (max-width: 650px) {
		.proposal-page {
			padding: 25px 18px 60px;
		}
		.stage {
			padding: 24px 18px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.disclosure-trigger :global(svg),
		.disclosure-detail,
		.dropdown-trigger :global(svg),
		.dropdown-menu {
			transition: none;
		}
		.dropdown-menu {
			transform: none;
		}
	}
</style>
