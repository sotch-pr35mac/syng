import { beforeEach, expect, it, vi } from 'vitest';
import { emptyReleaseHistory } from '@/utils/whatsNew.js';
import type { ReleaseHistory } from '@/types/whatsNew.js';
import { telemetry } from '@/utils/telemetry.js';

vi.mock('@/utils/telemetry.js', () => ({
	telemetry: { trackEvent: vi.fn(async () => {}) },
}));

const native = vi.hoisted(() => ({ version: vi.fn(), reload: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: native.version }));
vi.mock('@/utils/error.js', () => ({ handleError: vi.fn() }));
vi.mock('svelte-spa-router', () => ({
	push: vi.fn(async (route: string) => {
		window.location.hash = route;
	}),
	replace: vi.fn(async (route: string) => {
		window.location.hash = route;
	}),
}));

let store: typeof import('./whatsNew.svelte.js').whatsNewStore;
let saved: ReleaseHistory;
let save: ReturnType<typeof vi.fn>;

beforeEach(async () => {
	vi.resetModules();
	vi.mocked(telemetry.trackEvent).mockReset().mockResolvedValue(undefined);
	saved = emptyReleaseHistory();
	native.version.mockReset().mockResolvedValue('2.6.0');
	save = vi.fn(async (_key, value) => {
		saved = structuredClone(value);
	});
	const { setPreferenceManagerForTest } = await import('@/utils/appServices.js');
	setPreferenceManagerForTest({
		get: () => saved,
		setAndSave: save,
	} as never);
	store = (await import('./whatsNew.svelte.js')).whatsNewStore;
	window.location.hash = '#/read';
});

it('records a successful launch, defers acknowledgement until rendering, and returns to the launch route', async () => {
	await store.initialize(false);
	expect(saved.pending?.to).toBe('2.6.0');
	expect(saved.handledThroughVersion).toBeNull();
	await store.openPending();
	expect(window.location.hash).toBe('#/whats-new');
	await store.markPresented();
	expect(saved.handledThroughVersion).toBe('2.6.0');
	expect(saved.pending).toBeNull();
	await store.continue();
	expect(window.location.hash).toBe('#/read');
});

it('never opens automatically after first setup, including the next startup', async () => {
	await store.initialize(true);
	await store.initialize(false);
	await store.openPending();
	expect(window.location.hash).toBe('#/read');
});

it('does not acknowledge notes merely because their route was opened', async () => {
	await store.initialize(false);
	await store.openPending();
	await store.continue();
	expect(saved.pending).not.toBeNull();
});

it('allows a developer preview without changing history', async () => {
	await store.open(true);
	await store.markPresented();
	expect(save).not.toHaveBeenCalled();
});

it('keeps the pending durable record if acknowledgement cannot save', async () => {
	await store.initialize(false);
	await store.openPending();
	save.mockRejectedValueOnce(new Error('disk full'));
	await store.markPresented();
	expect(saved.pending).not.toBeNull();
	expect(saved.handledThroughVersion).toBeNull();
	await store.continue();
	expect(window.location.hash).toBe('#/read');
});

it('does not intercept startup if version lookup or history saving fails', async () => {
	native.version.mockRejectedValueOnce(new Error('native unavailable'));
	await store.initialize(false);
	await store.openPending();
	expect(window.location.hash).toBe('#/read');
	expect(save).not.toHaveBeenCalled();
});

it('restores the presentation and position after following a settings link', async () => {
	await store.initialize(false);
	await store.openPending();
	store.position = 450;
	window.location.hash = '#/settings?section=help&from=whats-new';
	await store.back();
	expect(window.location.hash).toBe('#/whats-new');
	expect(store.range?.to).toBe('2.6.0');
	expect(store.position).toBe(450);
	await store.continue();
	expect(window.location.hash).toBe('#/read');
});

it('rejects invalid or newer simulation baselines without changing preferences', async () => {
	await expect(store.simulateUpdate('2.7.0')).rejects.toThrow('older than');
	await expect(store.simulateUpdate('invalid')).rejects.toThrow('older than');
	expect(save).not.toHaveBeenCalled();
});

it('reports actual presentation and Continue once with the upgrade range, never private return routes', async () => {
	saved.lastOpenedVersion = '2.5.3';
	await store.initialize(false, '/read/document/private-id');
	await store.openPending();
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	await store.markPresented();
	await store.markPresented();
	store.position = 250;
	await store.back();
	await store.markPresented();
	await store.continue();
	await store.continue();
	expect(vi.mocked(telemetry.trackEvent).mock.calls).toEqual([
		['whats_new.viewed', { from_version: '2.5.3', to_version: '2.6.0', source: 'update' }],
		[
			'whats_new.continued',
			{
				from_version: '2.5.3',
				to_version: '2.6.0',
				source: 'update',
				content_presented: true,
				expanded: false,
			},
		],
	]);
});

it('counts manual replays even if release history is already acknowledged', async () => {
	await store.initialize(true);
	await store.open();
	await store.markPresented();
	await store.continue();
	await store.open();
	await store.markPresented();
	expect(
		vi.mocked(telemetry.trackEvent).mock.calls.filter(([name]) => name === 'whats_new.viewed')
	).toEqual([
		['whats_new.viewed', { from_version: null, to_version: '2.6.0', source: 'settings' }],
		['whats_new.viewed', { from_version: null, to_version: '2.6.0', source: 'settings' }],
	]);
});

it('records disclosure and configured settings-link interactions without redundant assignments', async () => {
	await store.open();
	await store.markPresented();
	store.expanded = true;
	store.expanded = true;
	store.expanded = false;
	store.disclose('earlier', true);
	store.action('appearance', 'contrast');
	const interactions = vi.mocked(telemetry.trackEvent).mock.calls.slice(1);
	expect(interactions.map(([name]) => name)).toEqual([
		'whats_new.disclosure_changed',
		'whats_new.disclosure_changed',
		'whats_new.disclosure_changed',
		'whats_new.action',
	]);
	expect(interactions.map(([, payload]) => payload)).toEqual([
		expect.objectContaining({ section: 'improvements', expanded: true }),
		expect.objectContaining({ section: 'improvements', expanded: false }),
		expect.objectContaining({ section: 'earlier', expanded: true }),
		expect.objectContaining({ target_section: 'appearance', target_setting: 'contrast' }),
	]);
});

it('keeps developer previews out of release-note events and distinguishes unavailable content', async () => {
	await store.open(true);
	await store.markPresented();
	store.expanded = true;
	store.disclose('earlier', true);
	store.action('appearance', 'contrast');
	await store.continue();
	expect(telemetry.trackEvent).not.toHaveBeenCalled();
	await store.open();
	await store.continue();
	expect(telemetry.trackEvent).toHaveBeenCalledExactlyOnceWith('whats_new.continued', {
		from_version: null,
		to_version: '2.6.0',
		source: 'settings',
		content_presented: false,
		expanded: false,
	});
});

it('keeps navigation and durable acknowledgement working when telemetry fails', async () => {
	vi.mocked(telemetry.trackEvent).mockRejectedValue(new Error('Unavailable'));
	await store.initialize(false);
	await store.openPending();
	await store.markPresented();
	await store.continue();
	expect(saved.handledThroughVersion).toBe('2.6.0');
	expect(window.location.hash).toBe('#/read');
});
