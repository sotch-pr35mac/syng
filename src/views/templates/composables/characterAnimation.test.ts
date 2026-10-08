import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HanziWriter, { type HanziWriterOptions } from 'hanzi-writer';
import { createCharacterAnimation } from '@/composables/characterAnimation.svelte.js';

vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('hanzi-writer', () => ({ default: { create: vi.fn() } }));

function mockWriter() {
	return {
		hideCharacter: vi.fn().mockResolvedValue({ canceled: false }),
		animateCharacter: vi.fn().mockResolvedValue({ canceled: false }),
		pauseAnimation: vi.fn().mockResolvedValue(undefined),
		resumeAnimation: vi.fn().mockResolvedValue(undefined),
	};
}

const createdWriters: ReturnType<typeof mockWriter>[] = [];
let animation: ReturnType<typeof createCharacterAnimation>;

beforeEach(() => {
	createdWriters.length = 0;
	vi.mocked(HanziWriter.create)
		.mockReset()
		.mockImplementation(() => {
			const writer = mockWriter();
			createdWriters.push(writer);
			return writer as unknown as HanziWriter;
		});
	document.body.innerHTML = '<div id="character-target"></div>';
	window.matchMedia = vi.fn().mockReturnValue({ matches: false });
	animation = createCharacterAnimation();
});

afterEach(() => {
	animation.stop();
	vi.unstubAllGlobals();
});

it('isolates repeated script switches from old completion callbacks, even cancellation callbacks', async () => {
	await animation.load('汉字');
	animation.toggle();
	const firstCompletion = createdWriters[0].animateCharacter.mock.calls[0][0].onComplete;
	await animation.load('漢字');
	animation.toggle();
	const secondCompletion = createdWriters[2].animateCharacter.mock.calls[0][0].onComplete;
	await animation.load('汉字');
	animation.toggle();
	firstCompletion({ canceled: false });
	secondCompletion({ canceled: true });
	expect(createdWriters[1].animateCharacter).not.toHaveBeenCalled();
	expect(createdWriters[3].animateCharacter).not.toHaveBeenCalled();
	expect(createdWriters[5].animateCharacter).not.toHaveBeenCalled();
	expect(createdWriters[4].animateCharacter).toHaveBeenCalledTimes(1);
	expect(animation.active).toBe(true);
	createdWriters[4].animateCharacter.mock.calls[0][0].onComplete({ canceled: false });
	expect(createdWriters[5].animateCharacter).toHaveBeenCalledTimes(1);
	createdWriters[5].animateCharacter.mock.calls[0][0].onComplete({ canceled: false });
	expect(animation.active).toBe(false);
	expect(animation.paused).toBe(false);
});

it('preserves pause/resume within a word but resets it for a new word', async () => {
	await animation.load('汉字');
	animation.toggle();
	animation.toggle();
	expect(animation.paused).toBe(true);
	expect(createdWriters[0].pauseAnimation).toHaveBeenCalledOnce();
	animation.toggle();
	expect(createdWriters[0].resumeAnimation).toHaveBeenCalledOnce();
	animation.toggle();
	await animation.load('中国');
	expect(animation.paused).toBe(false);
	expect(animation.active).toBe(false);
	animation.toggle();
	expect(createdWriters[2].animateCharacter).toHaveBeenCalledOnce();
	expect(createdWriters[2].resumeAnimation).not.toHaveBeenCalled();
});

it('does not advance or loop a canceled animation', async () => {
	await animation.load('汉字');
	animation.toggle();
	createdWriters[0].animateCharacter.mock.calls[0][0].onComplete({ canceled: true });
	expect(createdWriters[1].animateCharacter).not.toHaveBeenCalled();
	expect(animation.active).toBe(false);
});

it('only creates writers for the latest load when scripts change before the next DOM update', async () => {
	await Promise.all([animation.load('汉字'), animation.load('漢字'), animation.load('中国')]);
	expect(HanziWriter.create).toHaveBeenCalledTimes(2);
	expect(vi.mocked(HanziWriter.create).mock.calls.map((call) => call[1])).toEqual(['中', '国']);
});

it('cancels deferred loads on close or unmount', async () => {
	const loading = animation.load('汉字');
	animation.stop();
	await loading;
	expect(HanziWriter.create).not.toHaveBeenCalled();
});

it('continues cleanup when a failed writer throws synchronously', async () => {
	await animation.load('汉字');
	createdWriters[0].hideCharacter.mockImplementation(() => {
		throw new Error('Failed to load character data. Call setCharacter and try again.');
	});
	const options = vi.mocked(HanziWriter.create).mock.calls[0][2] as HanziWriterOptions;
	expect(() => options.onLoadCharDataError(new Error('Missing data'))).not.toThrow();
	expect(animation.characterNotFound).toBe(true);
	expect(createdWriters[1].hideCharacter).toHaveBeenCalledOnce();
	expect(() => animation.stop()).not.toThrow();
	await animation.load('中国');
	expect(animation.characterNotFound).toBe(false);
	animation.toggle();
	expect(createdWriters[2].animateCharacter).toHaveBeenCalledOnce();
});

it('aborts old data requests and ignores their late errors', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ strokes: [] }) })
	);
	await animation.load('汉');
	const previousOptions = vi.mocked(HanziWriter.create).mock.calls[0][2] as HanziWriterOptions;
	const previousRequest = Promise.resolve(previousOptions.charDataLoader('汉', vi.fn(), vi.fn()));
	await animation.load('漢');
	await expect(previousRequest).rejects.toThrow('canceled');
	const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
	expect(signal?.aborted).toBe(true);
	previousOptions.onLoadCharDataError(new Error('Old request failed'));
	expect(animation.characterNotFound).toBe(false);
	const currentOptions = vi.mocked(HanziWriter.create).mock.calls[1][2] as HanziWriterOptions;
	currentOptions.onLoadCharDataError(new Error('Current request failed'));
	expect(animation.characterNotFound).toBe(true);
	expect(animation.active).toBe(false);
});

it.each([false, true])(
	'cancels the real writer and settles its animation when paused=%s',
	async (pauseBeforeStopping) => {
		const { default: RealHanziWriter } =
			await vi.importActual<typeof import('hanzi-writer')>('hanzi-writer');
		vi.mocked(HanziWriter.create).mockImplementation(RealHanziWriter.create);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					strokes: ['M 0 0 L 100 0 L 100 10 Z'],
					medians: [
						[
							[0, 0],
							[100, 0],
						],
					],
				}),
			})
		);
		await animation.load('一二');
		const firstWriter = vi.mocked(HanziWriter.create).mock.results[0].value as HanziWriter;
		const secondWriter = vi.mocked(HanziWriter.create).mock.results[1].value as HanziWriter;
		await Promise.all([firstWriter.getCharacterData(), secondWriter.getCharacterData()]);
		const firstAnimation = vi.spyOn(firstWriter, 'animateCharacter');
		const secondAnimation = vi.spyOn(secondWriter, 'animateCharacter');
		animation.toggle();
		if (pauseBeforeStopping) {
			animation.toggle();
		}
		await Promise.resolve();
		animation.stop();
		await expect(firstAnimation.mock.results[0].value).resolves.toEqual({ canceled: true });
		expect(secondAnimation).not.toHaveBeenCalled();
		expect(animation.active).toBe(false);
		expect(animation.paused).toBe(false);
	}
);
