<script lang="ts">
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyButtonBar from '@/components/SyButtonBar/SyButtonBar.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
	import { walkthroughStore } from '@/stores/walkthrough.svelte.js';
	import { walkthroughTarget } from '@/actions/walkthroughTarget.svelte.js';
	import type { WalkthroughId } from '@/types/walkthrough.js';

	const { variant = 'desktop' }: { variant?: 'desktop' | 'mobile' } = $props();
	const identifier = $props.id();
	// Keep these labels independent of the lazily loaded guide content.
	const guides: { id: WalkthroughId; label: string }[] = [
		{ id: 'app', label: 'App tour' },
		{ id: 'dictionary', label: 'Dictionary' },
		{ id: 'bookmarks', label: 'Bookmarks' },
		{ id: 'reader-library', label: 'Importing and your library' },
		{ id: 'reader-document', label: 'Reading a document' },
		{ id: 'study', label: 'Choosing what to study' },
		{ id: 'flashcards', label: 'Flashcards' },
		{ id: 'quiz', label: 'Quizzes' },
	];
	let selectedId = $state<WalkthroughId>('app');
	let controls = $state<HTMLDivElement>();
	const selectedGuide = $derived(guides.find((guide) => guide.id === selectedId)!);
	const progress = $derived(walkthroughStore.preferences.guides[selectedId]);
	const actionLabel = $derived(
		progress?.status === 'in-progress' ? 'Resume' : progress ? 'Replay' : 'Start'
	);
	const choices = $derived([
		...guides.map((guide) => ({
			id: guide.id,
			text: guide.label,
			selected: guide.id === selectedId,
			component: SimpleTextDropdownItem,
		})),
		...(progress?.status === 'in-progress'
			? [
					{ id: 'divider', component: DividerDropdownItem },
					{
						id: 'restart',
						text: 'Start over',
						'aria-label': `Start over ${selectedGuide.label}`,
						component: SimpleTextDropdownItem,
					},
				]
			: []),
	]);

	function launchGuide(resume = false): void {
		controls
			?.querySelector<HTMLButtonElement>('.sy-button-bar--container > .sy-button')
			?.focus({ preventScroll: true });
		void walkthroughStore.start(selectedId, {}, resume, 'settings');
	}
	function selectGuide(value: string | number): void {
		if (value === 'restart') {
			launchGuide();
		} else if (guides.some((guide) => guide.id === value)) {
			selectedId = value as WalkthroughId;
		}
	}
</script>

<div
	class="walkthrough-settings"
	class:walkthrough-settings--mobile={variant === 'mobile'}
	role="group"
	aria-labelledby={`${identifier}-label`}
	use:walkthroughTarget={'settings-walkthroughs'}
>
	<span id={`${identifier}-label`}>Walkthrough</span>
	<div bind:this={controls} class="walkthrough-settings__controls">
		<SyButtonBar size="large">
			<SyDropdown
				values={choices}
				fixed={true}
				aria-label="Walkthroughs"
				onselection={selectGuide}
			>
				{#snippet children(open, attributes)}
					<SyButton
						{...attributes}
						grouped={true}
						classes={['sy-button--grouped--first']}
						center={true}
						aria-label={`Choose walkthrough: ${selectedGuide.label}`}
						title={selectedGuide.label}
					>
						<span class="walkthrough-settings__selection">{selectedGuide.label}</span
						>&nbsp;
						{#if open}<ChevronUp size="16" />{:else}<ChevronDown size="16" />{/if}
					</SyButton>
				{/snippet}
			</SyDropdown>
			<SyButton
				grouped={true}
				aria-label={`${actionLabel} ${selectedGuide.label}`}
				onclick={() => launchGuide(progress?.status === 'in-progress')}
				>{actionLabel}</SyButton
			>
		</SyButtonBar>
	</div>
</div>

<style>
	.walkthrough-settings {
		display: grid;
		grid-template-columns: var(--settings-row-columns, minmax(0, 1fr) minmax(0, 1fr));
		gap: var(--sy-space--extra-large);
		align-items: center;
		width: 100%;
		container-type: inline-size;
	}
	.walkthrough-settings__controls {
		min-width: 0;
		max-width: 100%;
	}
	.walkthrough-settings__selection {
		max-width: 10em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.walkthrough-settings--mobile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sy-mobile-space--medium);
	}
	@container (max-width: 28rem) {
		.walkthrough-settings:not(.walkthrough-settings--mobile) > * {
			grid-column: 1 / -1;
		}
	}
</style>
