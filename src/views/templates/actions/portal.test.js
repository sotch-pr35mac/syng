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

it('applies and restores attributes when provided', () => {
	const node = document.createElement('div');
	node.setAttribute('data-existing', 'before');

	const action = portal(node, {
		attributes: {
			'data-existing': 'after',
			'data-added': 'true',
		},
	});

	expect(node.parentElement).toBe(document.body);
	expect(node.dataset.existing).toBe('after');
	expect(node.dataset.added).toBe('true');

	action.destroy();

	expect(node.dataset.existing).toBe('before');
	expect(node.hasAttribute('data-added')).toBe(false);
});

it('removes the host element from the document on destroy', () => {
	const node = document.createElement('div');
	const action = portal(node);
	expect(node.parentElement).toBe(document.body);

	action.destroy();

	expect(node.isConnected).toBe(false);
});
