<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SimpleTextDropdownItem from '@/components/SyDropdown/SimpleTextDropdownItem.svelte';
	import TextWithIconDropdownItem from '@/components/SyDropdown/TextWithIconDropdownItem.svelte';
	import { Check } from 'lucide-svelte';
	import DividerDropdownItem from '@/components/SyDropdown/DividerDropdownItem.svelte';
	const {
		fixed = false,
		iconItems = false,
		label = 'Options',
		values = [
			{ id: 'alpha', text: 'Alpha', component: SimpleTextDropdownItem },
			{ id: 'disabled', text: 'Disabled', disabled: true, component: SimpleTextDropdownItem },
			{ component: DividerDropdownItem },
			{ id: 'beta', text: 'Beta', component: SimpleTextDropdownItem },
			{ id: 'bravo', text: 'Bravo', component: SimpleTextDropdownItem },
		],
		onselection = () => {},
	}: {
		fixed?: boolean;
		iconItems?: boolean;
		label?: string;
		values?: ComponentProps<typeof SyDropdown>['values'];
		onselection?: (_id: string | number) => void;
	} = $props();
	const menuValues = $derived(
		values.map((value) =>
			iconItems && value.id
				? { ...value, component: TextWithIconDropdownItem, icon: Check }
				: value
		)
	);
</script>

<button type="button">Before</button>
<SyDropdown values={menuValues} {fixed} {onselection}>
	{#snippet children(_open, triggerProps)}
		<SyButton {...triggerProps}>{label}</SyButton>
	{/snippet}
</SyDropdown>
<button type="button">After</button>
