<script>
    import { interpolateColor } from "../../utils";

    /* Total Prop */
    /* Total number of items */
    export let total = 41;

    /* Completed Prop */
    /* Number of completed items */
    export let completed = 41;

    /* Start Color Prop */
    /* Starting color for the progress bar */
    export let startColor = "var(--sy-color--blue)";

    /* End Color Prop */
    /* Ending color for the progress bar, interpolates from start to end based on progress */
    export let endColor = undefined;

    $: progress = Math.min(1, Math.max(0, completed / total));
    $: progressColor = interpolateColor(startColor, endColor, progress);
</script>

<div class="progress-line--container">
    <div
        class="progress-line--progress"
        style="width: {progress * 100}%; background-color: {progressColor};"
    />
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
