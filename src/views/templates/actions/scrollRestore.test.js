import { scrollRestore, clearScrollPositions } from '@/actions/scrollRestore.svelte.js';

const RESTORED_SCROLL_TOP = 200;
const SAVED_SCROLL_TOP = 350;
const KEY_B_SCROLL_TOP = 500;
const UPDATED_KEY_SCROLL_TOP = 80;

// Patch requestAnimationFrame in jsdom to run synchronously so restore executes
// immediately within each test without needing async waits.
global.requestAnimationFrame = (cb) => cb();

function makeScrollable(scrollTop = 0) {
	const node = document.createElement('div');
	Object.defineProperty(node, 'scrollTop', {
		writable: true,
		configurable: true,
		value: scrollTop,
	});
	return node;
}

beforeEach(() => {
	clearScrollPositions();
});

it('should not change scrollTop when no saved position exists for the key', () => {
	const node = makeScrollable(0);
	const action = scrollRestore(node, 'fresh-key');
	// requestAnimationFrame runs synchronously; no saved value → scrollTop stays 0
	expect(node.scrollTop).toBe(0);
	action.destroy();
});

it('should restore a previously saved scroll position on mount', () => {
	const KEY = 'restore-test';

	// First lifecycle: scroll down and destroy to save the position
	const firstNode = makeScrollable(0);
	const firstAction = scrollRestore(firstNode, KEY);
	firstNode.scrollTop = RESTORED_SCROLL_TOP;
	firstAction.destroy();

	// Second lifecycle: a fresh node should have its scrollTop restored
	const secondNode = makeScrollable(0);
	scrollRestore(secondNode, KEY);
	expect(secondNode.scrollTop).toBe(RESTORED_SCROLL_TOP);
});

it('should save the scroll position on destroy', () => {
	const KEY = 'save-test';
	const node = makeScrollable(0);
	const action = scrollRestore(node, KEY);

	node.scrollTop = SAVED_SCROLL_TOP;
	action.destroy();

	// Mount a fresh node with the same key to verify the position was saved
	const nextNode = makeScrollable(0);
	scrollRestore(nextNode, KEY);
	expect(nextNode.scrollTop).toBe(SAVED_SCROLL_TOP);
});

it('should keep separate scroll positions for different keys', () => {
	const nodeA = makeScrollable(0);
	const actionA = scrollRestore(nodeA, 'key-a');
	nodeA.scrollTop = 100;
	actionA.destroy();

	const nodeB = makeScrollable(0);
	const actionB = scrollRestore(nodeB, 'key-b');
	nodeB.scrollTop = KEY_B_SCROLL_TOP;
	actionB.destroy();

	const restoredA = makeScrollable(0);
	scrollRestore(restoredA, 'key-a');
	const restoredB = makeScrollable(0);
	scrollRestore(restoredB, 'key-b');

	expect(restoredA.scrollTop).toBe(100);
	expect(restoredB.scrollTop).toBe(KEY_B_SCROLL_TOP);
});

it('should not restore position after clearScrollPositions() is called', () => {
	const KEY = 'clear-test';
	const node = makeScrollable(0);
	const action = scrollRestore(node, KEY);
	node.scrollTop = 150;
	action.destroy();

	clearScrollPositions();

	const freshNode = makeScrollable(0);
	scrollRestore(freshNode, KEY);
	expect(freshNode.scrollTop).toBe(0);
});

it('update() should switch to the new key without affecting the old one', () => {
	const node = makeScrollable(0);
	const action = scrollRestore(node, 'original-key');
	node.scrollTop = UPDATED_KEY_SCROLL_TOP;

	// Switch to a different key
	action.update('new-key');
	action.destroy();

	// original-key should not have been saved (destroy used new-key)
	const nodeForOriginal = makeScrollable(0);
	scrollRestore(nodeForOriginal, 'original-key');
	expect(nodeForOriginal.scrollTop).toBe(0);

	// new-key should have been saved
	const nodeForNew = makeScrollable(0);
	scrollRestore(nodeForNew, 'new-key');
	expect(nodeForNew.scrollTop).toBe(UPDATED_KEY_SCROLL_TOP);
});
