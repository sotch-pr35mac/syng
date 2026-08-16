<script lang="ts">
	import { NO_TONE_INDEX, toneColorClass } from '@/utils/tones.js';

	interface Props {
		pinyin?: string;
		tones?: number[];
		colorByTone?: boolean;
	}

	interface PinyinToken {
		text: string;
		tone?: number;
	}

	const { pinyin = '', tones = [], colorByTone = true }: Props = $props();

	const tokens = $derived.by((): PinyinToken[] => {
		let toneIndex = 0;
		return (pinyin.match(/\s+|\S+/g) ?? []).map((text) => {
			if (/^\s+$/.test(text)) {
				return { text };
			}
			const tone = tones[toneIndex] || NO_TONE_INDEX;
			toneIndex += 1;
			return { text, tone };
		});
	});
</script>

<span
	>{#each tokens as token, index (`${index}-${token.text}`)}{#if token.tone}<span
				class="sy-text--selectable {colorByTone ? toneColorClass(token.tone) : ''}"
				>{token.text}</span
			>{:else}{token.text}{/if}{/each}</span
>
