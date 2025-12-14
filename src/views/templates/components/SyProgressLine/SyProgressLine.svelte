<script>
    import { interpolateColor } from '../../utils';

    /* Total Prop */
    

    /* Completed Prop */
    

    /* Start Color Prop */
    

    /* End Color Prop */
    
    /**
     * @typedef {Object} Props
     * @property {number} [total] - Total number of items
     * @property {number} [completed] - Number of completed items
     * @property {string} [startColor] - Starting color for the progress bar
     * @property {any} [endColor] - Ending color for the progress bar, interpolates from start to end based on progress
     */

    /** @type {Props} */
    const {
    	total = 41,
    	completed = 41,
    	startColor = 'var(--sy-color--blue)',
    	endColor = undefined
    } = $props();

    const progress = $derived(Math.min(1, Math.max(0, completed / total)));
    const progressColor = $derived(interpolateColor(startColor, endColor, progress));
</script>

<div class="progress-line--container">
    <div
        class="progress-line--progress"
        style="width: {progress * 100}%; background-color: {progressColor};"
></div>
</div>

<style>
    .progress-line--container {
        width: 100%;
        height: 10px;
        background-color: var(--sy-color--grey-2);
        display: flex;
    }
    .progress-line--progress {
        height: 100%;
        transition-duration: var(--sy-transition-duration);
        transition-property: width, background-color;
        transition-timing-function: ease-out;
    }
</style>
