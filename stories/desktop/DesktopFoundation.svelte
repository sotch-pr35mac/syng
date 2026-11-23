<script lang="ts">
	import { onMount } from 'svelte';

	type Section = 'roles' | 'palette' | 'elevation';
	const { section }: { section: Section } = $props();

	const roles = [
		{
			token: '--sy-surface--canvas',
			name: 'Canvas',
			use: 'The workspace behind page content, with the selected 15% static grain.',
		},
		{
			token: '--sy-surface--chrome',
			name: 'Chrome',
			use: 'Navigation and persistent app framing.',
		},
		{
			token: '--sy-surface--content',
			name: 'Content',
			use: 'Primary cards, lists, and reading panels.',
		},
		{ token: '--sy-surface--well', name: 'Well', use: 'Inset controls and recessed regions.' },
		{
			token: '--sy-surface--floating',
			name: 'Floating',
			use: 'Menus, popovers, and dialogs above content.',
		},
	] as const;

	const palette = [
		{
			group: 'Brand',
			tokens: ['--sy-color--syng-orange', '--sy-color--syng-red', '--sy-color--syng-purple'],
		},
		{
			group: 'Accent sources',
			tokens: [
				'--sy-color--blue-1',
				'--sy-color--blue-2',
				'--sy-color--blue-3',
				'--sy-color--green-1',
				'--sy-color--green-2',
				'--sy-color--green-3',
				'--sy-color--yellow-1',
				'--sy-color--red-1',
			],
		},
		{
			group: 'Neutral sources',
			tokens: [
				'--sy-color--black',
				'--sy-color--white',
				'--sy-color--grey-1',
				'--sy-color--grey-2',
				'--sy-color--grey-3',
				'--sy-color--grey-4',
				'--sy-color--grey-5',
			],
		},
		{
			group: 'Semantic fills',
			tokens: ['--sy-fill--blue', '--sy-fill--green', '--sy-fill--yellow', '--sy-fill--red'],
		},
		{
			group: 'Text roles',
			tokens: [
				'--sy-text--dark',
				'--sy-text--muted',
				'--sy-text--secondary',
				'--sy-text--blue',
				'--sy-text--green',
				'--sy-text--yellow',
				'--sy-text--red',
				'--sy-content-list-title',
			],
		},
		{
			group: 'Interaction',
			tokens: ['--sy-focus-color', '--sy-control--border', '--sy-navigation-selection-fill'],
		},
		{
			group: 'Character animation',
			tokens: ['--sy-stroke-order-unanimated'],
		},
		{
			group: 'Chinese tone colors',
			tokens: [
				'--sy-tone-color--1',
				'--sy-tone-color--2',
				'--sy-tone-color--3',
				'--sy-tone-color--4',
				'--sy-tone-color--5',
			],
		},
	] as const;

	const elevation = [
		{ token: '--sy-shadow', name: 'Content list and card' },
		{ token: '--sy-shadow--active', name: 'Active control' },
		{ token: '--sy-shadow--raised', name: 'Raised content and floating surface' },
		{ token: '--sy-shadow--dialog', name: 'Plain modal dialog' },
		{ token: '--sy-inner-shadow', name: 'Inset well' },
		{ token: '--sy-pane-shadow', name: 'Overlapping desktop panes' },
	] as const;

	let values = $state<Record<string, string>>({});
	const allTokens = [
		...roles.map((role) => role.token),
		...palette.flatMap((group) => group.tokens),
		...elevation.map((shadow) => shadow.token),
	];

	onMount(() => {
		const scheme = window.matchMedia('(prefers-color-scheme: dark)');
		const refresh = () => {
			const styles = getComputedStyle(document.documentElement);
			values = Object.fromEntries(
				allTokens.map((token) => [token, styles.getPropertyValue(token).trim()])
			);
		};
		refresh();
		scheme.addEventListener('change', refresh);
		return () => scheme.removeEventListener('change', refresh);
	});
</script>

<main class="catalog">
	<header>
		<p class="eyebrow">Syng · desktop design system</p>
		<h1>
			{section === 'roles'
				? 'Surface roles'
				: section === 'palette'
					? 'Color palette'
					: 'Elevation'}
		</h1>
		<p class="intro">
			These samples read the current <code>--sy-*</code> tokens from the app. Change the browser
			or system color scheme to inspect the dark appearance.
		</p>
	</header>

	{#if section === 'roles'}
		<div class="role-grid">
			{#each roles as role}
				<article
					class="role-card"
					class:role-card--canvas={role.name === 'Canvas'}
					style:background-color={`var(${role.token})`}
				>
					<div class="role-card__sample">{role.name}</div>
					<div class="role-card__details">
						<strong>{role.name}</strong>
						<code>{role.token}</code>
						<span>{values[role.token]}</span>
						<p>{role.use}</p>
					</div>
				</article>
			{/each}
		</div>
	{:else if section === 'palette'}
		{#each palette as group}
			<section class="palette-group">
				<h2>{group.group}</h2>
				<div class="swatch-grid">
					{#each group.tokens as token}
						<div class="swatch">
							<div
								class="swatch__color"
								style:background-color={`var(${token})`}
							></div>
							<code>{token}</code>
							<span>{values[token]}</span>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<div class="elevation-grid">
			{#each elevation as shadow}
				<div class="elevation-sample" style:box-shadow={`var(${shadow.token})`}>
					<strong>{shadow.name}</strong>
					<code>{shadow.token}</code>
					<span>{values[shadow.token]}</span>
				</div>
			{/each}
		</div>
	{/if}
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(1100px, 100vw);
		height: 100vh;
		overflow: auto;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
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
		max-width: 680px;
		color: var(--sy-text--secondary);
		line-height: var(--sy-line-height--body);
	}
	code {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.role-grid,
	.swatch-grid,
	.elevation-grid {
		display: grid;
		gap: 18px;
	}
	.role-grid {
		grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
		margin-top: 36px;
	}
	.role-card {
		min-height: 220px;
		border: 1px solid var(--sy-control--border);
		border-radius: var(--sy-border-radius--content-list);
		overflow: hidden;
		box-shadow: var(--sy-shadow);
	}
	.role-card--canvas {
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}
	.role-card__sample {
		display: grid;
		place-content: center;
		min-height: 110px;
		font-weight: var(--sy-font-weight--bold);
	}
	.role-card__details {
		display: grid;
		gap: 4px;
		padding: 16px;
		background: var(--sy-surface--content);
		border-top: var(--sy-border);
	}
	.role-card__details p {
		margin: 8px 0 0;
		line-height: var(--sy-line-height--body);
	}
	.role-card__details span,
	.swatch span,
	.elevation-sample span {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
	}
	.palette-group {
		margin-top: 36px;
	}
	.palette-group h2 {
		font-size: var(--sy-font-size--medium);
	}
	.swatch-grid {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	.swatch {
		display: grid;
		gap: 6px;
		padding: 10px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	.swatch__color {
		height: 88px;
		border-radius: var(--sy-border-radius);
		border: var(--sy-border);
	}
	.elevation-grid {
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		margin-top: 44px;
	}
	.elevation-sample {
		display: grid;
		align-content: center;
		gap: 8px;
		min-height: 120px;
		padding: 18px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
	}
	@media (max-width: 680px) {
		.catalog {
			padding: 24px 20px 60px;
		}
	}
</style>
