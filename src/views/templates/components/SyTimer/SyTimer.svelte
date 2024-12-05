<script>
    import { onMount, createEventDispatcher, onDestroy } from "svelte";

    // Props
    export let duration = 10; // Duration in seconds
    export let size = 40; // Size in pixels
    export let autoStart = false;

    // Internal state
    const dispatch = createEventDispatcher();
    let progress = 0;
    let intervalId;
    let startTime;
    let hovering = false;
    let isPaused = false;
    let pausedTime = 0;

    // Theme colors
    const lightGrey = "var(--sy-color--grey-2, #F5F5F5)";
    const darkGrey = "var(--sy-color--grey-1, #CDD1D6)";

    // Reactive values
    $: angle = progress * 360;

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

<!-- Timer UI -->
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
                <circle cx="20" cy="20" r="16" fill={darkGrey} />
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
