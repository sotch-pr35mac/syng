<div class="route-loading" aria-busy="true" aria-label="Loading screen">
	<span class="route-loading__dot"></span>
	<span class="route-loading__dot"></span>
	<span class="route-loading__dot"></span>
</div>

<style>
	.route-loading {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--small);
		color: var(--sy-color--blue-2);
	}

	.route-loading__dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: currentColor;
		animation: route-loading-pulse 900ms ease-in-out infinite alternate;
	}

	.route-loading__dot:nth-child(2) {
		animation-delay: 150ms;
	}

	.route-loading__dot:nth-child(3) {
		animation-delay: 300ms;
	}

	@keyframes route-loading-pulse {
		from {
			opacity: 0.3;
			transform: translateY(0);
		}
		to {
			opacity: 1;
			transform: translateY(-0.2rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.route-loading__dot {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
