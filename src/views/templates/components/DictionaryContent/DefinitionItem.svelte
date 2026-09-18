<script lang="ts">
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';

	type DictionaryLinkDetail = {
		text: string;
		lexicalId?: string;
		anchor?: DOMRect;
	};

	type DefinitionSegment =
		| { kind: 'text'; text: string }
		| { kind: 'dictionary-link'; traditional: string; simplified: string };

	interface Props {
		value: string;
		onevent?: (detail: DictionaryLinkDetail) => void;
	}

	const { value, onevent }: Props = $props();

	// `Script=Han` deliberately excludes Latin abbreviations and initialisms that can
	// appear in Wiktionary prose (for example, "T" and "YYDS").
	const HAN_CHARACTER = /\p{Script=Han}/u;

	function readHanSegment(text: string, startIndex: number): { text: string; nextIndex: number } {
		let currentIndex = startIndex;
		let characters = '';

		while (currentIndex < text.length) {
			const codePoint = text.codePointAt(currentIndex);
			if (codePoint === undefined) {
				break;
			}

			const character = String.fromCodePoint(codePoint);
			if (!HAN_CHARACTER.test(character)) {
				break;
			}

			characters += character;
			currentIndex += character.length;
		}

		return { text: characters, nextIndex: currentIndex };
	}

	function appendTextSegment(segments: DefinitionSegment[], text: string): void {
		if (!text) {
			return;
		}

		const previousSegment = segments.at(-1);
		if (previousSegment?.kind === 'text') {
			previousSegment.text += text;
		} else {
			segments.push({ kind: 'text', text });
		}
	}

	/**
	 * Wiktionary writes pronunciation and disambiguation metadata immediately
	 * after a linked Chinese form, for example `著[kao3]`. It is metadata for
	 * the reference rather than gloss prose, so omit only a complete adjacent
	 * bracket annotation. Unclosed or separate brackets remain visible prose.
	 */
	function skipTrailingBracketAnnotation(text: string, startIndex: number): number {
		if (text[startIndex] !== '[') {
			return startIndex;
		}

		let bracketDepth = 0;
		for (let currentIndex = startIndex; currentIndex < text.length; currentIndex += 1) {
			if (text[currentIndex] === '[') {
				bracketDepth += 1;
			} else if (text[currentIndex] === ']') {
				bracketDepth -= 1;
				if (bracketDepth === 0) {
					return currentIndex + 1;
				}
			}
		}

		return startIndex;
	}

	/**
	 * Keep gloss prose intact while turning every Han run into a local dictionary
	 * lookup. Wiktionary's `traditional|simplified` convention is treated as one
	 * preference-aware link; all other Han runs fall back to Chinese-text lookup.
	 */
	function scanDefinition(value: string): DefinitionSegment[] {
		const segments: DefinitionSegment[] = [];
		let currentIndex = 0;

		while (currentIndex < value.length) {
			const hanSegment = readHanSegment(value, currentIndex);
			if (!hanSegment.text) {
				const codePoint = value.codePointAt(currentIndex);
				const character = codePoint === undefined ? '' : String.fromCodePoint(codePoint);
				appendTextSegment(segments, character);
				currentIndex += character.length;
				continue;
			}

			const simplifiedStart = hanSegment.nextIndex + 1;
			const simplifiedSegment =
				value[hanSegment.nextIndex] === '|'
					? readHanSegment(value, simplifiedStart)
					: undefined;

		let linkEndIndex: number;
		if (simplifiedSegment?.text) {
				segments.push({
					kind: 'dictionary-link',
					traditional: hanSegment.text,
					simplified: simplifiedSegment.text,
				});
				linkEndIndex = simplifiedSegment.nextIndex;
			} else {
				segments.push({
					kind: 'dictionary-link',
					traditional: hanSegment.text,
					simplified: hanSegment.text,
				});
				linkEndIndex = hanSegment.nextIndex;
			}

			currentIndex = skipTrailingBracketAnnotation(value, linkEndIndex);
		}

		return segments;
	}

	const segments = $derived(scanDefinition(value));

	function handleOpenLink(event: { detail: DictionaryLinkDetail }): void {
		onevent?.(event.detail);
	}
</script>

<div class="dictionary-content--definition-item sy-text--selectable">
	{#each segments as segment, segmentIndex (segmentIndex)}
		{#if segment.kind === 'dictionary-link'}
			<DictionaryLink
				link={segment.traditional}
				simplified={segment.simplified}
				traditional={segment.traditional}
				onopen={handleOpenLink}
			/>
		{:else}
			{segment.text}
		{/if}
	{/each}
</div>

<style>
	.dictionary-content--definition-item {
		padding: var(--sy-space--large);
	}
</style>
