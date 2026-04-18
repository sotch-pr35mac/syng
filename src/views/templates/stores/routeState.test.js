import { createRouteState } from './routeState.svelte.js';

const UPDATED_NUMBER = 42;

it('should return the initial value', () => {
	const store = createRouteState('hello');
	expect(store.value).toBe('hello');
});

it('should update the value after set()', () => {
	const store = createRouteState(0);
	store.set(UPDATED_NUMBER);
	expect(store.value).toBe(UPDATED_NUMBER);
});

it('should accept complex initial values', () => {
	const store = createRouteState({ name: 'test', count: 0 });
	expect(store.value).toEqual({ name: 'test', count: 0 });
});

it('should update complex values', () => {
	const store = createRouteState({ name: 'test', count: 0 });
	store.set({ name: 'updated', count: 5 });
	expect(store.value).toEqual({ name: 'updated', count: 5 });
});

it('should accept undefined as a valid value', () => {
	const store = createRouteState(undefined);
	expect(store.value).toBeUndefined();
	store.set('defined');
	expect(store.value).toBe('defined');
});

it('should maintain independent state across separate instances', () => {
	const storeA = createRouteState('a');
	const storeB = createRouteState('b');
	storeA.set('updated-a');
	// storeB should not be affected by storeA's mutation
	expect(storeB.value).toBe('b');
	expect(storeA.value).toBe('updated-a');
});
