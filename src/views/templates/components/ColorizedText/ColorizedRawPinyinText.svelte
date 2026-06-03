<!-- Colors free-form pinyin text by tokenizing tone marks and tone-number syllables directly. -->
<script lang="ts">
	interface Props {
		text?: string;
	}

	interface Token {
		text: string;
		tone: number | null;
	}

	const { text = '' }: Props = $props();
	const NO_TONE_INDEX = 5;
	const tokens = $derived(tokenizePinyin(text));

	function tokenizePinyin(value: string): Token[] {
		const result: Token[] = [];
		let syllable = '';
		let tone = NO_TONE_INDEX;

		function flushSyllable(): void {
			if (!syllable) {
				return;
			}
			result.push({ text: syllable, tone });
			syllable = '';
			tone = NO_TONE_INDEX;
		}

		for (const character of value) {
			const markedTone = accentedVowelTone(character);
			if (isPinyinLetter(character) || markedTone !== null) {
				syllable += character;
				tone = markedTone ?? tone;
			} else if (/^[1-5]$/u.test(character) && syllable) {
				syllable += character;
				tone = Number(character);
				flushSyllable();
			} else {
				flushSyllable();
				result.push({ text: character, tone: null });
			}
		}

		flushSyllable();
		return result;
	}

	function isPinyinLetter(character: string): boolean {
		return /^[A-Za-züÜ]$/u.test(character);
	}

	function accentedVowelTone(character: string): number | null {
		const tones = ['āēīōūǖĀĒĪŌŪǕ', 'áéíóúǘÁÉÍÓÚǗ', 'ǎěǐǒǔǚǍĚǏǑǓǙ', 'àèìòùǜÀÈÌÒÙǛ'];
		const index = tones.findIndex((toneCharacters) => toneCharacters.includes(character));
		return index === -1 ? null : index + 1;
	}
</script>

<span
	>{#each tokens as token, index (index)}{#if token.tone}<span
				class="sy-text--selectable {`colored-pinyin--tone-${token.tone}`}"
				>{token.text}</span
			>{:else}{token.text}{/if}{/each}</span
>

<style>
	.colored-pinyin--tone-1 {
		color: var(--sy-tone-color--1);
	}
	.colored-pinyin--tone-2 {
		color: var(--sy-tone-color--2);
	}
	.colored-pinyin--tone-3 {
		color: var(--sy-tone-color--3);
	}
	.colored-pinyin--tone-4 {
		color: var(--sy-tone-color--4);
	}
	.colored-pinyin--tone-5 {
		color: var(--sy-tone-color--5);
	}
</style>
