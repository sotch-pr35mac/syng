import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import SySnapSheet from '@/components/SySnapSheet/SySnapSheet.svelte';
import { COLLAPSED_HEIGHT, FULL_HEIGHT_RATIO } from '@/types/snapSheet.js';

const PARTIAL_HEIGHT_RATIO = 0.38;
const DRAG_START_Y = 700;
const DRAG_END_Y = 100;

it('should render at the collapsed height by default', () => {
	const { container } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	expect(sheet.style.height).toBe(`${COLLAPSED_HEIGHT}px`);
});

it('should render the drag handle with correct accessibility attributes', () => {
	const { container } = render(SySnapSheet);
	const handle = container.querySelector('.sy-snap-sheet__handle');
	expect(handle.getAttribute('role')).toBe('separator');
	expect(handle.getAttribute('aria-label')).toBe('Drag to resize');
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
	const expectedHeight = Math.round(window.innerHeight * PARTIAL_HEIGHT_RATIO);
	expect(sheet.style.height).toBe(`${expectedHeight}px`);
});

it('should open to full height when openFull is called', async () => {
	const { container, component } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	await component.openFull();
	const expectedHeight = Math.round(window.innerHeight * FULL_HEIGHT_RATIO);
	expect(sheet.style.height).toBe(`${expectedHeight}px`);
});

it('should collapse to the collapsed height when collapse is called', async () => {
	const { container, component } = render(SySnapSheet);
	const sheet = container.querySelector('.sy-snap-sheet');
	await component.openFull();
	await component.collapse();
	expect(sheet.style.height).toBe(`${COLLAPSED_HEIGHT}px`);
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
	expect(sheet.style.height).toBe(`${Math.round(window.innerHeight * FULL_HEIGHT_RATIO)}px`);

	await dispatchPointerEvent('pointerup', DRAG_END_Y);
	expect(onSnapChange).toHaveBeenCalledWith('full');
});
