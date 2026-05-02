import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { ReaderToken } from '@/types/reader.js';

const tokenCache = new Map<string, ReaderToken[]>();

function alignTokens(text: string, tokenTexts: string[]): ReaderToken[] {
	const tokens: ReaderToken[] = [];
	let cursor = 0;
	for (const tokenText of tokenTexts) {
		const start = text.indexOf(tokenText, cursor);
		if (start < 0) {
			continue;
		}
		const end = start + tokenText.length;
		tokens.push({ text: tokenText, start, end });
		cursor = end;
	}
	return tokens;
}

export async function tokenizeReaderRange(
	resourceHref: string,
	text: string,
	startOffset = 0
): Promise<ReaderToken[]> {
	const cacheKey = `${resourceHref}:${startOffset}:${text.length}:${text}`;
	const cachedTokens = tokenCache.get(cacheKey);
	if (cachedTokens) {
		return cachedTokens;
	}

	const tokenTexts = await invoke<string[]>(NATIVE_COMMANDS.READER.TOKENIZE_TEXT, { text });
	const tokens = alignTokens(text, tokenTexts).map((token) => ({
		...token,
		start: token.start + startOffset,
		end: token.end + startOffset,
	}));
	tokenCache.set(cacheKey, tokens);
	return tokens;
}

export function clearReaderTokenCache(resourceHref?: string): void {
	if (!resourceHref) {
		tokenCache.clear();
		return;
	}

	for (const cacheKey of tokenCache.keys()) {
		if (cacheKey.startsWith(`${resourceHref}:`)) {
			tokenCache.delete(cacheKey);
		}
	}
}
