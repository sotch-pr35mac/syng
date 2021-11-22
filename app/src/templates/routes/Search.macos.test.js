/* eslint-disable no-undef */
import Search from './Search.svelte';
import { render } from '@testing-library/svelte';

it('should have a draggable search bar on macOS', async () => {
	const { getByTestId } = render(Search, {});
	const searchBar = getByTestId('search-bar-container');
	const classes = searchBar.className.split(' ');

	if(process.platform === 'darwin') {
		console.log('Running on macOS...');
		console.log('Search bar should be draggable');
		expect(classes).toContain('search-bar--container--macos');
	} else {
		console.log('Not running on macOS...');
		console.log('Search bar should NOT be draggable');
		expect(classes).not.toContain('search-bar--container--macos');
	}
});
