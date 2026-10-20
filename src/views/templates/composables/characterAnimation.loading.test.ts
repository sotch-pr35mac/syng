import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));

beforeEach(() => {
	vi.resetModules();
	document.body.innerHTML = '<div id="character-target"></div>';
	window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => {
	vi.doUnmock('hanzi-writer');
	vi.resetModules();
});

it('loads the stroke engine with the animation module, before characters are requested', async () => {
	const createWriter = vi.fn((_target: string, _character: string) => ({
		hideCharacter: vi.fn().mockResolvedValue({ canceled: false }),
	}));
	const loadModule = vi.fn(() => ({ default: { create: createWriter } }));
	vi.doMock('hanzi-writer', loadModule);

	const { createCharacterAnimation } = await import('@/composables/characterAnimation.svelte.js');
	expect(loadModule).toHaveBeenCalledOnce();
	expect(createWriter).not.toHaveBeenCalled();
	const animation = createCharacterAnimation();
	await animation.load('汉字');
	expect(loadModule).toHaveBeenCalledOnce();
	expect(createWriter.mock.calls.map((call) => call[1])).toEqual(['汉', '字']);
	animation.stop();
});
