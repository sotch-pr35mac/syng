<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [characters] - Characters Prop
	 * @property {any} [tones] - Tones Prop
	 */

	/** @type {Props} */
	const { characters = '', tones = [] } = $props();

	const NO_TONE_INDEX = 5;
</script>

<span>
	{#each characters as character, index (index)}
		<span
			class="sy-text--selectable {`colored-characters--tone-${tones[index] || NO_TONE_INDEX}`}"
			>{character}</span
		>
	{/each}
</span>

<style>
	.colored-characters--tone-1 {
		color: var(--sy-tone-color--1);
	}
	.colored-characters--tone-2 {
		color: var(--sy-tone-color--2);
	}
	.colored-characters--tone-3 {
		color: var(--sy-tone-color--3);
	}
	.colored-characters--tone-4 {
		color: var(--sy-tone-color--4);
	}
	.colored-characters--tone-5 {
		color: var(--sy-tone-color--5);
	}
</style>
