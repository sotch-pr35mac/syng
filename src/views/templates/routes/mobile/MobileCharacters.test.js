import { beforeEach, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MobileCharacters from './MobileCharacters.svelte';
import { mobileCharacterWindowWordStore } from '../../stores/mobileCharacterWindowWord.svelte.js';

const hideCharacter = vi.fn();
const animateCharacter = vi.fn(({ onComplete }) => onComplete?.());
const pauseAnimation = vi.fn();
const resumeAnimation = vi.fn();
const TONE_FOUR = 4;

vi.mock('lucide-svelte', async () => {
	const mockIcon = (await import('../../components/__mocks__/FeatherIcon.svelte')).default;
	return {
		ChevronLeft: mockIcon,
		Pause: mockIcon,
		Play: mockIcon,
	};
});

vi.mock('hanzi-writer', () => ({
	default: {
		create: vi.fn(() => ({
			hideCharacter,
			animateCharacter,
			pauseAnimation,
			resumeAnimation,
		})),
	},
}));

const WORD = {
	_id: 'word-1',
	_rev: '1',
	word_id: 1,
	hash: 'hanzi',
	traditional: '漢字',
	simplified: '汉字',
	english: ['Chinese character'],
	pinyin_marks: 'hàn zì',
	tone_marks: [TONE_FOUR, TONE_FOUR],
	measure_words: [],
	lists: ['Bookmarks'],
	notes: '',
};

beforeEach(() => {
	hideCharacter.mockClear();
	animateCharacter.mockClear();
	pauseAnimation.mockClear();
	resumeAnimation.mockClear();
	mobileCharacterWindowWordStore.set(undefined);
	window.matchMedia = vi.fn(() => ({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
	screen.orientation = {
		lock: vi.fn(() => Promise.resolve()),
		unlock: vi.fn(),
	};
});

it('renders the empty mobile character state', () => {
	const { getByText } = render(MobileCharacters);

	expect(getByText('Select a word from Search to view stroke order')).toBeTruthy();
});

it('loads character data and starts stroke animation', async () => {
	const user = userEvent.setup();
	mobileCharacterWindowWordStore.set(WORD);
	const { container } = render(MobileCharacters);

	await waitFor(() => expect(container.querySelector('#character-target')).toBeTruthy());
	await user.click(container.querySelector('[data-testid="control-button"]'));

	expect(hideCharacter).toHaveBeenCalled();
	expect(animateCharacter).toHaveBeenCalled();
});
