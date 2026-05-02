import DOMPurify from 'dompurify';

const HOOK_NAME = 'uponSanitizeAttribute';

function stripNavigationAttributes(
	node: Element,
	data: { attrName: string; keepAttr?: boolean }
): void {
	const tagName = node.tagName?.toLowerCase();
	if (tagName === 'a' || tagName === 'area') {
		if (data.attrName === 'href' || data.attrName === 'xlink:href') {
			data.keepAttr = false;
		}
	}
	if (tagName === 'a') {
		if (
			data.attrName === 'target' ||
			data.attrName === 'download' ||
			data.attrName === 'ping' ||
			data.attrName === 'rel'
		) {
			data.keepAttr = false;
		}
	}
}

/**
 * Sanitize reflowable reader HTML and drop attributes that would navigate
 * the Tauri webview when tapped (links, downloads, ping).
 */
export function sanitizeReflowableReaderHtml(
	html: string,
	options: { allowStyleTag?: boolean } = {}
): string {
	const hook = (node: Element, data: { attrName: string; keepAttr?: boolean }): void => {
		stripNavigationAttributes(node, data);
	};
	DOMPurify.addHook(HOOK_NAME, hook);
	try {
		return DOMPurify.sanitize(html, {
			USE_PROFILES: { html: true },
			...(options.allowStyleTag ? { ADD_TAGS: ['style'] } : {}),
		});
	} finally {
		DOMPurify.removeHook(HOOK_NAME, hook);
	}
}
