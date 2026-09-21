<script lang="ts">
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';
	import SyTag from '@/components/SyTag/SyTag.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { isMobileLayout } from '@/utils/device.js';
	import {
		formatQualifierCategory,
		type Definition,
		type DictionaryDefinition,
		type Qualifier,
		type Sourced,
	} from '@/types/dictionary.js';

	type DictionaryLinkDetail = {
		text: string;
		lexicalId?: string;
		anchor?: DOMRect;
	};

	type DefinitionSegment =
		| { kind: 'text'; text: string }
		| { kind: 'dictionary-link'; traditional: string; simplified: string };

	interface Props {
		value: DictionaryDefinition;
		onevent?: (detail: DictionaryLinkDetail) => void;
	}

	const { value, onevent }: Props = $props();

	const definitionGloss = $derived(
		typeof value === 'string'
			? value
			: typeof value?.gloss === 'string'
				? value.gloss
				: typeof value?.gloss?.value === 'string'
					? value.gloss.value
					: ''
	);
	const qualifiers = $derived(
		dictionaryDisplaySettingsStore.settings.showQualifiers ? readQualifiers(value) : []
	);
	const showQualifierTooltips = !isMobileLayout();

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
	function scanDefinition(gloss: string): DefinitionSegment[] {
		const segments: DefinitionSegment[] = [];
		let currentIndex = 0;

		while (currentIndex < gloss.length) {
			const hanSegment = readHanSegment(gloss, currentIndex);
			if (!hanSegment.text) {
				const codePoint = gloss.codePointAt(currentIndex);
				const character = codePoint === undefined ? '' : String.fromCodePoint(codePoint);
				appendTextSegment(segments, character);
				currentIndex += character.length;
				continue;
			}

			const simplifiedStart = hanSegment.nextIndex + 1;
			const simplifiedSegment =
				gloss[hanSegment.nextIndex] === '|'
					? readHanSegment(gloss, simplifiedStart)
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

			currentIndex = skipTrailingBracketAnnotation(gloss, linkEndIndex);
		}

		return segments;
	}

	function readQualifiers(definition: DictionaryDefinition): Sourced<Qualifier>[] {
		if (
			typeof definition === 'string' ||
			!Array.isArray((definition as Definition).qualifiers)
		) {
			return [];
		}
		return (definition as Definition).qualifiers.filter(
			(sourcedQualifier): sourcedQualifier is Sourced<Qualifier> =>
				Boolean(sourcedQualifier?.value) &&
				typeof sourcedQualifier.value.value === 'string' &&
				sourcedQualifier.value.value.length > 0
		);
	}

	const segments = $derived(scanDefinition(definitionGloss));

	function handleOpenLink(event: { detail: DictionaryLinkDetail }): void {
		onevent?.(event.detail);
	}
</script>

<div class="dictionary-content--definition-item sy-text--selectable">
	<div class="dictionary-content--definition-item__line">
		<span class="dictionary-content--definition-item__gloss">
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
		</span>
		{#if qualifiers.length}
			<span class="dictionary-content--definition-item__qualifiers">
				{#each qualifiers as qualifier, qualifierIndex (qualifierIndex)}
					<SyTag
						variant="green"
						tooltip={showQualifierTooltips
							? formatQualifierCategory(qualifier.value.category)
							: undefined}
					>
						{#if showQualifierTooltips}
							{qualifier.value.value}
						{:else}
							{formatQualifierCategory(qualifier.value.category)}: {qualifier.value
								.value}
						{/if}
					</SyTag>
				{/each}
			</span>
		{/if}
	</div>
</div>

<style>
	.dictionary-content--definition-item {
		padding: var(--sy-space--large);
	}
	.dictionary-content--definition-item__line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--sy-space--extra-large);
		width: 100%;
	}
	.dictionary-content--definition-item__gloss {
		min-width: 0;
	}
	.dictionary-content--definition-item__qualifiers {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--sy-space);
		margin-left: auto;
	}
</style>
