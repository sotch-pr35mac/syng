<script lang="ts">
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
	const {
		fixed = false,
		onselection = () => {},
	}: { fixed?: boolean; onselection?: (_id: string | number) => void } = $props();
	const values = [
		{ id: 'alpha', text: 'Alpha', component: SimpleTextDropdownItem },
		{ id: 'disabled', text: 'Disabled', disabled: true, component: SimpleTextDropdownItem },
		{ component: DividerDropdownItem },
		{ id: 'beta', text: 'Beta', component: SimpleTextDropdownItem },
		{ id: 'bravo', text: 'Bravo', component: SimpleTextDropdownItem },
	];
</script>

<button type="button">Before</button>
<SyDropdown {values} {fixed} {onselection}>
	{#snippet children(_open, triggerProps)}
		<SyButton {...triggerProps}>Options</SyButton>
	{/snippet}
</SyDropdown>
<button type="button">After</button>
