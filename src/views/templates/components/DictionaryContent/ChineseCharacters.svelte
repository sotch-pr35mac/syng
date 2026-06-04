<script>
	import { NO_TONE_INDEX, toneColorClass } from '@/utils/tones.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} [characters] - Characters Prop
	 * @property {any} [tones] - Tones Prop
	 */

	/** @type {Props} */
	const { characters = '', tones = [] } = $props();
</script>

<span>
	{#each characters as character, index (index)}
		<span
			class="sy-text--selectable {toneColorClass(
				tones[index] || NO_TONE_INDEX,
				'colored-characters'
			)}">{character}</span
		>
	{/each}
</span>
