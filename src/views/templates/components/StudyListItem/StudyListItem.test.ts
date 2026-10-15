import { expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';

vi.mock('@/utils/device.js', () => ({ isMobile: () => false }));

it('explains the quiz requirement in the picker before launch', async () => {
	const selection = vi.fn();
	const user = userEvent.setup();
	const view = render(StudyListItem, {
		value: { name: 'Short list', wordCount: 3 },
		onselection: selection,
	});
	expect(view.getByText('Quiz needs at least 4 words')).toBeTruthy();
	await user.click(view.getByRole('button', { name: 'Start quiz for Short list' }));
	expect(selection).not.toHaveBeenCalled();
	await user.click(view.getByRole('button', { name: 'Flashcards for Short list' }));
	expect(selection).toHaveBeenCalledWith({ action: 'flashcards', list: 'Short list' });
});
