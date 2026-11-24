<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import SyCollapsibleList from '@/components/SyCollapsibleList/SyCollapsibleList.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import SyList from '@/components/SyList/SyList.svelte';
	import SyListContent from '@/components/SyList/SyListContent.svelte';
	import SyListItem from '@/components/SyList/SyListItem.svelte';
	import SyModal from '@/components/SyModal/SyModal.svelte';
	import SyPopover from '@/components/SyPopover/SyPopover.svelte';
	import SyProgressLine from '@/components/SyProgressLine/SyProgressLine.svelte';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';
	import SyTab from '@/components/SyTab/SyTab.svelte';
	import SyTag from '@/components/SyTag/SyTag.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyTimer from '@/components/SyTimer/SyTimer.svelte';
	import SyToast from '@/components/SyToast/SyToast.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';

	type Sample =
		| 'button'
		| 'buttonBar'
		| 'collapsibleList'
		| 'dropdown'
		| 'list'
		| 'modal'
		| 'popover'
		| 'progress'
		| 'radio'
		| 'tab'
		| 'tag'
		| 'textInput'
		| 'timer'
		| 'toast'
		| 'toggle';
	const { sample }: { sample: Sample } = $props();

	const titles: Record<Sample, string> = {
		button: 'SyButton',
		buttonBar: 'SyButtonBar',
		collapsibleList: 'SyCollapsibleList',
		dropdown: 'SyDropdown',
		list: 'SyList + SyListItem',
		modal: 'SyModal',
		popover: 'SyPopover',
		progress: 'SyProgressLine',
		radio: 'SyRadio',
		tab: 'SyTab',
		tag: 'SyTag',
		textInput: 'SyTextInput',
		timer: 'SyTimer',
		toast: 'SyToast',
		toggle: 'SyToggle',
	};
	const descriptions: Record<Sample, string> = {
		button: 'Filled and ghost actions. Hold a filled button to see the shared inset press shadow; hover and keyboard focus retain their current states.',
		buttonBar: 'The shared grouped action container used across desktop screens.',
		collapsibleList: 'One content list with inset disclosure targets and recessed details.',
		dropdown:
			'An inset floating menu with anchored motion, keyboard navigation, and selection.',
		list: 'Preview rows and the shared content list card, 9px radius, outer shadow, and one divider between rows.',
		modal: 'The standard plain dialog shell with centered motion, a quiet rim, and its existing header, body, footer, and dismissal behavior.',
		popover:
			'A floating desktop surface with raised elevation, its existing anchor motion, and outside-click dismissal.',
		progress: 'The shared progress line over the recessed well role.',
		radio: 'Native SyRadio inputs in the shared sliding choice track, with standalone and disabled states preserved.',
		tab: 'The active underline slides directly between tabs; reduced motion snaps to the destination.',
		tag: 'Semantic tag fills using the current shared color roles.',
		textInput: 'Standard, ghost, and disabled text fields.',
		timer: 'A running timer. Click it to pause or resume.',
		toast: 'A floating status message with corner-origin motion, action, and dismissal.',
		toggle: 'Off, on, and disabled settings switches.',
	};

	let selectedTab = $state('General');
	let selectedRadio = $state('original');
	let inputValue = $state('Search Chinese or English');
	let dropdownSelection = $state('Original');
	let buttonCount = $state(0);
	let completed = $state(3);
	let modalOpen = $state(false);
	let popoverOpen = $state(false);
	let popoverAnchor = $state<DOMRect | undefined>(undefined);
	let toastOpen = $state(false);
	let firstToggle = $state(false);
	let secondToggle = $state(true);
	const dropdownValues = [
		{ id: 'Original', text: 'Original', component: SimpleTextDropdownItem },
		{ id: 'Contrast', text: 'Increase Contrast', component: SimpleTextDropdownItem },
		{ id: 'System', text: 'Follow system', component: SimpleTextDropdownItem },
	];
	const previewRows = [
		{ key: 'study', headline: '学习', subtitle: 'xuéxí', content: 'to study; to learn' },
		{ key: 'language', headline: '语言', subtitle: 'yǔyán', content: 'language' },
		{ key: 'dictionary', headline: '词典', subtitle: 'cídiǎn', content: 'dictionary' },
	];
	const collapsibleRows = [
		{
			id: 'first',
			title: 'First collection',
			detail: 'A compact explanation of the collection.',
		},
		{ id: 'second', title: 'Second collection', detail: 'Another expandable detail row.' },
	];

	function openPopover(event: MouseEvent): void {
		popoverAnchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
		popoverOpen = true;
	}
</script>

<main class="catalog">
	<header>
		<p class="eyebrow">Desktop · existing Sy element</p>
		<h1>{titles[sample]}</h1>
		<p>{descriptions[sample]}</p>
	</header>
	<div class="stage" class:stage--wide={sample === 'list'}>
		{#if sample === 'button'}
			<div class="row">
				<SyButton onclick={() => (buttonCount += 1)}>Primary action</SyButton>
				<SyButton style="ghost" onclick={() => (buttonCount += 1)}>Ghost action</SyButton>
				<SyButton color="blue" onclick={() => (buttonCount += 1)}>Blue action</SyButton>
				<SyButton disabled>Disabled</SyButton>
			</div>
			<p class="feedback">Activated {buttonCount} times</p>
		{:else if sample === 'buttonBar'}
			<SyButtonBar aria-label="Example actions">
				<SyButton grouped onclick={() => (buttonCount += 1)}>Save</SyButton>
				<SyButton grouped onclick={() => (buttonCount += 1)}>Share</SyButton>
				<SyButton grouped onclick={() => (buttonCount += 1)}>More</SyButton>
			</SyButtonBar>
			<p class="feedback">Activated {buttonCount} times</p>
		{:else if sample === 'collapsibleList'}
			<SyCollapsibleList items={collapsibleRows}>
				{#snippet header(item)}<strong>{item.title}</strong>{/snippet}
				{#snippet detail(item)}<div class="list-row">{item.detail}</div>{/snippet}
			</SyCollapsibleList>
		{:else if sample === 'dropdown'}
			<SyDropdown
				values={dropdownValues}
				onselection={(value) => (dropdownSelection = String(value))}
				aria-label="Appearance options"
			>
				{#snippet children(_open, triggerProps)}
					<SyButton {...triggerProps}>Appearance: {dropdownSelection}</SyButton>
				{/snippet}
			</SyDropdown>
		{:else if sample === 'list'}
			<div class="list-grid">
				<section>
					<h2 class="sy-content-list-title">Definitions</h2>
					<SyListContent>
						<SyListItem
							><div class="list-row">
								<strong>学习</strong><span>to study; to learn</span>
							</div></SyListItem
						>
						<SyListItem
							><div class="list-row">
								<strong>学会</strong><span>to learn; to master</span>
							</div></SyListItem
						>
						<SyListItem
							><div class="list-row">
								<strong>学生</strong><span>student</span>
							</div></SyListItem
						>
					</SyListContent>
				</section>
				<section>
					<h2 class="sy-content-list-title">Search results</h2>
					<SyList style="preview" values={previewRows} activeKey="study" filterable />
				</section>
			</div>
		{:else if sample === 'modal'}
			<SyButton onclick={() => (modalOpen = true)}>Open dialog</SyButton>
			<SyModal visible={modalOpen} title="Example dialog" onclose={() => (modalOpen = false)}>
				{#snippet body()}<p>
						This is the standard plain modal treatment over the app surface roles.
					</p>{/snippet}
				{#snippet footer()}<SyButton onclick={() => (modalOpen = false)}>Done</SyButton
					>{/snippet}
			</SyModal>
		{:else if sample === 'popover'}
			<SyButton onclick={openPopover}>Open popover</SyButton>
			<SyPopover
				visible={popoverOpen}
				anchor={popoverAnchor}
				width={260}
				animateFromAnchor
				onclose={() => (popoverOpen = false)}
			>
				<div class="popover-content">
					<strong>Quick definition</strong>
					<p>学习 · xuéxí · to study</p>
				</div>
			</SyPopover>
		{:else if sample === 'progress'}
			<div class="progress-example">
				<SyProgressLine total={5} {completed} />
				<p>{completed} of 5 complete</p>
				<SyButton
					size="small"
					onclick={() => (completed = completed >= 5 ? 0 : completed + 1)}
					>Advance</SyButton
				>
			</div>
		{:else if sample === 'radio'}
			<div class="stack">
				<SyRadioGroup selectedValue={selectedRadio}>
					{#each ['original', 'contrast'] as option}
						<label
							><SyRadio
								name="appearance"
								value={option}
								checked={selectedRadio === option}
								onchange={() => (selectedRadio = option)}
							/><span>{option === 'original' ? 'Original' : 'Increase Contrast'}</span
							></label
						>
					{/each}
				</SyRadioGroup>
				<label class="choice"
					><SyRadio
						name="disabled-example"
						value="disabled"
						checked={false}
						disabled
					/><span>Unavailable</span></label
				>
			</div>
		{:else if sample === 'tab'}
			<div class="tab-row" role="tablist" aria-label="Settings sections">
				{#each ['General', 'Telemetry', 'Acknowledgements'] as tab}
					<SyTab
						role="tab"
						active={selectedTab === tab}
						onclick={() => (selectedTab = tab)}>{tab}</SyTab
					>
				{/each}
			</div>
			<p class="feedback">{selectedTab} is selected</p>
		{:else if sample === 'tag'}
			<div class="row">
				<SyTag variant="blue">New</SyTag><SyTag variant="green">Saved</SyTag><SyTag
					variant="yellow">In progress</SyTag
				><SyTag variant="red">Needs attention</SyTag>
			</div>
		{:else if sample === 'textInput'}
			<div class="stack input-stack">
				<label
					>Standard <SyTextInput
						value={inputValue}
						oninput={(value) => (inputValue = value)}
						aria-label="Standard search input"
					/></label
				>
				<label
					>Ghost <SyTextInput
						style="ghost"
						value={inputValue}
						oninput={(value) => (inputValue = value)}
						aria-label="Ghost search input"
					/></label
				>
				<label
					>Disabled <SyTextInput
						value="Unavailable"
						disabled
						aria-label="Disabled input"
					/></label
				>
			</div>
		{:else if sample === 'timer'}
			<SyTimer duration={60} size={70} autoStart />
		{:else if sample === 'toast'}
			<SyButton onclick={() => (toastOpen = true)}>Show notification</SyButton>
			<SyToast
				visible={toastOpen}
				message="Your list was saved"
				detail="The latest changes are available offline."
				actionLabel="Undo"
				onaction={() => (toastOpen = false)}
				ondismiss={() => (toastOpen = false)}
			/>
		{:else if sample === 'toggle'}
			<div class="stack">
				<label class="choice"
					><SyToggle
						checked={firstToggle}
						accessibleLabel="Enable example setting"
						onchange={(checked) => (firstToggle = checked)}
					/><span>Off</span></label
				>
				<label class="choice"
					><SyToggle
						checked={secondToggle}
						accessibleLabel="Enable second example setting"
						onchange={(checked) => (secondToggle = checked)}
					/><span>On</span></label
				>
				<label class="choice"
					><SyToggle
						checked={false}
						disabled
						accessibleLabel="Unavailable setting"
					/><span>Unavailable</span></label
				>
			</div>
		{/if}
	</div>
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(1100px, 100vw);
		height: 100vh;
		overflow: auto;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		color: var(--sy-text--dark);
	}
	header {
		max-width: 750px;
	}
	.eyebrow {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 6px 0 8px;
		font-size: var(--sy-font-size--heading);
	}
	header p:last-child {
		color: var(--sy-text--secondary);
		line-height: var(--sy-line-height--body);
	}
	.stage {
		box-sizing: border-box;
		position: relative;
		min-height: 310px;
		margin-top: 28px;
		padding: 36px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	.stage--wide {
		padding: 22px;
		background: transparent;
		box-shadow: none;
	}
	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 14px;
	}
	.feedback {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
	}
	.stack {
		display: grid;
		gap: 20px;
		justify-items: start;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
	}
	.input-stack label {
		display: grid;
		gap: 7px;
	}
	.tab-row {
		display: flex;
		width: fit-content;
		border-bottom: var(--sy-border);
	}
	.list-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 34px;
	}
	.list-grid section {
		min-width: 0;
	}
	.list-grid :global(.sy-list--container) {
		margin: 0;
	}
	.list-grid h2 {
		margin-bottom: 10px;
	}
	.list-row {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		padding: 14px;
	}
	.list-row span {
		color: var(--sy-text--secondary);
	}
	.popover-content {
		padding: 18px;
	}
	.popover-content p {
		margin-bottom: 0;
	}
	.progress-example {
		width: min(360px, 100%);
	}
	@media (max-width: 680px) {
		.catalog {
			padding: 24px 20px 60px;
		}
		.stage {
			padding: 20px;
		}
		.list-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
