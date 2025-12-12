<script>
	

	
	/**
	 * @typedef {Object} Props
	 * @property {string} [characters] - Characters Prop
	 * @property {any} [tones] - Tones Prop
	 */

	/** @type {Props} */
	let { characters = '', tones = [] } = $props();
</script>

<span>
	{#each characters as character, index}
		<span
			class="sy-text--selectable {`colored-characters--tone-${tones[index] || 5}`}"
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
