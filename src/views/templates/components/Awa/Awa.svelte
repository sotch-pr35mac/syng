<script module lang="ts">
	export const AWA_SIZES = {
		page: 176,
		mobile: 144,
		detail: 160,
		list: 128,
	} as const;
</script>

<script lang="ts">
	interface Props {
		pose?: 'read' | 'collect' | 'practice' | 'search' | 'dictionary' | 'welcome' | 'wave';
		/** Display width in CSS pixels. The image scales down to fit its container. */
		size?: number;
		/** Leave empty when adjacent empty-state copy already conveys the meaning. */
		alt?: string;
		loading?: 'eager' | 'lazy';
	}

	const { pose = 'read', size = AWA_SIZES.page, alt = '', loading = 'eager' }: Props = $props();

	// Like the splash icon, these files live under Tauri's src/views frontend root.
	// Resolve from the HTML page: the JavaScript bundle lives in templates/build/.
	const assetPath = $derived(`assets/awa/${pose}`);
	// CSS variables resolve relative URLs from the consuming stylesheet, not the page.
	const silhouetteUrl = $derived(new URL(`${assetPath}-512.webp`, document.baseURI).href);
</script>

<div class="awa" style:width={`${size}px`} style:--awa-silhouette={`url("${silhouetteUrl}")`}>
	<span class="awa__glow" aria-hidden="true"></span>
	<img
		src={`${assetPath}-512.webp`}
		srcset={`${assetPath}-512.webp 512w, ${assetPath}-1024.webp 1024w`}
		sizes={`${size}px`}
		width={size}
		height={size}
		{alt}
		{loading}
		decoding="async"
		draggable="false"
	/>
</div>

<style>
	.awa {
		position: relative;
		isolation: isolate;
		flex-shrink: 0;
		max-width: 100%;
	}

	.awa__glow {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: var(--awa-glow-opacity, 0.4);
		filter: blur(var(--awa-glow-blur, 8px));
	}

	/* Blur outside the masked layer so the halo follows the artwork's transparent outline. */
	.awa__glow::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			var(--sy-color--syng-orange),
			var(--sy-color--syng-red),
			var(--sy-color--syng-purple)
		);
		-webkit-mask: var(--awa-silhouette) center / contain no-repeat;
		mask: var(--awa-silhouette) center / contain no-repeat;
	}

	img {
		position: relative;
		display: block;
		width: 100%;
		height: auto;
	}
</style>
