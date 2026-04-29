<script>
	import { isIPad, isMobile } from '@/utils/device.js';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyListPreviewItem from '@/components/SyList/SyListPreviewItem.svelte';

	/** @typedef {import('@/components/SyList/SyListPreview.types.js').SyListPreviewValue} SyListPreviewValue */

	const id = Math.floor(Math.random() * 100);
	const mobile = isMobile();
	const ipad = isIPad();

	/**
	 * @typedef {Object} Props
	 * @property {SyListPreviewValue[]} [values] - Values Prop
	 * @property {boolean} [highlight] - Highlight Prop
	 * @property {boolean} [filterable] - Filterable Prop
	 * @property {any} [component] - Suppress the unexpected prop warning
	 * @property {(detail: any) => void} [onselection] - Selection callback
	 * @property {(detail: any) => void} [onevent] - Event callback
	 */

	/** @type {Props} */
	const {
		values = [],
		highlight = true,
		filterable = false,
		component: _component = undefined,
		onselection,
		onevent,
	} = $props();

	let activeIndex = $state();
	let filteredValues = $state([]);

	// Reset filtered values when values prop changes
	$effect(() => {
		if (values) {
			filteredValues = values;

			// Reset the filter text field
			if (filterable) {
				const filterInput = document.getElementById(id);
				if (filterInput) {
					filterInput.value = '';
				}
			}
		}
	});

	const handleSelection = (event) => {
		activeIndex = event.detail;
		onselection?.({
			index: values.indexOf(filteredValues[activeIndex]),
			value: filteredValues[activeIndex],
		});
	};
	const handleFilter = (filterText) => {
		const normalizedFilter = filterText.toLowerCase();
		filteredValues = values.filter((item) => {
			const searchableText = [item.content, item.headline, item.subtitle]
				.flat()
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return searchableText.includes(normalizedFilter);
		});
	};
	/** @param {SyListPreviewValue} value */
	const getItemKey = (value, index) => value.key ?? index;
</script>

<div
	class="sy-list-preview"
	class:sy-list-preview--mobile={mobile}
	class:sy-list-preview--ipad={ipad}
>
	{#if filterable}
		<div class="sy-list-preview__filter">
			<SyTextInput
				spellcheck={false}
				placeholder="Filter"
				size="large"
				{id}
				oninput={handleFilter}
			/>
		</div>
	{/if}
	<div class="sy-list-preview__rows">
		{#each filteredValues as value, index (getItemKey(value, index))}
			<SyListPreviewItem
				headline={value.headline}
				subtitle={value.subtitle}
				content={value.content}
				active={activeIndex === index}
				{index}
				{highlight}
				onclick={handleSelection}
				{onevent}
			/>
		{/each}
	</div>
</div>

<style>
	.sy-list-preview {
		--sy-list-preview-filter-gutter: calc(var(--sy-space--small) + var(--sy-space));

		width: 100%;
	}

	.sy-list-preview--mobile {
		box-sizing: border-box;
		padding: 0 var(--sy-mobile-space--medium) var(--sy-mobile-space--medium);
	}

	.sy-list-preview--mobile.sy-list-preview--ipad {
		padding-top: var(--sy-mobile-space--medium);
	}

	.sy-list-preview__filter {
		box-sizing: border-box;
		width: 100%;
		margin-bottom: var(--sy-mobile-space--small);
	}

	.sy-list-preview__filter :global(.sy-text-input) {
		box-sizing: border-box;
		width: calc(
			100% - var(--sy-list-preview-filter-gutter) - var(--sy-list-preview-filter-gutter)
		);
		max-width: calc(
			100% - var(--sy-list-preview-filter-gutter) - var(--sy-list-preview-filter-gutter)
		);
		min-width: 0;
	}

	.sy-list-preview--mobile .sy-list-preview__rows {
		overflow: hidden;
		background-color: var(--sy-color--white);
		border: var(--sy-mobile-surface-border);
		border-radius: var(--sy-border-radius);
	}

	.sy-list-preview--mobile :global(.sy-text-input) {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		margin: var(--sy-mobile-space--small) 0 var(--sy-mobile-space--medium);
	}
</style>
