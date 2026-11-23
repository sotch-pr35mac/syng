<script lang="ts">
	type Treatment = 'solid' | 'grain';

	const treatments: {
		id: Treatment;
		name: string;
		description: string;
		verdict: string;
	}[] = [
		{
			id: 'solid',
			name: 'Solid roles',
			description: 'The five app materials without canvas texture.',
			verdict: 'Baseline',
		},
		{
			id: 'grain',
			name: 'Static grain',
			description:
				'The selected 15% SVG grain, blended over the canvas. Content stays solid.',
			verdict: 'Selected · 15%',
		},
	];
</script>

<main class="study">
	<header class="study-heading">
		<h1>Canvas grain at 15%</h1>
		<p>
			The surfaces below use this branch’s app tokens. The grain is a fixed, tiled SVG over
			the canvas role. Its strength is fixed at the selected 15%; the large samples show which
			surface receives it. Change your system or browser appearance to compare light and dark
			mode.
		</p>
	</header>

	<div class="studies">
		{#each treatments as treatment (treatment.id)}
			<section class="variant">
				<div class="variant-heading">
					<div>
						<h2>{treatment.name}</h2>
						<p>{treatment.description}</p>
					</div>
					<span>{treatment.verdict}</span>
				</div>
				<div class="frame">
					<div class="shell" class:shell--grain={treatment.id === 'grain'}>
						<aside class="chrome sidebar" aria-label="Navigation preview">
							<div class="app-mark">S</div>
							<div class="nav-item nav-item--selected">Read</div>
							<div class="nav-item">Search</div>
							<div class="nav-item">Study</div>
						</aside>
						<div class="workspace">
							<div class="chrome toolbar">
								<strong>Reader</strong><span>Dictionary · Notes</span>
							</div>
							<div class="canvas">
								<div class="content">
									<p class="caption">READING SURFACE</p>
									<h3>Learning in context</h3>
									<p class="reading">
										阅读一篇文章时，熟悉的词语会在新的语境里呈现不同的意思。
									</p>
									<p class="translation">
										Familiar words can take on new meaning when you meet them in
										a different context.
									</p>
									<div class="well">Tap a word to explore its meaning.</div>
									<div class="floating">
										<strong>语境</strong><span>yǔjìng · context</span>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div
						class="material-samples"
						class:material-samples--grain={treatment.id === 'grain'}
					>
						<div class="material-sample material-sample--canvas">
							<span>Canvas {treatment.id === 'grain' ? '· treated' : '· solid'}</span>
						</div>
						<div class="material-sample material-sample--content">
							<span>Content · solid</span>
						</div>
					</div>
				</div>
			</section>
		{/each}
	</div>

	<section class="decision-notes">
		<h2>Selected treatment</h2>
		<p>
			The app puts the pattern only on the workspace canvas. Reading surfaces, controls,
			menus, and sheets stay solid. The tile is fixed, so scrolling does not create animated
			noise.
		</p>
		<p>
			On phones the treatment belongs behind the scrollable body, outside the top navigation,
			bottom action dock, and snap sheet. Increase Contrast and forced colors use the plain
			canvas. The local SVG uses <code>feTurbulence</code> and a 15% overlay blend.
		</p>
	</section>
</main>

<style>
	.study {
		box-sizing: border-box;
		width: min(1220px, 100vw);
		min-height: 100vh;
		padding: 38px clamp(18px, 4vw, 48px) 64px;
		background: var(--sy-surface--canvas);
		color: var(--sy-text--dark);
	}
	.study-heading {
		max-width: 760px;
		margin-bottom: 30px;
	}
	h1,
	h2,
	h3,
	p {
		margin: 0;
	}
	h1 {
		font-size: clamp(1.55rem, 3vw, 2.3rem);
		letter-spacing: -0.025em;
	}
	.study-heading p,
	.decision-notes p {
		line-height: 1.55;
	}
	.study-heading p {
		margin-top: 12px;
	}
	.studies {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
	}
	.variant {
		min-width: 0;
	}
	.variant-heading {
		display: flex;
		gap: 10px;
		align-items: start;
		justify-content: space-between;
		min-height: 78px;
	}
	.variant-heading h2 {
		font-size: 1rem;
	}
	.variant-heading p {
		margin-top: 5px;
		font-size: 0.82rem;
		line-height: 1.4;
		color: var(--sy-text--secondary);
	}
	.variant-heading span {
		flex: 0 0 auto;
		max-width: 130px;
		font-size: 0.72rem;
		text-align: right;
		color: var(--sy-text--secondary);
	}
	.frame {
		border-radius: 12px;
		padding: 8px;
		background: var(--sy-surface--well);
	}
	.shell {
		display: flex;
		min-height: 350px;
		overflow: hidden;
		border-radius: 7px;
		background: var(--sy-surface--canvas);
		color: var(--sy-text--dark);
		font-size: 0.72rem;
	}
	.chrome {
		background: var(--sy-surface--chrome);
	}
	.sidebar {
		box-sizing: border-box;
		width: 70px;
		flex: 0 0 70px;
		padding: 12px 6px;
	}
	.app-mark {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		margin: 0 auto 20px;
		border-radius: 9px;
		background: var(--sy-color--blue-2);
		color: white;
		font-size: 1rem;
		font-weight: 700;
	}
	.nav-item {
		padding: 8px 4px;
		margin: 3px 0;
		border-radius: 6px;
		text-align: center;
		color: var(--sy-text--muted);
	}
	.nav-item--selected {
		background: var(--sy-navigation-selection-fill);
		color: var(--sy-text--dark);
		box-shadow: var(--sy-shadow);
	}
	.workspace {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.toolbar {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 15px 18px;
		border-bottom: var(--sy-mobile-surface-border);
	}
	.toolbar span {
		color: var(--sy-text--muted);
	}
	.canvas {
		flex: 1;
		padding: 18px;
		background-color: var(--sy-surface--canvas);
	}
	.shell--grain .canvas,
	.material-samples--grain .material-sample--canvas {
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}
	.content {
		position: relative;
		box-sizing: border-box;
		width: min(80%, 360px);
		min-height: 225px;
		padding: 20px 20px 44px;
		border-radius: 9px;
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.material-samples {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-top: 8px;
	}
	.material-sample {
		box-sizing: border-box;
		display: flex;
		align-items: flex-end;
		min-height: 140px;
		padding: 10px;
		border: var(--sy-mobile-surface-border);
		border-radius: 7px;
		color: var(--sy-text--dark);
	}
	.material-sample span {
		padding: 3px 5px;
		border-radius: 4px;
		background: var(--sy-surface--floating);
		font-size: 0.66rem;
		font-weight: 700;
	}
	.material-sample--canvas {
		background-color: var(--sy-surface--canvas);
	}
	.material-sample--content {
		background-color: var(--sy-surface--content);
	}
	.caption {
		color: var(--sy-text--muted);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	h3 {
		margin-top: 14px;
		font-size: 0.95rem;
	}
	.reading {
		margin-top: 12px;
		font-size: 0.92rem;
		line-height: 1.6;
	}
	.translation {
		margin-top: 9px;
		color: var(--sy-text--muted);
		line-height: 1.45;
	}
	.well {
		margin-top: 13px;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--sy-surface--well);
	}
	.floating {
		position: absolute;
		right: 10px;
		bottom: -11px;
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 9px 12px;
		border: var(--sy-mobile-surface-border);
		border-radius: 8px;
		background: var(--sy-surface--floating);
		box-shadow: var(--sy-shadow--raised);
	}
	.floating span {
		color: var(--sy-text--muted);
	}
	.decision-notes {
		max-width: 930px;
		margin-top: 34px;
		padding: 22px 26px;
		border-radius: 9px;
		background: var(--sy-surface--content);
	}
	.decision-notes h2 {
		font-size: 1rem;
		margin-bottom: 10px;
	}
	.decision-notes p + p {
		margin-top: 12px;
	}
	@media (max-width: 800px) {
		.studies {
			grid-template-columns: 1fr;
		}
		.variant-heading {
			min-height: auto;
			margin-bottom: 12px;
		}
	}
	@media (max-width: 480px) {
		.study {
			padding-inline: 14px;
		}
		.sidebar {
			width: 56px;
			flex-basis: 56px;
		}
		.canvas {
			padding: 12px;
		}
		.content {
			padding: 14px 14px 44px;
		}
		.toolbar {
			padding: 13px 12px;
		}
	}
</style>
