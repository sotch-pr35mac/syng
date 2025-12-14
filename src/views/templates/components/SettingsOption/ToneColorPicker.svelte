<script>
/**
 * @typedef {Object} Props
 * @property {(data: {hasCustomColors: boolean, colors: string[]}) => void} [onchange] - Change handler
 */

/** @type {Props} */
const { onchange } = $props();

const styles = getComputedStyle(document.body);
const getRGB = (value) =>
	value.substring(0, 2) === '--' ? styles.getPropertyValue(value) : value;
const colors = window.preferenceManager
	.get('toneColors')
	.colors.map((color) => getRGB(color).trim());
const tones = [
	{
		label: 'First Tone',
		color: colors[0],
		index: 0,
	},
	{
		label: 'Second Tone',
		color: colors[1],
		index: 1,
	},
	{
		label: 'Third Tone',
		color: colors[2],
		index: 2,
	},
	{
		label: 'Fourth Tone',
		color: colors[3],
		index: 3,
	},
	{
		label: 'No Tone',
		color: colors[4],
		index: 4,
	},
];

const handleUpdate = (index) => {
	colors[index] = document.getElementById(`tone-${index + 1}`).value;
	onchange?.({
		hasCustomColors: true,
		colors: colors,
	});
};
</script>

<div class="tone-color-picker">
  {#each tones as tone (tone.index)}
    <div class="tone-color-picker--tone">
      <label for={`tone-${tone.index + 1}`}>{tone.label}</label>
      <input
        type="color"
        value={tone.color}
        id={`tone-${tone.index + 1}`}
        name={`tone-${tone.index + 1}`}
        onchange={() => handleUpdate(tone.index)}
      />
    </div>
  {/each}
</div>

<style>
.tone-color-picker--tone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sy-space);
}
</style>
