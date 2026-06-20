import { snapSheetDrag } from '@/actions/snapSheetDrag.svelte.js';

function createOptions(overrides = {}) {
	let currentHeight = 200;
	return {
		getCurrentHeight: () => currentHeight,
		getMinHeight: () => 110,
		getMaxHeight: () => 800,
		isAtMaxSnap: () => false,
		onDragStart: vi.fn(),
		onDragMove: vi.fn((height) => {
			currentHeight = height;
		}),
		onDragEnd: vi.fn(),
		...overrides,
	};
}

function dispatchTouchEvent(
	node,
	type,
	{ clientY, identifier = 1, target = node, touchCount = 1, timeStamp = 0 }
) {
	const touch = { identifier, clientY, target };
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		touches: { value: touchCount > 0 ? new Array(touchCount).fill(touch) : [] },
		changedTouches: { value: [touch] },
		timeStamp: { value: timeStamp },
	});
	const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
	node.dispatchEvent(event);
	return { event, preventDefaultSpy };
}

it('grows the sheet on an upward body drag', () => {
	const node = document.createElement('div');
	const options = createOptions();
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, timeStamp: 0 });
	const { preventDefaultSpy } = dispatchTouchEvent(node, 'touchmove', {
		clientY: 400,
		timeStamp: 16,
	});
	dispatchTouchEvent(node, 'touchend', { clientY: 400, timeStamp: 32 });

	expect(options.onDragStart).toHaveBeenCalledWith(200);
	// 200 - deltaY(-100) = 300, clamped within [110, 800].
	expect(options.onDragMove).toHaveBeenCalledWith(300);
	expect(preventDefaultSpy).toHaveBeenCalled();
	expect(options.onDragEnd).toHaveBeenCalledTimes(1);
	const [releaseHeight, velocity] = options.onDragEnd.mock.calls[0];
	expect(releaseHeight).toBe(300);
	expect(velocity).toBeGreaterThan(0); // upward flick
	action.destroy();
});

it('collapses the sheet on a downward drag when content is at the top', () => {
	const node = document.createElement('div');
	const options = createOptions();
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 400, timeStamp: 0 });
	const { preventDefaultSpy } = dispatchTouchEvent(node, 'touchmove', {
		clientY: 500,
		timeStamp: 16,
	});
	dispatchTouchEvent(node, 'touchend', { clientY: 500, timeStamp: 32 });

	expect(options.onDragStart).toHaveBeenCalledWith(200);
	// 200 - deltaY(100) = 100, clamped up to the 110 minimum.
	expect(options.onDragMove).toHaveBeenCalledWith(110);
	expect(preventDefaultSpy).toHaveBeenCalled();
	expect(options.onDragEnd).toHaveBeenCalledTimes(1);
	action.destroy();
});

it('lets content scroll instead of dragging when already at the max snap and pulling up', () => {
	const node = document.createElement('div');
	const options = createOptions({ isAtMaxSnap: () => true });
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, timeStamp: 0 });
	const { preventDefaultSpy } = dispatchTouchEvent(node, 'touchmove', {
		clientY: 400,
		timeStamp: 16,
	});
	dispatchTouchEvent(node, 'touchend', { clientY: 400, timeStamp: 32 });

	expect(options.onDragStart).not.toHaveBeenCalled();
	expect(options.onDragMove).not.toHaveBeenCalled();
	expect(options.onDragEnd).not.toHaveBeenCalled();
	expect(preventDefaultSpy).not.toHaveBeenCalled();
	action.destroy();
});

it('ignores small movements below the drag threshold', () => {
	const node = document.createElement('div');
	const options = createOptions();
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, timeStamp: 0 });
	dispatchTouchEvent(node, 'touchmove', { clientY: 497, timeStamp: 16 });

	expect(options.onDragStart).not.toHaveBeenCalled();
	expect(options.onDragMove).not.toHaveBeenCalled();
	action.destroy();
});

it('ignores touches that start on the drag handle', () => {
	const node = document.createElement('div');
	const handle = document.createElement('div');
	handle.className = 'sy-snap-sheet__handle';
	node.appendChild(handle);
	const options = createOptions();
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, target: handle, timeStamp: 0 });
	dispatchTouchEvent(node, 'touchmove', { clientY: 400, target: handle, timeStamp: 16 });

	expect(options.onDragStart).not.toHaveBeenCalled();
	expect(options.onDragMove).not.toHaveBeenCalled();
	action.destroy();
});

it('abandons the gesture on multi-touch', () => {
	const node = document.createElement('div');
	const options = createOptions();
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, touchCount: 2, timeStamp: 0 });
	dispatchTouchEvent(node, 'touchmove', { clientY: 400, timeStamp: 16 });

	expect(options.onDragStart).not.toHaveBeenCalled();
	expect(options.onDragMove).not.toHaveBeenCalled();
	action.destroy();
});

it('does nothing when disabled', () => {
	const node = document.createElement('div');
	const options = createOptions({ enabled: false });
	const action = snapSheetDrag(node, options);

	dispatchTouchEvent(node, 'touchstart', { clientY: 500, timeStamp: 0 });
	dispatchTouchEvent(node, 'touchmove', { clientY: 400, timeStamp: 16 });

	expect(options.onDragStart).not.toHaveBeenCalled();
	expect(options.onDragMove).not.toHaveBeenCalled();
	action.destroy();
});
