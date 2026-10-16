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

function deferStrokeEngine() {
	const createWriter = vi.fn((_target: string, _character: string) => ({
		hideCharacter: vi.fn().mockResolvedValue({ canceled: false }),
	}));
	let finishImport!: (_module: { default: { create: typeof createWriter } }) => void;
	let markImportStarted!: () => void;
	const importStarted = new Promise<void>((resolve) => {
		markImportStarted = resolve;
	});
	const pendingImport = new Promise<{ default: { create: typeof createWriter } }>((resolve) => {
		finishImport = resolve;
	});
	const loadModule = vi.fn(() => {
		markImportStarted();
		return pendingImport;
	});
	vi.doMock('hanzi-writer', loadModule);
	return {
		createWriter,
		loadModule,
		importStarted,
		finishImport: () => finishImport({ default: { create: createWriter } }),
	};
}

it('loads the stroke engine on demand and ignores it when the window closes before import completes', async () => {
	const engine = deferStrokeEngine();
	const { createCharacterAnimation } = await import('@/composables/characterAnimation.svelte.js');
	const animation = createCharacterAnimation();
	expect(engine.loadModule).not.toHaveBeenCalled();
	const loading = animation.load('汉字');
	await engine.importStarted;
	animation.stop();
	engine.finishImport();
	await loading;
	expect(engine.createWriter).not.toHaveBeenCalled();
	expect(animation.active).toBe(false);
	expect(animation.characterNotFound).toBe(false);
});

it('creates only the latest requested script after a delayed stroke engine import', async () => {
	const engine = deferStrokeEngine();
	const { createCharacterAnimation } = await import('@/composables/characterAnimation.svelte.js');
	const animation = createCharacterAnimation();
	const firstLoad = animation.load('汉字');
	await engine.importStarted;
	const latestLoad = animation.load('漢字');
	engine.finishImport();
	await Promise.all([firstLoad, latestLoad]);
	expect(engine.createWriter.mock.calls.map((call) => call[1])).toEqual(['漢', '字']);
	animation.stop();
});
