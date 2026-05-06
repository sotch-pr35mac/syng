import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { vi } from 'vitest';
import SyPopover from '@/components/SyPopover/SyPopover.svelte';

vi.mock('@tauri-apps/plugin-os', () => ({
	platform: vi.fn(() => 'unknown'),
}));

const ANCHOR = {
	left: 120,
	right: 180,
	top: 100,
	bottom: 130,
	width: 60,
	height: 30,
};

it('should render only when visible', async () => {
	const { container, rerender } = render(SyPopover, {
		props: {
			visible: false,
			anchor: ANCHOR,
		},
	});

	expect(container.querySelector('.sy-popover')).toBeNull();

	await rerender({
		visible: true,
		anchor: ANCHOR,
	});

	expect(container.querySelector('.sy-popover')).not.toBeNull();
});

it('should position the desktop popover with an arrow placement class', () => {
	const { container } = render(SyPopover, {
		props: {
			visible: true,
			anchor: ANCHOR,
			width: 240,
			height: 160,
		},
	});
	const popover = container.querySelector('.sy-popover');

	expect(popover.classList.contains('sy-popover--below')).toBe(true);
	expect(popover.style.width).toBe('240px');
	expect(popover.style.height).toBe('160px');
	expect(popover.getAttribute('style')).toContain('--sy-popover-arrow-x');
});

it('should use fit-content sizing when width is not fixed', () => {
	const { container } = render(SyPopover, {
		props: {
			visible: true,
			anchor: ANCHOR,
		},
	});
	const popover = container.querySelector('.sy-popover');

	expect(popover.style.width).toBe('fit-content');
});

it('should support end-aligned horizontal placement', () => {
	const { container } = render(SyPopover, {
		props: {
			visible: true,
			anchor: {
				left: 900,
				right: 940,
				top: 100,
				bottom: 130,
				width: 40,
				height: 30,
			},
			width: 240,
			height: 160,
			horizontalAlign: 'end',
		},
	});
	const popover = container.querySelector('.sy-popover');

	expect(popover.style.left).toBe('700px');
	expect(popover.getAttribute('style')).toContain('--sy-popover-arrow-x: 220px');
});

it('should call onclose after a desktop outside click', async () => {
	const onclose = vi.fn();
	render(SyPopover, {
		props: {
			visible: true,
			anchor: ANCHOR,
			onclose,
		},
	});

	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await fireEvent.click(document.body);

	expect(onclose).toHaveBeenCalled();
});

it('should ignore outside clicks on the ignored element', async () => {
	const onclose = vi.fn();
	const ignoredElement = document.createElement('button');
	document.body.appendChild(ignoredElement);
	render(SyPopover, {
		props: {
			visible: true,
			anchor: ANCHOR,
			ignoreElement: ignoredElement,
			onclose,
		},
	});

	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await fireEvent.click(ignoredElement);

	expect(onclose).not.toHaveBeenCalled();
	ignoredElement.remove();
});
