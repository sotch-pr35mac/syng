<script>
	import { NO_TONE_INDEX, toneColorClass } from '@/utils/tones.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} [characters] - Characters Prop
	 * @property {any} [tones] - Tones Prop
	 * @property {boolean} [colorByTone] - Whether tone color classes should be applied
	 */

	/** @type {Props} */
	const { characters = '', tones = [], colorByTone = true } = $props();
</script>

<span>
	{#each characters as character, index (index)}
		<span
			class="sy-text--selectable {colorByTone
				? toneColorClass(tones[index] || NO_TONE_INDEX, 'colored-characters')
				: ''}">{character}</span
		>
	{/each}
</span>
