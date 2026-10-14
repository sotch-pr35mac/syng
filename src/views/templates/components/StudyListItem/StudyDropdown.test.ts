import { beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StudyDropdown from '@/components/StudyListItem/StudyDropdown.svelte';
import StudyListItem from '@/components/StudyListItem/StudyListItem.svelte';

vi.mock('@/utils/device.js', () => ({ isMobile: () => false }));

beforeEach(() => {
	window.location.hash = '#/bookmarks';
});

it.each([0, 1, 3, 4])('gates dropdown actions for a list with %i words', async (wordCount) => {
	const user = userEvent.setup();
	const view = render(StudyDropdown, { list: '词 & # 1', wordCount, status: 'ready' });
	await user.click(view.getByText('Study'));
	const quiz = view.getByRole('button', { name: /^Quiz/ });
	const flashcards = view.getByRole('button', { name: /^Flashcards/ });
	expect((quiz as HTMLButtonElement).disabled).toBe(wordCount < 4);
	expect((flashcards as HTMLButtonElement).disabled).toBe(wordCount === 0);
	await user.click(quiz);
	expect(window.location.hash).toBe(
		wordCount >= 4
			? '#/study/quiz?list=%E8%AF%8D%20%26%20%23%201&from=bookmarks'
			: '#/bookmarks'
	);
	if (wordCount < 4) {
		await user.click(flashcards);
		expect(window.location.hash).toBe(
			wordCount > 0
				? '#/study/flashcards?list=%E8%AF%8D%20%26%20%23%201&from=bookmarks'
				: '#/bookmarks'
		);
	}
});

it('keeps stale content unavailable until its latest load completes', async () => {
	const user = userEvent.setup();
	const view = render(StudyDropdown, { list: 'Pending', wordCount: 4, status: 'loading' });
	await user.click(view.getByText('Study'));
	await user.click(view.getByRole('button', { name: /^Flashcards/ }));
	expect(window.location.hash).toBe('#/bookmarks');
	await view.rerender({ list: 'Pending', wordCount: 4, status: 'ready' });
	await user.click(view.getByRole('button', { name: /^Flashcards/ }));
	expect(window.location.hash).toBe('#/study/flashcards?list=Pending&from=bookmarks');
});

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
