import { readerPageSwipe } from '@/actions/readerPageSwipe.svelte.js';

function dispatchPointerEvent(
	node,
	type,
	{ clientX, clientY, pointerId = 1, pointerType = 'touch' }
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		pointerId: { value: pointerId },
		pointerType: { value: pointerType },
	});
	node.dispatchEvent(event);
}

function createSwipeHost() {
	return document.createElement('div');
}

it('should turn to the next page on a leftward swipe', () => {
	const node = createSwipeHost();
	const onTurnPage = vi.fn();
	const action = readerPageSwipe(node, { onTurnPage });

	dispatchPointerEvent(node, 'pointerdown', { clientX: 180, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 80, clientY: 105 });

	expect(onTurnPage).toHaveBeenCalledTimes(1);
	expect(onTurnPage).toHaveBeenCalledWith('next');
	action.destroy();
});

it('should turn to the previous page on a rightward swipe', () => {
	const node = createSwipeHost();
	const onTurnPage = vi.fn();
	const action = readerPageSwipe(node, { onTurnPage });

	dispatchPointerEvent(node, 'pointerdown', { clientX: 80, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 170, clientY: 105 });

	expect(onTurnPage).toHaveBeenCalledTimes(1);
	expect(onTurnPage).toHaveBeenCalledWith('previous');
	action.destroy();
});

it('should ignore short or mostly vertical gestures', () => {
	const node = createSwipeHost();
	const onTurnPage = vi.fn();
	const action = readerPageSwipe(node, { onTurnPage });

	dispatchPointerEvent(node, 'pointerdown', { clientX: 180, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 130, clientY: 105 });
	dispatchPointerEvent(node, 'pointerdown', { clientX: 80, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 170, clientY: 190 });

	expect(onTurnPage).not.toHaveBeenCalled();
	action.destroy();
});

it('should respect accepted pointer types', () => {
	const node = createSwipeHost();
	const onTurnPage = vi.fn();
	const action = readerPageSwipe(node, {
		onTurnPage,
		acceptedPointerTypes: ['touch'],
	});

	dispatchPointerEvent(node, 'pointerdown', {
		clientX: 180,
		clientY: 100,
		pointerType: 'mouse',
	});
	dispatchPointerEvent(node, 'pointerup', {
		clientX: 80,
		clientY: 105,
		pointerType: 'mouse',
	});
	dispatchPointerEvent(node, 'pointerdown', { clientX: 180, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 80, clientY: 105 });

	expect(onTurnPage).toHaveBeenCalledTimes(1);
	expect(onTurnPage).toHaveBeenCalledWith('next');
	action.destroy();
});

it('should update enabled state', () => {
	const node = createSwipeHost();
	const onTurnPage = vi.fn();
	const action = readerPageSwipe(node, { onTurnPage });

	action.update({ onTurnPage, enabled: false });
	dispatchPointerEvent(node, 'pointerdown', { clientX: 180, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 80, clientY: 105 });

	action.update({ onTurnPage, enabled: true });
	dispatchPointerEvent(node, 'pointerdown', { clientX: 180, clientY: 100 });
	dispatchPointerEvent(node, 'pointerup', { clientX: 80, clientY: 105 });

	expect(onTurnPage).toHaveBeenCalledTimes(1);
	expect(onTurnPage).toHaveBeenCalledWith('next');
	action.destroy();
});
