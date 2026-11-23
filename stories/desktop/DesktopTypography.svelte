<script lang="ts">
	const roles = [
		{
			name: 'Page title',
			token: '--sy-type--page-title',
			use: 'Names the current view or a major flow.',
			sample: 'Your learning, in context',
			desktopSource: 'What’s New heading',
			mobileSource: 'Mobile Settings detail heading',
		},
		{
			name: 'Section title',
			token: '--sy-type--section-title',
			use: 'Introduces a group of content or settings. The phone setting group is intentionally quieter.',
			sample: 'Saved vocabulary',
			desktopSource: 'Shared dictionary content-list heading',
			mobileSource: 'Mobile Settings group heading',
		},
		{
			name: 'Local title',
			token: '--sy-type--local-title',
			use: 'Names a focused view or panel within the app shell.',
			sample: '语言 · language',
			desktopSource: 'Reader Library heading',
			mobileSource: 'Mobile Reader Library heading',
		},
		{
			name: 'Body',
			token: '--sy-type--body',
			use: 'Explains a setting or presents ordinary interface prose.',
			sample: 'Read a sentence, then explore the words you want to remember.',
			desktopSource: 'Onboarding welcome text',
			mobileSource: 'Mobile onboarding welcome text',
		},
		{
			name: 'Control label',
			token: '--sy-type--control-label',
			use: 'Labels a default-size action or menu choice. Component size variants remain available.',
			sample: 'Save word',
			desktopSource: 'SyButton medium',
			mobileSource: 'SyButton mobile medium',
		},
		{
			name: 'Supporting',
			token: '--sy-type--supporting',
			use: 'Adds secondary detail without competing with the main message.',
			sample: 'Last reviewed today · 12 words in this list',
			desktopSource: 'Onboarding welcome supporting text',
			mobileSource: 'Mobile Settings row detail',
		},
	] as const;
</script>

<main class="catalog">
	<header class="heading">
		<h1>Typography roles</h1>
		<p>
			These role names organize styles already used in this branch. The source line under each
			sample identifies its app reference; this catalog does not restyle those screens. Color
			remains a separate foreground role.
		</p>
	</header>

	<div class="role-list">
		{#each roles as role}
			<section class="role" aria-label={role.name}>
				<div class="role__description">
					<h2>{role.name}</h2>
					<p>{role.use}</p>
				</div>
				<div class="role__specimens">
					<div class="specimen">
						<span class="specimen__context">Desktop</span>
						<p class="specimen__text" style:font={`var(${role.token})`}>
							{role.sample}
						</p>
						<small class="specimen__source">From {role.desktopSource}</small>
						<code>{role.token}</code>
					</div>
					<div class="specimen specimen--mobile">
						<span class="specimen__context">Phone</span>
						<p class="specimen__text" style:font={`var(${role.token}-mobile)`}>
							{role.sample}
						</p>
						<small class="specimen__source">From {role.mobileSource}</small>
						<code>{role.token}-mobile</code>
					</div>
				</div>
			</section>
		{/each}
	</div>

	<section class="boundaries">
		<h2>Content typography has its own scale</h2>
		<p>
			Reader text keeps its saved 50–150% size preference. Study prompts keep the viewport
			based display tokens. Both use the same font stack and foreground roles, while their
			sizes respond to reading and practice needs rather than the interface hierarchy above.
			Chinese glyph shapes also depend on the available system fallback fonts.
		</p>
	</section>
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(1180px, 100vw);
		min-height: 100vh;
		padding: 42px clamp(20px, 4vw, 52px) 72px;
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
		color: var(--sy-text--dark);
	}
	.heading {
		max-width: 760px;
		margin-bottom: 30px;
	}
	h1 {
		margin: 0;
		font: var(--sy-type--page-title);
	}
	.heading > p:last-child,
	.boundaries p {
		font: var(--sy-type--body);
		color: var(--sy-text--secondary);
	}
	.heading > p:last-child {
		margin: 12px 0 0;
	}
	.role-list {
		display: grid;
		gap: 14px;
	}
	.role {
		display: grid;
		grid-template-columns: minmax(190px, 0.7fr) minmax(0, 2fr);
		gap: 22px;
		padding: 18px;
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.role__description h2 {
		margin: 0 0 6px;
		font: var(--sy-type--local-title);
	}
	.role__description p {
		margin: 0;
		font: var(--sy-type--supporting);
		color: var(--sy-text--secondary);
	}
	.role__specimens {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.specimen {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		min-height: 112px;
		padding: 14px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--well);
	}
	.specimen--mobile {
		border: var(--sy-mobile-surface-border);
	}
	.specimen__context {
		font: var(--sy-type--supporting);
		color: var(--sy-text--muted);
	}
	.specimen__source {
		font: var(--sy-type--supporting);
		color: var(--sy-text--secondary);
	}
	.specimen__text {
		flex: 1;
		margin: 0;
		overflow-wrap: anywhere;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.6875rem;
		color: var(--sy-text--secondary);
		overflow-wrap: anywhere;
	}
	.boundaries {
		max-width: 760px;
		margin-top: 28px;
		padding: 18px 22px;
		border-left: 3px solid var(--sy-text--blue);
		background: var(--sy-surface--content);
	}
	.boundaries h2 {
		margin: 0 0 8px;
		font: var(--sy-type--local-title);
	}
	.boundaries p {
		margin: 0;
	}
	@media (max-width: 800px) {
		.role {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.role__specimens {
			grid-template-columns: 1fr;
		}
	}
</style>
