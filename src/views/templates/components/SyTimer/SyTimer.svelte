<script>
    import { onMount, createEventDispatcher, onDestroy } from "svelte";

    // TODO: Fix before merge: Get this component code style to match the other components.
    // Specifically, the props documentation.

    // Props
    export let duration = 10; // Duration in seconds
    export let size = 40; // Size in pixels
    export let autoStart = false;
    export let progressColor = null; // New prop for progress color

    // Internal state
    const dispatch = createEventDispatcher();
    let progress = 0;
    let intervalId;
    let startTime;
    let hovering = false;
    let isPaused = false;
    let pausedTime = 0;

    // Theme colors
    const lightGrey = "var(--sy-color--grey-2)";
    const darkGrey = "var(--sy-color--grey-1)";

    // Reactive values
    $: angle = progress * 360;

    // Helper function to convert hex to RGB components
    function parseColor(color) {
        const variableName = color.match(/\(([^)]+)\)/)[1];
        let hex = getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();

        // Remove the hash if present
        hex = hex.replace("#", "");

        // Convert to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return [r, g, b];
    }

    // Calculate interpolated color based on progress
    function interpolateColor(progress) {
        if (!progressColor) return darkGrey;

        const color1 = parseColor(progressColor);
        const color2 = parseColor(darkGrey);

        // Simple linear interpolation between the two colors
        const r = Math.round(
            color1[0] + (color2[0] - color1[0]) * (1 - progress),
        );
        const g = Math.round(
            color1[1] + (color2[1] - color1[1]) * (1 - progress),
        );
        const b = Math.round(
            color1[2] + (color2[2] - color1[2]) * (1 - progress),
        );

        return `rgb(${r}, ${g}, ${b})`;
    }

    // Public methods
    export function pause() {
        if (!isPaused) {
            isPaused = true;
            pausedTime = Date.now() - startTime;
        }
    }

    export function resume() {
        if (isPaused) {
            isPaused = false;
            startTime = Date.now() - pausedTime;
            startTimer();
        }
    }

    // Timer functionality
    function startTimer() {
        if (intervalId) clearInterval(intervalId);

        intervalId = setInterval(() => {
            if (!isPaused) {
                const elapsed = Date.now() - startTime;
                progress = Math.min(elapsed / (duration * 1000), 1);

                if (progress >= 1) {
                    clearInterval(intervalId);
                    dispatch("complete");
                }
            }
        }, 16);
    }

    function handleClick() {
        if (isPaused) {
            resume();
        } else {
            pause();
        }
    }

    // Lifecycle
    onMount(() => {
        if (autoStart) {
            startTime = Date.now();
            startTimer();
        }
    });

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });

    // SVG path calculation for pie slice
    $: {
        const rad = ((angle - 90) * Math.PI) / 180;
        const x = 20 + 16 * Math.cos(rad);
        const y = 20 + 16 * Math.sin(rad);
        pathD =
            angle >= 360
                ? ""
                : `M 20 20 L 20 4 A 16 16 0 ${angle > 180 ? 1 : 0} 1 ${x} ${y} Z`;
    }
    let pathD;
</script>

<div
    class="timer"
    style="width: {size}px; height: {size}px;"
    on:click={handleClick}
    on:keydown={(e) => e.key === " " && handleClick()}
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}
>
    {#if isPaused}
        {#if hovering}
            <svg viewBox="0 0 40 40">
                <path d="M15 12L29 20L15 28V12Z" fill={darkGrey} />
            </svg>
        {:else}
            <svg viewBox="0 0 40 40">
                <rect
                    x="12"
                    y="12"
                    width="6"
                    height="16"
                    fill={darkGrey}
                    rx="1"
                />
                <rect
                    x="22"
                    y="12"
                    width="6"
                    height="16"
                    fill={darkGrey}
                    rx="1"
                />
            </svg>
        {/if}
    {:else}
        <svg viewBox="0 0 40 40">
            {#if hovering}
                <rect
                    x="12"
                    y="12"
                    width="6"
                    height="16"
                    fill={darkGrey}
                    rx="1"
                />
                <rect
                    x="22"
                    y="12"
                    width="6"
                    height="16"
                    fill={darkGrey}
                    rx="1"
                />
            {:else}
                <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill={interpolateColor(progress)}
                />
                <path d={pathD} fill={lightGrey} />
            {/if}
        </svg>
    {/if}
</div>

<style>
    .timer {
        position: relative;
        cursor: pointer;
        border-radius: 50%;
    }
</style>
