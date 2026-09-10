<div class="route-load-error" role="alert">
	<p>This screen could not be loaded.</p>
	<button type="button" onclick={() => window.location.reload()}>Reload Syng</button>
</div>

<style>
	.route-load-error {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sy-space--large);
		padding: var(--sy-space--extra-large);
		box-sizing: border-box;
		text-align: center;
	}

	.route-load-error p {
		margin: 0;
	}

	.route-load-error button {
		font: inherit;
		color: var(--sy-color--white);
		background: var(--sy-color--blue-2);
		border: 0;
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space--large) var(--sy-space--extra-large);
		cursor: pointer;
	}
</style>
