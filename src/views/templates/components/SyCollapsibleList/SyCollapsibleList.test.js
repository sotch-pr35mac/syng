import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SyCollapsibleList from './SyCollapsibleList.svelte';

const ITEMS = [
	{ id: '1', label: 'First' },
	{ id: '2', label: 'Second' },
];

it('should render empty text when no items are provided', () => {
	const { getByText } = render(SyCollapsibleList, {
		emptyText: 'Nothing here.',
		header: () => {},
		detail: () => {},
	});

	expect(getByText('Nothing here.').textContent).toBe('Nothing here.');
});

it('should render a header button for each item', () => {
	const { getAllByRole } = render(SyCollapsibleList, {
		items: ITEMS,
		header: () => {},
		detail: () => {},
	});

	expect(getAllByRole('button')).toHaveLength(2);
});

it('should show the detail for an item after clicking its header', async () => {
	const user = userEvent.setup();
	const { getAllByRole } = render(SyCollapsibleList, {
		items: [{ id: 'a', label: 'Alpha', body: 'alpha-detail' }],
		header: () => {},
		detail: () => {},
	});

	// Detail is not visible before clicking
	expect(document.querySelector('.sy-collapsible-list--detail')).toBeNull();

	await user.click(getAllByRole('button')[0]);

	expect(document.querySelector('.sy-collapsible-list--detail')).not.toBeNull();
});

it('should collapse a previously expanded item when its header is clicked again', async () => {
	const user = userEvent.setup();
	const { getAllByRole } = render(SyCollapsibleList, {
		items: ITEMS,
		header: () => {},
		detail: () => {},
	});

	const [first] = getAllByRole('button');
	await user.click(first);
	expect(document.querySelectorAll('.sy-collapsible-list--detail')).toHaveLength(1);

	await user.click(first);
	expect(document.querySelectorAll('.sy-collapsible-list--detail')).toHaveLength(0);
});

it('should only keep one item expanded at a time', async () => {
	const user = userEvent.setup();
	const { getAllByRole } = render(SyCollapsibleList, {
		items: ITEMS,
		header: () => {},
		detail: () => {},
	});

	const [first, second] = getAllByRole('button');
	await user.click(first);
	expect(document.querySelectorAll('.sy-collapsible-list--detail')).toHaveLength(1);

	await user.click(second);
	expect(document.querySelectorAll('.sy-collapsible-list--detail')).toHaveLength(1);
});
