import type { ReaderLookupTarget } from '@/reader/types.js';

const WORD_BOUNDARY_PATTERN = /[\s，。！？、；：,.!?;:()[\]{}"“”‘’]/u;
const HAN_SCRIPT_PATTERN = /\p{Script=Han}/u;

function findTextNodeAtPoint(root: Document | ShadowRoot, x: number, y: number): Range | undefined {
	const position = document.caretPositionFromPoint?.(x, y);
	if (position?.offsetNode.nodeType === Node.TEXT_NODE) {
		const range = document.createRange();
		range.setStart(position.offsetNode, position.offset);
		range.collapse(true);
		return range;
	}

	const legacyRange = document.caretRangeFromPoint?.(x, y);
	if (legacyRange?.startContainer.nodeType === Node.TEXT_NODE) {
		return legacyRange;
	}

	const element = root.elementFromPoint?.(x, y);
	const textNode = Array.from(element?.childNodes ?? []).find(
		(node) => node.nodeType === Node.TEXT_NODE
	);
	if (!textNode) {
		return undefined;
	}
	const range = document.createRange();
	range.setStart(textNode, 0);
	range.collapse(true);
	return range;
}

function getGraphemeRangeAtOffset(
	text: string,
	offset: number
): { start: number; end: number } | undefined {
	if (!text.length || offset < 0 || offset > text.length) {
		return undefined;
	}
	if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
		const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
		for (const segment of segmenter.segment(text)) {
			const segmentEnd = segment.index + segment.segment.length;
			if (offset >= segment.index && offset < segmentEnd) {
				return { start: segment.index, end: segmentEnd };
			}
		}
	}
	const codePoint = text.codePointAt(offset);
	if (codePoint === undefined) {
		return undefined;
	}
	const supplementaryPlaneStart = 0x10000;
	const codeUnitLength = codePoint >= supplementaryPlaneStart ? 2 : 1;
	return { start: offset, end: Math.min(text.length, offset + codeUnitLength) };
}

function expandRangeToToken(range: Range): Range | undefined {
	const node = range.startContainer;
	if (node.nodeType !== Node.TEXT_NODE || !node.textContent) {
		return undefined;
	}

	const text = node.textContent;
	let start = range.startOffset;
	let end = range.startOffset;

	while (start > 0 && !WORD_BOUNDARY_PATTERN.test(text[start - 1])) {
		start -= 1;
	}
	while (end < text.length && !WORD_BOUNDARY_PATTERN.test(text[end])) {
		end += 1;
	}

	if (start === end) {
		return undefined;
	}

	const candidate = text.slice(start, end);
	if (candidate.length > 1 && HAN_SCRIPT_PATTERN.test(candidate)) {
		const graphemeRange = getGraphemeRangeAtOffset(text, range.startOffset);
		if (graphemeRange) {
			start = graphemeRange.start;
			end = graphemeRange.end;
		}
	}

	if (start === end) {
		return undefined;
	}

	const tokenRange = document.createRange();
	tokenRange.setStart(node, start);
	tokenRange.setEnd(node, end);
	return tokenRange;
}

export function getLookupTargetFromPoint(
	root: Document | ShadowRoot,
	x: number,
	y: number,
	resourceHref: string
): ReaderLookupTarget | undefined {
	const caretRange = findTextNodeAtPoint(root, x, y);
	if (!caretRange) {
		return undefined;
	}

	const tokenRange = expandRangeToToken(caretRange);
	const text = tokenRange?.toString().trim();
	if (!tokenRange || !text) {
		return undefined;
	}

	return {
		text,
		range: tokenRange,
		anchor: tokenRange.getBoundingClientRect(),
		resourceHref,
		offset: tokenRange.startOffset,
	};
}
