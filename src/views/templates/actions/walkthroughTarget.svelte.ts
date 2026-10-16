import type { Action } from 'svelte/action';
import type { WalkthroughTargetId } from '@/types/walkthrough.js';
import { walkthroughStore } from '@/stores/walkthrough.svelte.js';

export const walkthroughTarget: Action<HTMLElement, WalkthroughTargetId | undefined> = (
	element,
	identifier
) => {
	let unregister = identifier ? walkthroughStore.registerTarget(identifier, element) : undefined;
	if (identifier) {
		element.dataset.walkthroughTarget = identifier;
	}
	return {
		update(nextIdentifier) {
			unregister?.();
			delete element.dataset.walkthroughTarget;
			if (nextIdentifier) {
				element.dataset.walkthroughTarget = nextIdentifier;
			}
			unregister = nextIdentifier
				? walkthroughStore.registerTarget(nextIdentifier, element)
				: undefined;
		},
		destroy() {
			unregister?.();
		},
	};
};
