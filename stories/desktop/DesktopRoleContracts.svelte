<script lang="ts">
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyRadio from '@/components/SyRadio/SyRadio.svelte';
	import SyRadioGroup from '@/components/SyRadio/SyRadioGroup.svelte';

	type Sample = 'composition' | 'mapping' | 'interaction' | 'spatial' | 'gaps';
	const { sample }: { sample: Sample } = $props();

	const materialRoles = [
		{
			name: 'Canvas',
			token: '--sy-surface--canvas',
			job: 'Workspace behind route content with 15% static grain',
		},
		{ name: 'Chrome', token: '--sy-surface--chrome', job: 'Persistent app framing' },
		{
			name: 'Content',
			token: '--sy-surface--content',
			job: 'Primary reading and control material',
		},
		{ name: 'Well', token: '--sy-surface--well', job: 'Recessed controls and regions' },
		{ name: 'Floating', token: '--sy-surface--floating', job: 'Detached menus and dialogs' },
	] as const;

	const componentMapping = [
		{
			family: 'SyButton',
			material: 'Content (filled); transparent (ghost)',
			state: 'Hover/press grey-2; inset held state; focus, disabled, and semantic variants',
			examples: 'Outer shadow at rest; brief recessed press feedback',
		},
		{
			family: 'SyButtonBar',
			material: 'No material of its own',
			state: 'Groups button geometry; child states remain independent',
			examples: 'Padding and layout, no elevation',
		},
		{
			family: 'SyCollapsibleList',
			material: 'One content list; well details',
			state: 'Chevron and aria-expanded identify disclosure',
			examples: 'Inset grey-2 header hover; shared list shadow',
		},
		{
			family: 'SyDropdown',
			material: 'Floating menu; trigger owns its material',
			state: 'Well item hover; selected item and keyboard focus',
			examples: 'Inset menu items; shared raised shadow and anchored motion',
		},
		{
			family: 'SyList',
			material: 'Content list; preview rows use content/well',
			state: 'Dividers; preview selection and hover',
			examples: 'Content style has outer shadow; preview style is flatter',
		},
		{
			family: 'SyModal',
			material: 'Floating panel over modal scrim',
			state: 'Dialog focus, Escape, close, and background isolation',
			examples: 'Plain 12px shell and dialog shadow; mobile retains its overlay shadow',
		},
		{
			family: 'SyPopover',
			material: 'Floating panel; mobile sheet presentation',
			state: 'Anchor, open/close, focus, dismissal',
			examples: 'Raised shadow on desktop; mobile sheet has its own elevation',
		},
		{
			family: 'SyProgressLine',
			material: 'Well track with colored fill',
			state: 'Progress is informational, not clickable',
			examples: 'Flat indicator; fill color comes from its progress props',
		},
		{
			family: 'SyRadio',
			material: 'Content selection within a well track when grouped',
			state: 'Native radio semantics, sliding choice, keyboard focus, disabled',
			examples: 'Standalone radio retains its original circle',
		},
		{
			family: 'SyTab',
			material: 'Transparent on its parent surface',
			state: 'Blue underline slides to selection; reduced motion snaps',
			examples: 'No elevation; mobile underline follows its label',
		},
		{
			family: 'SyTag',
			material: 'Semantic blue/green/yellow/red fill',
			state: 'Informational label, not an action',
			examples: 'Flat; foreground pairs with semantic fill',
		},
		{
			family: 'SyTextInput',
			material: 'Content fill or transparent ghost',
			state: 'Input border and focus; ghost keeps its parent material',
			examples: 'Inset shadow on bounded desktop input',
		},
		{
			family: 'SyTimer',
			material: 'Transparent control on its parent',
			state: 'Pause/resume button and time progression',
			examples: 'No card elevation',
		},
		{
			family: 'SyToast',
			material: 'Floating fill; spatially detached',
			state: 'Status, optional action, dismiss',
			examples: 'Screen-corner layer with raised shadow and edge-origin motion',
		},
		{
			family: 'SyToggle',
			material: 'Semantic on/off track and control knob',
			state: 'Checked, press, focus, disabled',
			examples: 'Flat native checkbox semantics',
		},
	] as const;

	const foregroundRoles = [
		{ name: 'Primary', token: '--sy-text--dark', note: 'Main reading and control labels' },
		{ name: 'Secondary', token: '--sy-text--secondary', note: 'Supporting information' },
		{ name: 'Muted', token: '--sy-text--muted', note: 'Quiet metadata' },
		{ name: 'Action', token: '--sy-text--blue', note: 'Interactive emphasis' },
		{ name: 'Success', token: '--sy-text--green', note: 'Positive semantic state' },
		{ name: 'Warning', token: '--sy-text--yellow', note: 'Caution semantic state' },
		{ name: 'Error', token: '--sy-text--red', note: 'Negative semantic state' },
	] as const;

	let selectedChoice = $state('characters');
	let buttonPresses = $state(0);
</script>

<main class="catalog">
	<header class="catalog__header">
		<p class="eyebrow">Syng · desktop design system</p>
		<h1>
			{sample === 'composition'
				? 'Composed surface roles'
				: sample === 'mapping'
					? 'Component role mapping'
					: sample === 'interaction'
						? 'Interaction and foreground'
						: sample === 'spatial'
							? 'Spatial layers'
							: 'Exceptions and open questions'}
		</h1>
		<p>
			These specimens document the current source. A role describes a material's job, while
			foreground, interaction, and spatial rules describe different aspects of the same
			component.
		</p>
	</header>

	{#if sample === 'composition'}
		<section class="composition" aria-label="Nested surface role specimen">
			<aside class="composition__rail">
				<strong>Chrome</strong>
				<code>--sy-surface--chrome</code>
				<span>Navigation</span>
			</aside>
			<div class="composition__workspace">
				<div class="composition__toolbar">
					<strong>Chrome</strong>
					<span>Persistent route header</span>
				</div>
				<div class="composition__canvas">
					<div class="role-caption">
						<strong>Canvas</strong>
						<code>--sy-surface--canvas</code>
					</div>
					<div class="composition__content">
						<div class="role-caption">
							<strong>Content</strong>
							<code>--sy-surface--content</code>
						</div>
						<p>Primary information and controls live here.</p>
						<div class="composition__well">
							<strong>Well</strong>
							<code>--sy-surface--well</code>
							<span>A recessed part of the content surface</span>
						</div>
						<div class="composition__floating">
							<strong>Floating</strong>
							<code>--sy-surface--floating</code>
							<span>A detached menu above its source</span>
						</div>
					</div>
				</div>
			</div>
		</section>
		<div class="material-key">
			{#each materialRoles as role}
				<div>
					<strong>{role.name}</strong><code>{role.token}</code><span>{role.job}</span>
				</div>
			{/each}
		</div>
	{:else if sample === 'mapping'}
		<div class="table-wrap">
			<table>
				<caption>Current source mapping; not a proposed restyle</caption>
				<thead
					><tr
						><th scope="col">Element</th><th scope="col">Material role</th><th
							scope="col">Other role or state</th
						><th scope="col">Spatial role or note</th></tr
					></thead
				>
				<tbody>
					{#each componentMapping as row}
						<tr
							><th scope="row">{row.family}</th><td>{row.material}</td><td
								>{row.state}</td
							><td>{row.examples}</td></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			The five neutral roles describe material. They do not replace Chinese tone colors,
			semantic feedback, Reader page palettes, or component states.
		</p>
	{:else if sample === 'interaction'}
		<div class="example-grid">
			<section class="example-card">
				<h2>Action affordance</h2>
				<p>
					A button has a command label and a control shape at rest. Hover, press, focus,
					and disabled states reinforce it.
				</p>
				<p class="state-note">
					Neutral button hover and press use the shipped <code>--sy-color--grey-2</code>
					state color. While held, the button uses the shared well shadow. The color state and
					inset depth are separate from the <code>--sy-surface--well</code> material role.
				</p>
				<div class="action-row">
					<SyButton size="large" onclick={() => (buttonPresses += 1)}
						>Save example</SyButton
					>
					<SyButton size="large" disabled>Unavailable</SyButton>
				</div>
				<p class="result" role="status">Activations: {buttonPresses}</p>
			</section>
			<section class="example-card">
				<h2>Choice affordance</h2>
				<p>
					A visible selected indicator and a shared radio name express one choice from a
					set.
				</p>
				<fieldset class="choice-group">
					<legend>Practice prompt</legend>
					<SyRadioGroup selectedValue={selectedChoice}>
						<label
							><SyRadio
								name="role-contract-choice"
								value="characters"
								checked={selectedChoice === 'characters'}
								onchange={() => (selectedChoice = 'characters')}
							/><span>Characters</span></label
						>
						<label
							><SyRadio
								name="role-contract-choice"
								value="english"
								checked={selectedChoice === 'english'}
								onchange={() => (selectedChoice = 'english')}
							/><span>English</span></label
						>
					</SyRadioGroup>
				</fieldset>
			</section>
		</div>
		<section class="foreground">
			<h2>Foreground roles on content</h2>
			<div class="foreground__grid">
				{#each foregroundRoles as role}
					<div>
						<strong style:color={`var(${role.token})`}>{role.name}</strong><code
							>{role.token}</code
						><span>{role.note}</span>
					</div>
				{/each}
			</div>
		</section>
	{:else if sample === 'spatial'}
		<div class="spatial-grid">
			<div class="spatial-card spatial-card--canvas">
				<strong>Canvas</strong><span>The base workspace has no elevation.</span>
			</div>
			<div class="spatial-card spatial-card--content">
				<strong>Content</strong><code>--sy-shadow</code><span
					>Card and list elevation is contextual, not a clickable cue.</span
				>
			</div>
			<div class="spatial-card spatial-card--well">
				<strong>Well</strong><code>--sy-inner-shadow</code><span
					>Inset depth communicates a recessed region.</span
				>
			</div>
			<div class="spatial-card spatial-card--floating">
				<strong>Floating</strong><code>--sy-shadow--raised</code><span
					>Menus and overlays sit over their source.</span
				>
			</div>
			<div class="spatial-card spatial-card--compact">
				<strong>Compact floating</strong><code>--sy-shadow--floating-compact</code><span
					>Tooltips, status badges, and small notices keep a fine edge.</span
				>
			</div>
		</div>
		<section class="shadow-rule">
			<h2>Dark-mode shadow rule</h2>
			<p>
				Use the light <code>--sy-shadow</code> rim for shallow surfaces that sit on their
				parent: content lists, controls, and selection pills.
				<code>--sy-shadow--active</code>
				intensifies that rim on hover or press. It describes an edge, not clickability.
			</p>
			<p>
				Use dark boundary shadows under headers and action bars, dark
				<code>--sy-pane-shadow</code> for overlapping panes, and dark
				<code>--sy-shadow--raised</code> or matching overlay shadows for menus, sheets,
				toasts, and dialogs. Small detached hints and badges use
				<code>--sy-shadow--floating-compact</code>: dark depth with a thin light edge.
				Recessed wells and pressed controls use the dark inset
				<code>--sy-inner-shadow</code>. Preserve borders or focus cues where action
				affordance is needed.
			</p>
		</section>
		<div class="scrim">
			<div>
				<strong>Modal scrim</strong><code>--sy-color--modal-overlay</code><span
					>Separate from the five solid neutral materials.</span
				>
			</div>
		</div>
	{:else}
		<div class="gaps">
			<section>
				<h2>Current exceptions</h2>
				<ul>
					<li>
						Reader page palettes have their own saved appearance; the surrounding app
						shell still uses the neutral roles.
					</li>
					<li>
						Chinese tone colors, semantic feedback, and brand artwork communicate
						meaning outside the neutral material scale.
					</li>
					<li>
						OfflineIndicator and WalkthroughHost are spatial overlays but currently use
						the content fill. Their material and spatial roles should be reviewed
						together before changing color.
					</li>
				</ul>
			</section>
			<section>
				<h2>Proposed catalog extensions</h2>
				<ul>
					<li>
						Specify allowed nesting, border, elevation, and state behavior for each
						material role.
					</li>
					<li>
						Show every component family in both Original and Increase Contrast, with
						light and dark schemes.
					</li>
					<li>
						Add mobile specimens for touch, sheets, safe areas, and Android tablet
						density.
					</li>
					<li>
						Record sound and haptic rules only after platform capability and
						learning-value decisions.
					</li>
				</ul>
			</section>
		</div>
	{/if}
</main>

<style>
	.catalog {
		box-sizing: border-box;
		width: min(1180px, 100vw);
		min-height: 100vh;
		padding: 44px 48px 80px;
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
		color: var(--sy-text--dark);
		font-family: var(--sy-font-family);
	}
	.catalog__header {
		max-width: 760px;
		margin-bottom: 32px;
	}
	.eyebrow {
		color: var(--sy-text--muted);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 4px 0 12px;
		font-size: var(--sy-font-size--heading);
	}
	h2 {
		margin: 0 0 12px;
		font-size: var(--sy-font-size--large);
	}
	p,
	li {
		line-height: var(--sy-line-height--body);
	}
	code {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.72rem;
		overflow-wrap: anywhere;
	}
	.composition {
		display: grid;
		grid-template-columns: 138px minmax(0, 1fr);
		min-height: 440px;
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		overflow: hidden;
		box-shadow: var(--sy-pane-shadow);
	}
	.composition__rail,
	.composition__toolbar {
		background: var(--sy-surface--chrome);
	}
	.composition__rail {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 24px 16px;
		border-right: var(--sy-surface-border);
	}
	.composition__rail span {
		margin-top: 22px;
	}
	.composition__workspace {
		min-width: 0;
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
	}
	.composition__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 24px;
		border-bottom: var(--sy-surface-border);
	}
	.composition__canvas {
		padding: 24px;
	}
	.role-caption,
	.material-key > div {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px;
	}
	.composition__content {
		position: relative;
		min-height: 250px;
		margin-top: 20px;
		padding: 22px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	.composition__well {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 340px;
		margin-top: 18px;
		padding: 14px 18px;
		background: var(--sy-surface--well);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-inner-shadow);
	}
	.composition__floating {
		position: absolute;
		right: 24px;
		bottom: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 220px;
		padding: 15px 18px;
		background: var(--sy-surface--floating);
		border: var(--sy-surface-border);
		border-radius: var(--sy-border-radius--floating);
		box-shadow: var(--sy-shadow--raised);
	}
	.material-key,
	.example-grid,
	.foreground__grid,
	.spatial-grid,
	.gaps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}
	.material-key {
		margin-top: 64px;
	}
	.spatial-grid {
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
	}
	.material-key > div,
	.example-card,
	.foreground,
	.spatial-card,
	.gaps section {
		padding: 20px;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	.material-key > div {
		flex-direction: column;
		gap: 6px;
	}
	.material-key span,
	.spatial-card span,
	.foreground span,
	.note {
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--small);
	}
	.table-wrap {
		overflow-x: auto;
		background: var(--sy-surface--content);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	caption {
		padding: 18px;
		text-align: left;
		color: var(--sy-text--secondary);
	}
	th,
	td {
		padding: 16px;
		border-top: var(--sy-border);
		vertical-align: top;
		line-height: var(--sy-line-height--body);
	}
	thead th {
		background: var(--sy-surface--well);
	}
	tbody th {
		width: 22%;
	}
	.note {
		margin-top: 22px;
	}
	.example-grid {
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}
	.action-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 24px;
	}
	.result {
		color: var(--sy-text--secondary);
		font-size: var(--sy-font-size--small);
	}
	.choice-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 20px;
		padding: 0;
		border: 0;
	}
	.choice-group legend {
		margin-bottom: 12px;
		font-weight: var(--sy-font-weight--bold);
	}
	.foreground {
		margin-top: 18px;
	}
	.foreground__grid {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	.foreground__grid > div,
	.spatial-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.spatial-card--canvas {
		background: var(--sy-surface--canvas);
		background-image: var(--sy-surface--canvas-texture);
		background-blend-mode: var(--sy-surface--canvas-texture-blend);
		box-shadow: none;
	}
	.spatial-card--content {
		box-shadow: var(--sy-shadow);
	}
	.spatial-card--well {
		background: var(--sy-surface--well);
		box-shadow: var(--sy-inner-shadow);
	}
	.spatial-card--floating {
		background: var(--sy-surface--floating);
		box-shadow: var(--sy-shadow--raised);
	}
	.spatial-card--compact {
		background: var(--sy-surface--floating);
		box-shadow: var(--sy-shadow--floating-compact, var(--sy-shadow--active));
	}
	.shadow-rule {
		margin-top: 22px;
		padding: 18px 20px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.shadow-rule h2 {
		margin: 0 0 10px;
		font-size: var(--sy-font-size--large);
	}
	.shadow-rule p {
		margin: 0;
		line-height: 1.5;
	}
	.shadow-rule p + p {
		margin-top: 10px;
	}
	.scrim {
		display: grid;
		place-content: center;
		min-height: 180px;
		margin-top: 22px;
		background: var(--sy-color--modal-overlay);
		border-radius: var(--sy-border-radius--content-list);
	}
	.scrim > div {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 20px;
		background: var(--sy-surface--floating);
		border-radius: var(--sy-border-radius--content-list);
		box-shadow: var(--sy-shadow--active);
	}
	.gaps {
		grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
	}
	.gaps ul {
		margin: 0;
		padding-left: 22px;
	}
	.gaps li + li {
		margin-top: 12px;
	}
	@media (max-width: 700px) {
		.catalog {
			padding: 24px 20px 60px;
		}
		.composition {
			grid-template-columns: 1fr;
		}
		.composition__rail {
			flex-direction: row;
			align-items: baseline;
			border-right: 0;
			border-bottom: var(--sy-surface-border);
		}
		.composition__rail span {
			margin: 0;
		}
		.composition__floating {
			position: static;
			margin-top: 16px;
		}
		.material-key {
			margin-top: 24px;
		}
	}
</style>
