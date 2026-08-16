import { expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SyList from '@/components/SyList/SyList.svelte';

const VALUES = [
	{ key: 'apple', headline: 'Apple', content: 'red fruit' },
	{ key: 'banana', headline: 'Banana', content: 'yellow fruit' },
	{ key: 'apricot', headline: 'Apricot', content: 'orange fruit' },
];

it('preserves its filter and stable selection when values change', async () => {
	const user = userEvent.setup();
	const onvisiblechange = vi.fn();
	const { container, findByPlaceholderText, getByText, queryByText, rerender } = render(SyList, {
		style: 'preview',
		values: VALUES,
		filterable: true,
		onvisiblechange,
	});
	const filterInput = await findByPlaceholderText('Filter');
	await user.type(filterInput, 'ap');
	await user.click(getByText('Apple'));

	await rerender({
		style: 'preview',
		values: VALUES.slice(1),
		filterable: true,
		onvisiblechange,
	});

	expect(filterInput.value).toBe('ap');
	expect(queryByText('Apple')).toBeNull();
	expect(getByText('Apricot')).toBeTruthy();
	expect(queryByText('Banana')).toBeNull();
	expect(container.querySelector('.sy-list-preview-item-container--active')).toBeNull();
	await waitFor(() => {
		expect(onvisiblechange).toHaveBeenLastCalledWith([VALUES[2]]);
	});
});

it('uses a controlled key to keep the correct row active after reordering', async () => {
	const { container, rerender } = render(SyList, {
		style: 'preview',
		values: VALUES,
		activeKey: 'banana',
	});

	await rerender({
		style: 'preview',
		values: [...VALUES].reverse(),
		activeKey: 'banana',
	});

	expect(
		container.querySelector('.sy-list-preview-item-container--active').textContent
	).toContain('Banana');
});
