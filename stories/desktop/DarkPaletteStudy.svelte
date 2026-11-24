<script lang="ts">
	import { BookOpen, Bookmark, Search } from 'lucide-svelte';
	type Role = 'well' | 'canvas' | 'chrome' | 'content' | 'floating';
	const roles: { id: Role; name: string; purpose: string }[] = [
		{ id: 'well', name: 'Well', purpose: 'Recessed controls' },
		{ id: 'canvas', name: 'Canvas', purpose: 'Workspace' },
		{ id: 'chrome', name: 'Chrome', purpose: 'Navigation and headers' },
		{ id: 'content', name: 'Content', purpose: 'Lists and cards' },
		{ id: 'floating', name: 'Floating', purpose: 'Menus and popups' },
	];
	const variants = [
		{
			id: 'current',
			name: 'Previous cool inverse palette',
			description: 'The earlier dark roles, with a slight blue cast across every neutral.',
		},
		{
			id: 'neutral',
			name: 'Current neutral charcoal palette',
			description:
				'Equal-channel greys, with a slightly broader step from recessed wells to floating content.',
		},
	] as const;
</script>

<main class="study">
	<header>
		<p class="eyebrow">Dark palette study · refinement</p>
		<h1>Neutral charcoal, more depth</h1>
		<p class="intro">
			Both options keep the inverse surface order and a navigation pill that shares the SyList
			content color. The neutral charcoal palette removes the earlier blue tint and gives the
			lightest and darkest materials a little more separation. The second palette is now in
			the app; the earlier version remains here for comparison.
		</p>
	</header>

	<div class="comparisons">
		{#each variants as variant (variant.id)}
			<section class="variant" class:variant--neutral={variant.id === 'neutral'}>
				<div class="variant-heading">
					<h2>{variant.name}</h2>
					<p>{variant.description}</p>
				</div>
				<div class="sample">
					<aside class="rail" aria-label="Navigation sample">
						<div class="rail-choice selected" aria-label="Search">
							<Search size="19" />
						</div>
						<div class="rail-choice" aria-label="Read"><BookOpen size="19" /></div>
						<div class="rail-choice" aria-label="Bookmarks"><Bookmark size="19" /></div>
					</aside>
					<div class="workspace">
						<div class="toolbar">
							<strong>Search</strong><span>Chinese ↔ English</span>
						</div>
						<div class="body">
							<div class="results">
								<p class="section-label">RESULTS</p>
								<div class="result active">学习 <span>study</span></div>
								<div class="result">学生 <span>student</span></div>
							</div>
							<div class="dictionary">
								<p class="section-label">DICTIONARY</p>
								<h3>学习 <small>xuéxí</small></h3>
								<div class="content-card">
									<p>to study; to learn</p>
									<p>to practice</p>
								</div>
								<div class="well">Search within this entry</div>
								<div class="floating">
									<strong>学</strong><span>Study · learn</span>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="swatches">
					{#each roles as role (role.id)}
						<div class="swatch">
							<span class={`chip chip--${role.id}`}></span>
							<strong>{role.name}</strong>
							<small>{role.purpose}</small>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</main>

<style>
	.study {
		box-sizing: border-box;
		min-height: 100vh;
		padding: clamp(20px, 4vw, 48px);
		background: #eeeef0;
		color: #30323a;
		font-family: var(--sy-font-family);
	}
	.study > header {
		max-width: 770px;
		margin-bottom: 28px;
	}
	h1,
	h2,
	h3,
	p {
		margin: 0;
	}
	h1 {
		font-size: clamp(1.55rem, 3vw, 2.2rem);
		letter-spacing: -0.025em;
	}
	.eyebrow {
		margin-bottom: 9px;
		color: #506680;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.intro {
		margin-top: 12px;
		max-width: 720px;
		line-height: 1.55;
		color: #626b77;
	}
	.comparisons {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}
	.variant {
		--sample-canvas: #2c2c2e;
		--sample-chrome: #252527;
		--sample-content: #202022;
		--sample-well: #313133;
		--sample-floating: #1b1b1d;
		--sample-selection: var(--sample-content);
		--sample-ink: #f5f5f6;
		--sample-muted: #b2b2ba;
		--sample-seam: #ffffff20;
		min-width: 0;
		padding: 16px;
		border: 1px solid #d8dce1;
		border-radius: 16px;
		background: #fafafa;
	}
	.variant--neutral {
		--sample-canvas: #2d2d2d;
		--sample-chrome: #242424;
		--sample-content: #1e1e1e;
		--sample-well: #313131;
		--sample-floating: #171717;
	}
	.variant-heading {
		min-height: 72px;
	}
	.variant-heading h2 {
		font-size: 1.08rem;
	}
	.variant-heading p {
		margin-top: 5px;
		color: #606a76;
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.sample {
		box-sizing: border-box;
		display: flex;
		height: 390px;
		overflow: hidden;
		border: 1px solid #46464b;
		border-radius: 11px;
		color: var(--sample-ink);
		background: var(--sample-canvas);
	}
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 64px;
		flex: none;
		padding: 15px 0;
		background: var(--sample-chrome);
		box-shadow: inset -1px 0 var(--sample-seam);
	}
	.rail-choice {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		color: var(--sample-muted);
	}
	.rail-choice.selected {
		background: var(--sample-selection);
		color: #76aff9;
		box-shadow:
			0 1px 4px #0008,
			0 5px 12px #0005;
	}
	.workspace {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		height: 58px;
		flex: none;
		padding: 0 18px;
		background: var(--sample-chrome);
		box-shadow: 0 2px 7px #0005;
	}
	.toolbar span {
		color: var(--sample-muted);
		font-size: 0.73rem;
	}
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.results {
		width: 32%;
		min-width: 120px;
		padding: 20px 10px;
		background: var(--sample-content);
	}
	.section-label {
		margin-bottom: 15px;
		color: var(--sample-muted);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}
	.result {
		padding: 10px;
		border-radius: 6px;
		font-size: 0.78rem;
	}
	.result span {
		display: block;
		margin-top: 3px;
		color: var(--sample-muted);
		font-size: 0.65rem;
	}
	.result.active {
		background: var(--sample-canvas);
	}
	.dictionary {
		position: relative;
		flex: 1;
		min-width: 0;
		padding: 20px;
		background-color: var(--sample-canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
		box-shadow: -4px 0 13px #0005;
	}
	.dictionary h3 {
		font-size: 1.3rem;
	}
	.dictionary h3 small {
		color: var(--sample-muted);
		font-size: 0.8rem;
		font-weight: 400;
	}
	.content-card {
		margin-top: 22px;
		overflow: hidden;
		border: 1px solid var(--sample-seam);
		border-radius: 9px;
		background: var(--sample-content);
		box-shadow: 0 4px 10px #0003;
	}
	.content-card p {
		padding: 11px 13px;
		font-size: 0.78rem;
	}
	.content-card p + p {
		border-top: 1px solid var(--sample-seam);
	}
	.well {
		margin-top: 16px;
		padding: 9px 11px;
		border-radius: 8px;
		background: var(--sample-well);
		color: var(--sample-muted);
		font-size: 0.68rem;
	}
	.floating {
		position: absolute;
		right: 15px;
		bottom: 16px;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 10px 12px;
		border: 1px solid var(--sample-seam);
		border-radius: 9px;
		background: var(--sample-floating);
		box-shadow: 0 9px 20px #0008;
		font-size: 0.7rem;
	}
	.floating strong {
		font-size: 1.05rem;
	}
	.floating span {
		color: var(--sample-muted);
	}
	.swatches {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
		margin-top: 13px;
	}
	.swatch {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		text-align: center;
		font-size: 0.64rem;
	}
	.swatch small {
		color: #727b85;
		font-size: 0.57rem;
	}
	.chip {
		width: 33px;
		height: 20px;
		border: 1px solid #ffffff20;
		border-radius: 5px;
		box-shadow: 0 0 0 1px #0002;
	}
	.chip--well {
		background: var(--sample-well);
	}
	.chip--canvas {
		background: var(--sample-canvas);
	}
	.chip--chrome {
		background: var(--sample-chrome);
	}
	.chip--content {
		background: var(--sample-content);
	}
	.chip--floating {
		background: var(--sample-floating);
	}
	@media (max-width: 900px) {
		.comparisons {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 480px) {
		.results {
			min-width: 95px;
		}
		.dictionary {
			padding: 12px;
		}
		.swatches {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
