import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
import { COLLAPSED_HEIGHT, FULL_HEIGHT_RATIO } from '@/types/snapSheet.js';

const PARTIAL_HEIGHT_RATIO = 0.38;
const DRAG_START_Y = 700;
const DRAG_END_Y = 100;

// The sheet is rendered at full height and revealed by translating down, so the snap position
// is encoded in the hidden-height property used by the transform and empty-state layout.
const FULL_HEIGHT = Math.round(window.innerHeight * FULL_HEIGHT_RATIO);
const PARTIAL_HEIGHT = Math.round(window.innerHeight * PARTIAL_HEIGHT_RATIO);
const expectSnapHeight = (sheet, height) => {
	const offset = Math.max(0, FULL_HEIGHT - height);
	expect(sheet.style.getPropertyValue('--sy-snap-sheet-hidden-height')).toBe(`${offset}px`);
};

it('should render at the collapsed height by default', () => {
	const { container } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	expectSnapHeight(sheet, COLLAPSED_HEIGHT);
});

it('should render at the initial snap height when provided', () => {
	const { container } = render(SySnapSheet, { initialSnap: 'partial' });
	const sheet = container.querySelector('.sy-snap-sheet');
	expectSnapHeight(sheet, PARTIAL_HEIGHT);
});

it('should render the drag handle with correct accessibility attributes', () => {
	const { container } = render(SySnapSheet);
	const handle = container.querySelector('.sy-snap-sheet__handle');
	expect(handle.getAttribute('role')).toBe('separator');
	expect(handle.getAttribute('aria-label')).toBe('Resize panel');
});

it('should apply the transition class when not dragging', () => {
	const { container } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	expect(sheet.classList.contains('sy-snap-sheet--transitioning')).toBe(true);
});

it('should open to partial height when openPartial is called', async () => {
	const { container, component } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	await component.openPartial();
	expectSnapHeight(sheet, PARTIAL_HEIGHT);
});

it('should open to full height when openFull is called', async () => {
	const { container, component } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	await component.openFull();
	expectSnapHeight(sheet, FULL_HEIGHT);
});

it('should collapse to the collapsed height when collapse is called', async () => {
	const { container, component } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	await component.openFull();
	await component.collapse();
	expectSnapHeight(sheet, COLLAPSED_HEIGHT);
});

it('should fire the onSnapChange callback when the snap position changes', async () => {
	const onSnapChange = vi.fn();
	const { component } = render(SySnapSheet, { onSnapChange });
	await component.openPartial();
	expect(onSnapChange).toHaveBeenCalledWith('partial');
	await component.openFull();
	expect(onSnapChange).toHaveBeenCalledWith('full');
	await component.collapse();
	expect(onSnapChange).toHaveBeenCalledWith('collapsed');
});

it('should pop up to partial when reopenKey changes while collapsed', async () => {
	const { container, rerender } = render(SySnapSheet, { reopenKey: 1 });
	const sheet = container.querySelector('.sy-snap-sheet');
	// Does not fire on first mount.
	expectSnapHeight(sheet, COLLAPSED_HEIGHT);

	await rerender({ reopenKey: 2 });
	expectSnapHeight(sheet, PARTIAL_HEIGHT);
});

it('should not shrink a full sheet when reopenKey changes', async () => {
	const { container, rerender } = render(SySnapSheet, { initialSnap: 'full', reopenKey: 1 });
	const sheet = container.querySelector('.sy-snap-sheet');
	expectSnapHeight(sheet, FULL_HEIGHT);

	await rerender({ initialSnap: 'full', reopenKey: 2 });
	expectSnapHeight(sheet, FULL_HEIGHT);
});

it('should resize from pointer drag gestures on the handle', async () => {
	const onSnapChange = vi.fn();
	const { container } = render(SySnapSheet, { onSnapChange });
	const sheet = container.querySelector('.sy-snap-sheet');
	const handle = container.querySelector('.sy-snap-sheet__handle');

	handle.setPointerCapture = vi.fn();
	handle.releasePointerCapture = vi.fn();

	const dispatchPointerEvent = async (type, clientY) => {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			pointerId: { value: 1 },
			clientY: { value: clientY },
		});
		await fireEvent(handle, event);
	};

	await dispatchPointerEvent('pointerdown', DRAG_START_Y);
	await dispatchPointerEvent('pointermove', DRAG_END_Y);
	expect(sheet.classList.contains('sy-snap-sheet--transitioning')).toBe(false);
	// Dragging up from collapsed by 600px clamps to the full height (offset 0).
	expectSnapHeight(sheet, FULL_HEIGHT);

	await dispatchPointerEvent('pointerup', DRAG_END_Y);
	expect(onSnapChange).toHaveBeenCalledWith('full');
});

it('exposes the resize state and supports keyboard resizing without changing drag behavior', async () => {
	const { getByRole, container } = render(SySnapSheet);
	const handle = getByRole('separator', { name: 'Resize panel' });
	const sheet = container.querySelector('.sy-snap-sheet');
	expect(handle.getAttribute('tabindex')).toBe('0');
	await fireEvent.keyDown(handle, { key: 'ArrowUp' });
	expectSnapHeight(sheet, PARTIAL_HEIGHT);
	expect(handle.getAttribute('aria-valuetext')).toBe('partial');
	await fireEvent.keyDown(handle, { key: 'End' });
	expectSnapHeight(sheet, FULL_HEIGHT);
	await fireEvent.keyDown(handle, { key: 'Escape' });
	expectSnapHeight(sheet, COLLAPSED_HEIGHT);
});

it('reveals keyboard-focused content and returns focus to the visible handle on Escape', async () => {
	vi.useFakeTimers();
	document.documentElement.dataset.inputModality = 'keyboard';
	try {
		const { getByRole } = render(SySnapSheet);
		const sheet = getByRole('dialog');
		const handle = getByRole('separator', { name: 'Resize panel' });
		const childButton = document.createElement('button');
		childButton.textContent = 'Sheet content action';
		sheet.append(childButton);
		childButton.focus();
		await tick();
		await vi.advanceTimersByTimeAsync(0);
		expectSnapHeight(sheet, FULL_HEIGHT);
		expect(document.activeElement).toBe(childButton);
		await fireEvent.keyDown(childButton, { key: 'Escape' });
		expectSnapHeight(sheet, COLLAPSED_HEIGHT);
		expect(document.activeElement).toBe(handle);
	} finally {
		delete document.documentElement.dataset.inputModality;
		vi.useRealTimers();
	}
});

it('preserves the existing snap when pointer interaction focuses content', async () => {
	document.documentElement.dataset.inputModality = 'pointer';
	try {
		const { getByRole } = render(SySnapSheet, { initialSnap: 'partial' });
		const sheet = getByRole('dialog');
		const childButton = document.createElement('button');
		sheet.append(childButton);
		childButton.focus();
		await tick();
		expectSnapHeight(sheet, PARTIAL_HEIGHT);
	} finally {
		delete document.documentElement.dataset.inputModality;
	}
});

it.each(['collapsed', 'partial'])(
	'keeps the %s snap when a mobile tap focuses the dialog wrapper',
	async (initialSnap) => {
		document.documentElement.dataset.inputModality = 'pointer';
		try {
			const onSnapChange = vi.fn();
			const { getByRole } = render(SySnapSheet, { initialSnap, onSnapChange });
			const sheet = getByRole('dialog');
			const snapHeight = initialSnap === 'collapsed' ? COLLAPSED_HEIGHT : PARTIAL_HEIGHT;
			const top = window.innerHeight - snapHeight;
			// The translated wrapper remains full-height, even when only its header
			// is visible. Its bottom extending offscreen must not count as hidden focus.
			sheet.getBoundingClientRect = () => ({ top, bottom: top + FULL_HEIGHT });
			sheet.focus();
			await tick();
			expectSnapHeight(sheet, snapHeight);
			expect(onSnapChange).not.toHaveBeenCalled();
		} finally {
			delete document.documentElement.dataset.inputModality;
		}
	}
);

it('reveals offscreen assistive-technology focus without requiring a keyboard event', async () => {
	document.documentElement.dataset.inputModality = 'pointer';
	try {
		const { getByRole } = render(SySnapSheet);
		const sheet = getByRole('dialog');
		const childButton = document.createElement('button');
		childButton.getBoundingClientRect = () => ({
			top: window.innerHeight,
			bottom: window.innerHeight + COLLAPSED_HEIGHT,
		});
		sheet.append(childButton);
		childButton.focus();
		await tick();
		expectSnapHeight(sheet, FULL_HEIGHT);
		expect(document.activeElement).toBe(childButton);
	} finally {
		delete document.documentElement.dataset.inputModality;
	}
});
