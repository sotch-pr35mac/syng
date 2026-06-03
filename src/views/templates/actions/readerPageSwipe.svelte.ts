import type { Action } from 'svelte/action';

export type ReaderPageSwipeDirection = 'next' | 'previous';

export type ReaderPageSwipeOptions = {
	onTurnPage?: (_direction: ReaderPageSwipeDirection) => void | Promise<void>;
	enabled?: boolean;
	acceptedPointerTypes?: readonly string[];
	minSwipeDistance?: number;
	maxVerticalDrift?: number;
};

type ResolvedReaderPageSwipeOptions = {
	onTurnPage: (_direction: ReaderPageSwipeDirection) => void | Promise<void>;
	enabled: boolean;
	acceptedPointerTypes?: readonly string[];
	minSwipeDistance: number;
	maxVerticalDrift: number;
};

const MIN_SWIPE_DISTANCE_PX = 70;
const MAX_VERTICAL_DRIFT_PX = 60;

function resolveOptions(
	options: ReaderPageSwipeOptions | undefined
): ResolvedReaderPageSwipeOptions {
	return {
		onTurnPage: options?.onTurnPage ?? (() => {}),
		enabled: options?.enabled ?? true,
		acceptedPointerTypes: options?.acceptedPointerTypes,
		minSwipeDistance: options?.minSwipeDistance ?? MIN_SWIPE_DISTANCE_PX,
		maxVerticalDrift: options?.maxVerticalDrift ?? MAX_VERTICAL_DRIFT_PX,
	};
}

function isAcceptedPointer(settings: ResolvedReaderPageSwipeOptions, event: PointerEvent): boolean {
	return (
		settings.acceptedPointerTypes === undefined ||
		settings.acceptedPointerTypes.includes(event.pointerType)
	);
}

export const readerPageSwipe: Action<HTMLElement, ReaderPageSwipeOptions | undefined> = (
	node,
	options
) => {
	let settings = resolveOptions(options);
	let activePointerId: number | null = null;
	let gestureStartX = 0;
	let gestureStartY = 0;

	function handlePointerDown(event: PointerEvent): void {
		if (!settings.enabled || !isAcceptedPointer(settings, event)) {
			return;
		}

		activePointerId = event.pointerId;
		gestureStartX = event.clientX;
		gestureStartY = event.clientY;
	}

	function handlePointerUp(event: PointerEvent): void {
		if (activePointerId !== event.pointerId) {
			return;
		}

		activePointerId = null;

		if (!settings.enabled || !isAcceptedPointer(settings, event)) {
			return;
		}

		const deltaX = event.clientX - gestureStartX;
		const deltaY = event.clientY - gestureStartY;
		if (
			Math.abs(deltaX) < settings.minSwipeDistance ||
			Math.abs(deltaY) > settings.maxVerticalDrift
		) {
			return;
		}

		void settings.onTurnPage(deltaX < 0 ? 'next' : 'previous');
	}

	function handlePointerCancel(event: PointerEvent): void {
		if (activePointerId === event.pointerId) {
			activePointerId = null;
		}
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('pointerup', handlePointerUp);
	node.addEventListener('pointercancel', handlePointerCancel);

	return {
		update(newOptions) {
			settings = resolveOptions(newOptions);
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('pointerup', handlePointerUp);
			node.removeEventListener('pointercancel', handlePointerCancel);
		},
	};
};
