<script>
    // TODO: Fix before merge: Get this component code style to match the other components.
    // Specifically, the props documentation.

    export let total = 41;
    export let completed = 41;
    export let startColor = "var(--sy-color--blue)";
    export let endColor = undefined;

    // Helper function to convert hex to RGB components
    function parseColor(color) {
        const variableName = color.match(/\(([^)]+)\)/)[1];
        let hex = getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();

        hex = hex.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return [r, g, b];
    }

    // Calculate interpolated color based on progress
    function interpolateColor(progress) {
        if (!endColor) return startColor;

        const color1 = parseColor(startColor);
        const color2 = parseColor(endColor);

        console.log(color1, color2);

        const r = Math.round(color1[0] + (color2[0] - color1[0]) * progress);
        const g = Math.round(color1[1] + (color2[1] - color1[1]) * progress);
        const b = Math.round(color1[2] + (color2[2] - color1[2]) * progress);

        console.log(r, g, b);

        return `rgb(${r}, ${g}, ${b})`;
    }

    $: progress = Math.min(1, Math.max(0, completed / total));
    $: progressColor = interpolateColor(progress);
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
        transition:
            width 0.3s ease-out,
            background-color 0.3s ease-out;
    }
</style>
