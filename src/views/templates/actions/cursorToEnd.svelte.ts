import type { Action } from 'svelte/action';
import { isMobile } from '@/utils/device.js';

// Input types whose value supports text selection. setSelectionRange throws for others
// (number, email, date, …), so we only touch the caret for these and textareas.
const SELECTABLE_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);

function supportsSelection(element: HTMLInputElement | HTMLTextAreaElement): boolean {
	if (element instanceof HTMLTextAreaElement) {
		return true;
	}
	return SELECTABLE_INPUT_TYPES.has(element.type);
}

/**
 * Svelte action that, on mobile, moves the caret to the END of any existing text when a field
 * gains focus — instead of the browser default of the start. Tapping into a populated field
 * (e.g. an existing search query) then lets the user edit from the end rather than the
 * beginning. A later tap inside the already-focused field still repositions the caret normally,
 * because `focus` only fires on the initial entry.
 *
 * No-op on desktop. Attach via `use:cursorToEnd` to an <input> or <textarea>.
 */
export const cursorToEnd: Action<HTMLInputElement | HTMLTextAreaElement> = (node) => {
	function moveCaretToEnd(): void {
		if (!isMobile() || !supportsSelection(node)) {
			return;
		}
		// Defer to the next frame so the browser's own focus/tap caret placement has settled
		// before we override it; otherwise the platform may re-place the caret after us.
		requestAnimationFrame(() => {
			const end = node.value.length;
			try {
				node.setSelectionRange(end, end);
			} catch {
				// Some elements still reject setSelectionRange; leave the caret where it is.
			}
		});
	}

	node.addEventListener('focus', moveCaretToEnd);

	return {
		destroy() {
			node.removeEventListener('focus', moveCaretToEnd);
		},
	};
};
