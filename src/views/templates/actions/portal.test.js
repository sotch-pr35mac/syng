import { portal } from '@/actions/portal.svelte.js';

it('moves the host element to document.body on mount', () => {
	const parent = document.createElement('div');
	const node = document.createElement('div');
	parent.appendChild(node);
	document.body.appendChild(parent);

	const action = portal(node);

	expect(node.parentElement).toBe(document.body);
	action.destroy();
	parent.remove();
});

it('moves the host element to an explicit target when provided', () => {
	const target = document.createElement('section');
	document.body.appendChild(target);
	const node = document.createElement('div');

	const action = portal(node, target);

	expect(node.parentElement).toBe(target);
	action.destroy();
	target.remove();
});

it('removes the host element from the document on destroy', () => {
	const node = document.createElement('div');
	const action = portal(node);
	expect(node.parentElement).toBe(document.body);

	action.destroy();

	expect(node.isConnected).toBe(false);
});
