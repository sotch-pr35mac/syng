<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
	import type { SheetSnap } from '@/types/snapSheet.js';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyTag from '@/components/SyTag/SyTag.svelte';
	import ReaderFixture from '@test/accessibility/ReaderFixture.svelte';
	import { tabNavigation } from '@/actions/tabNavigation.js';
	import { responsiveLayout } from '@/actions/responsiveLayout.js';
	let dialogOpen = $state(false);
	let nestedOpen = $state(false);
	let activeTab = $state('General');
	let checked = $state(true);
	let selection = $state('');
	const values = ['First action', 'Second action'].map((text) => ({
		id: text,
		text,
		component: SimpleTextDropdownItem,
	}));
	const showReader = new URLSearchParams(location.search).has('reader');
	const showSheet = new URLSearchParams(location.search).has('sheet');
	let sheetSnap = $state<SheetSnap>('partial');
</script>

<main>
	<h1>Syng shared controls</h1>
	<div class="controls">
		<SyButton onclick={() => (dialogOpen = true)}>Open dialog</SyButton>
		<SyButton style="ghost">Ghost action</SyButton>
		<SyButton classes={['sy-tooltip--container']} aria-label="Help">
			<span aria-hidden="true">?</span><span
				class="sy-tooltip--body sy-tooltip--body-bottom"
				aria-hidden="true">Keyboard and pointer help</span
			>
		</SyButton>
		<SyDropdown {values} onselection={(value) => (selection = String(value))}>
			{#snippet children(_open, triggerProps)}<SyButton {...triggerProps}>Actions</SyButton
				>{/snippet}
		</SyDropdown>
		<SyToggle accessibleLabel="Color tones" {checked} onchange={(value) => (checked = value)} />
		<label>Search<SyTextInput aria-label="Search" placeholder="Find a word" /></label>
	</div>
	<p role="status">{selection}</p>
	<div role="tablist" aria-label="Preferences" use:tabNavigation>
		{#each ['General', 'Reader'] as tab}
			<SyTab
				role="tab"
				id={`tab-${tab}`}
				aria-controls={`panel-${tab}`}
				active={activeTab === tab}
				onclick={() => (activeTab = tab)}>{tab}</SyTab
			>
		{/each}
	</div>
	<div
		id={`panel-${activeTab}`}
		role="tabpanel"
		aria-labelledby={`tab-${activeTab}`}
		tabindex="0"
	>
		<p>Application controls follow system text preferences.</p>
		<p class="muted">Supporting text stays readable in both themes.</p>
		<div class="controls">
			{#each ['blue', 'green', 'yellow', 'red'] as variant}
				<SyTag variant={variant as 'blue' | 'green' | 'yellow' | 'red'}>{variant}</SyTag>
			{/each}
		</div>
	</div>
	<div class="panes" use:responsiveLayout={{ thresholdRem: 44, className: 'stacked' }}>
		<section>
			<h2>Results</h2>
			<p>Selected word</p>
		</section>
		<section>
			<h2>Dictionary</h2>
			<p>A longer definition that wraps when system text is enlarged.</p>
		</section>
	</div>
</main>

{#if showReader}<div class="reader-fixture"><ReaderFixture /></div>{/if}

{#if showSheet}
	<!-- Exercise the same fixed menu alignment/direction choices as MobileBookmarks. -->
	<SySnapSheet
		accessibleName="Bookmark lists"
		initialSnap="partial"
		onSnapChange={(snap) => (sheetSnap = snap)}
	>
		<div class="sheet-controls">
			{#each ['left', 'right'] as position}
				<SyDropdown
					{values}
					fixed
					position={position as 'left' | 'right'}
					direction={sheetSnap === 'full' ? 'down' : 'up'}
				>
					{#snippet children(_open, triggerProps)}
						<SyButton {...triggerProps}
							>{position === 'left' ? 'Choose list' : 'List actions'}</SyButton
						>
					{/snippet}
				</SyDropdown>
			{/each}
		</div>
	</SySnapSheet>
{/if}

<SyModal visible={dialogOpen} title="Accessible dialog" onclose={() => (dialogOpen = false)}>
	{#snippet body()}
		<p>The heading receives initial focus without opening the software keyboard.</p>
		<SyTextInput aria-label="Note" placeholder="Add a note" />
		<SyDropdown {values} fixed onselection={(value) => (selection = String(value))}>
			{#snippet children(_open, triggerProps)}<SyButton {...triggerProps}
					>Dialog actions</SyButton
				>{/snippet}
		</SyDropdown>
		<SyButton onclick={() => (nestedOpen = true)}>Open nested dialog</SyButton>
	{/snippet}
	{#snippet footer()}<SyButton onclick={() => (dialogOpen = false)}>Done</SyButton>{/snippet}
</SyModal>
<SyModal visible={nestedOpen} title="Nested dialog" onclose={() => (nestedOpen = false)}>
	{#snippet body()}<p>Escape closes only this dialog.</p>{/snippet}
</SyModal>

<style>
	.sheet-controls {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
	}
	.reader-fixture {
		padding: 1rem;
		overflow-wrap: anywhere;
	}
	:global(body) {
		overflow: auto;
	}
	main {
		padding: 1.5rem;
		max-width: 64rem;
		margin: auto;
		overflow-wrap: anywhere;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		max-width: 100%;
	}
	[role='tablist'] {
		display: flex;
		flex-wrap: wrap;
	}
	.muted {
		color: var(--sy-text--muted);
	}
	.panes {
		display: grid;
		grid-template-columns: 2fr 9fr;
		gap: 1rem;
	}
	.panes :global(section) {
		min-width: 0;
	}
	.panes:global(.stacked) {
		grid-template-columns: 1fr;
	}
</style>
