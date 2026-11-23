<script lang="ts">
	const cataloged = [
		'SyButton',
		'SyButtonBar',
		'SyCollapsibleList',
		'SyDropdown',
		'SyList',
		'SyListItem',
		'SyModal',
		'SyPopover',
		'SyProgressLine',
		'SyRadio',
		'SyTab',
		'SyTag',
		'SyTextInput',
		'SyTimer',
		'SyToast',
		'SyToggle',
		'WalkthroughSettings',
		'WalkthroughHelp',
	];
</script>

<main class="catalog">
	<p class="eyebrow">Syng · desktop design system</p>
	<h1>Coverage and gaps</h1>
	<p class="intro">
		This first catalog renders the current app components directly. Its examples use local
		sample data and leave persisted settings and native services untouched.
	</p>
	<section>
		<h2>Cataloged now</h2>
		<p>{cataloged.join(' · ')}</p>
	</section>
	<section>
		<h2>Next catalog work</h2>
		<ul>
			<li>
				<strong>Walkthrough overlay:</strong> the live host, spotlight, invitations, and step
				cards depend on guide progress, app routing, targets, telemetry, and saved preferences.
				They need a dedicated fixture before their real states can be cataloged without changing
				user data.
			</li>
			<li>
				<strong>SySnapSheet:</strong> mobile-only shared component; add to the later mobile catalog
				with touch, snap, dismissal, and reduced-motion examples.
			</li>
			<li>
				<strong>Navigation:</strong> desktop shell composite uses routing, platform insets, badges,
				and tooltips. A local route fixture is needed before its sliding pill can be inspected
				in isolation.
			</li>
			<li>
				<strong>Data-backed composites:</strong> dictionary entries, Settings sections, Reader
				views, and onboarding preview still need stable service fixtures before they can become
				trustworthy catalog stories.
			</li>
			<li>
				<strong>Appearance matrix:</strong> the current stories follow the browser's light/dark
				scheme; inspect Original and Increase Contrast in the installed app until a catalog appearance
				switch reproduces the full app preference path.
			</li>
		</ul>
	</section>
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(950px, 100vw);
		height: 100vh;
		overflow: auto;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		color: var(--sy-text--dark);
	}
	.eyebrow {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 6px 0 8px;
		font-size: var(--sy-font-size--heading);
	}
	.intro {
		max-width: 700px;
		color: var(--sy-text--secondary);
		line-height: var(--sy-line-height--body);
	}
	section {
		margin-top: 30px;
		padding: 24px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	h2 {
		margin: 0 0 12px;
		font-size: var(--sy-font-size--medium);
	}
	section p,
	li {
		line-height: var(--sy-line-height--body);
	}
	ul {
		display: grid;
		gap: 12px;
		margin: 0;
		padding-left: 22px;
	}
	@media (max-width: 680px) {
		.catalog {
			padding: 24px 20px 60px;
		}
	}
</style>
