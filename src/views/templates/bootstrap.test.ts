import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isMobile: vi.fn(),
	isIPad: vi.fn(),
	inDebugMode: vi.fn(),
	setDebugMode: vi.fn(),
	mount: vi.fn(),
	handleError: vi.fn(),
}));

vi.mock('@/App.svelte', () => ({ default: 'desktop-app' }));
vi.mock('@/MobileApp.svelte', () => ({ default: 'mobile-app' }));
vi.mock('@/CharacterWindow.svelte', () => ({ default: 'character-window' }));
vi.mock('svelte', () => ({ mount: mocks.mount }));
vi.mock('@/utils/device.js', () => ({
	isMobile: mocks.isMobile,
	isIPad: mocks.isIPad,
}));
vi.mock('@/utils/error.js', () => ({ handleError: mocks.handleError }));
vi.mock('@/utils/process.js', () => ({ inDebugMode: mocks.inDebugMode }));
vi.mock('@/utils/startup.js', () => ({ setDebugMode: mocks.setDebugMode }));

const splashMarkup = `
	<div id="syng-bootstrap-launch-screen">
		<div id="syng-bootstrap-launch-status" role="status">
			<h1 id="syng-bootstrap-launch-status-title">Starting Syng…</h1>
			<p id="syng-bootstrap-launch-status-detail">Loading the application.</p>
		</div>
	</div>
	<div id="mobile-splash" hidden aria-hidden="true"></div>
`;

let animationFrames;

function runNextAnimationFrame() {
	const callback = animationFrames.shift();
	expect(callback).toBeTypeOf('function');
	callback(performance.now());
}

function prepareMainWindow() {
	document.body.id = 'app';
	document.body.innerHTML = splashMarkup;
}

describe('application splash handoff', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		prepareMainWindow();
		mocks.isMobile.mockReturnValue(false);
		mocks.isIPad.mockReturnValue(false);
		mocks.inDebugMode.mockResolvedValue(false);
		mocks.mount.mockReturnValue({ mounted: true });
		animationFrames = [];
		vi.stubGlobal('requestAnimationFrame', (callback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__');
	});

	it.each(['android', 'ios'])(
		'reveals the mobile splash before the application bundle executes on %s',
		async (platform) => {
			Reflect.set(window, '__TAURI_OS_PLUGIN_INTERNALS__', { platform });

			await import('@/splash-init.js');

			const splash = document.getElementById('mobile-splash');
			expect(splash.hidden).toBe(false);
			expect(splash.getAttribute('aria-hidden')).toBe('false');
			expect(mocks.isMobile).not.toHaveBeenCalled();
		}
	);

	it('keeps the mobile splash hidden before the application bundle executes on desktop', async () => {
		Reflect.set(window, '__TAURI_OS_PLUGIN_INTERNALS__', { platform: 'macos' });

		await import('@/splash-init.js');

		const splash = document.getElementById('mobile-splash');
		expect(splash.hidden).toBe(true);
		expect(splash.getAttribute('aria-hidden')).toBe('true');
	});

	it('never reveals the mobile splash on desktop', async () => {
		let resolveDebugMode;
		mocks.inDebugMode.mockReturnValue(
			new Promise((resolve) => {
				resolveDebugMode = resolve;
			})
		);

		const appModule = await import('@/app.js');
		expect(document.getElementById('mobile-splash').hidden).toBe(true);
		expect(document.getElementById('syng-bootstrap-launch-screen')).not.toBeNull();

		resolveDebugMode(false);
		await appModule.default;
		expect(mocks.mount).toHaveBeenCalledWith('desktop-app', { target: document.body });
		expect(document.getElementById('syng-bootstrap-launch-screen')).toBeNull();
	});

	it('reveals the splash on mobile and dismisses it after the shell mounts', async () => {
		let resolveDebugMode;
		mocks.isMobile.mockReturnValue(true);
		mocks.inDebugMode.mockReturnValue(
			new Promise((resolve) => {
				resolveDebugMode = resolve;
			})
		);

		const appModule = await import('@/app.js');
		const splash = document.getElementById('mobile-splash');
		expect(splash.hidden).toBe(false);
		expect(splash.getAttribute('aria-hidden')).toBe('false');

		resolveDebugMode(false);
		await vi.waitFor(() => expect(mocks.mount).toHaveBeenCalled());
		expect(splash.hidden).toBe(false);

		runNextAnimationFrame();
		expect(splash.hidden).toBe(false);
		runNextAnimationFrame();
		await appModule.default;

		expect(mocks.mount).toHaveBeenCalledWith('mobile-app', { target: document.body });
		expect(splash.hidden).toBe(true);
		expect(splash.getAttribute('aria-hidden')).toBe('true');
		expect(document.getElementById('syng-bootstrap-launch-screen')).toBeNull();
	});

	it('shows the splash on iPad while mounting the desktop shell', async () => {
		let resolveDebugMode;
		mocks.isMobile.mockReturnValue(true);
		mocks.isIPad.mockReturnValue(true);
		mocks.inDebugMode.mockReturnValue(
			new Promise((resolve) => {
				resolveDebugMode = resolve;
			})
		);

		const appModule = await import('@/app.js');
		expect(document.getElementById('mobile-splash').hidden).toBe(false);

		resolveDebugMode(false);
		await vi.waitFor(() => expect(mocks.mount).toHaveBeenCalled());
		runNextAnimationFrame();
		runNextAnimationFrame();
		await appModule.default;

		expect(mocks.mount).toHaveBeenCalledWith('desktop-app', { target: document.body });
		expect(document.getElementById('mobile-splash').hidden).toBe(true);
	});

	it('dismisses the mobile splash and uses the existing launch failure screen', async () => {
		const failure = new Error('bootstrap failed');
		mocks.isMobile.mockReturnValue(true);
		mocks.inDebugMode.mockRejectedValue(failure);

		const appModule = await import('@/app.js');
		await expect(appModule.default).resolves.toBeUndefined();

		const splash = document.getElementById('mobile-splash');
		const launchStatus = document.getElementById('syng-bootstrap-launch-status');
		expect(splash.hidden).toBe(true);
		expect(splash.getAttribute('aria-hidden')).toBe('true');
		expect(launchStatus.getAttribute('role')).toBe('alert');
		expect(document.getElementById('syng-bootstrap-launch-status-title').textContent).toBe(
			'Syng could not start.'
		);
		expect(document.getElementById('syng-bootstrap-launch-status-detail').textContent).toBe(
			'Please restart the app.'
		);
		expect(mocks.mount).not.toHaveBeenCalled();
		expect(mocks.handleError).toHaveBeenCalledWith(
			'Syng could not start. Please restart the app.',
			failure
		);
	});
});
