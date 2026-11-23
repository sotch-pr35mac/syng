<script lang="ts">
	type Sample = 'shared' | 'audio' | 'rss' | 'sentence' | 'history' | 'configuration' | 'stats';
	type Requirement = {
		pattern: string;
		material: string;
		behavior: string;
		status: 'Existing anchor' | 'Extend pattern' | 'New pattern';
	};
	type Feature = {
		title: string;
		intent: string;
		current: string;
		accepted?: string;
		requirements: Requirement[];
		questions: string[];
	};

	const { sample }: { sample: Sample } = $props();

	const sharedRequirements: Requirement[] = [
		{
			pattern: 'Source identity and state',
			material: 'Content row on canvas; quiet metadata',
			behavior:
				'Show origin, saved position, freshness, and offline availability without using color alone.',
			status: 'Extend pattern',
		},
		{
			pattern: 'Persistent activity control',
			material: 'Chrome beside the active workspace',
			behavior:
				'Transport or active task stays reachable while an attached detail surface opens.',
			status: 'New pattern',
		},
		{
			pattern: 'Annotated language',
			material: 'Reader palette or content; floating details',
			behavior:
				'Separate active playback, selected text, dictionary lookup, and analysis focus.',
			status: 'Extend pattern',
		},
		{
			pattern: 'Time-based evidence',
			material: 'Content charts; well filters and legends',
			behavior: 'Pair visual trends with values, dates, and a keyboard-readable data view.',
			status: 'New pattern',
		},
		{
			pattern: 'Grouped preferences',
			material: 'Content section; well choice track',
			behavior: 'Explain the scope, saved state, and effect of question or timing choices.',
			status: 'Extend pattern',
		},
	];

	const features: Record<Exclude<Sample, 'shared'>, Feature> = {
		audio: {
			title: 'Listen and read',
			intent: 'Podcasts and audiobooks combine a full player, time-aligned transcript, and dictionary lookup in Reader.',
			current:
				'Reader has local document cards, saved reading locators, token-level dictionary lookup, and separate reading palettes. There is no current media transport or transcript sync pattern.',
			accepted:
				'Podcast support includes both a refreshing episode feed and live audio streaming. Preston clarified this on 2026-11-13.',
			requirements: [
				{
					pattern: 'Media source row',
					material: 'Content on canvas',
					behavior:
						'Distinguish episode/book identity, feed or file origin, duration, and offline state.',
					status: 'Extend pattern',
				},
				{
					pattern: 'Episode feed and live state',
					material: 'Content list on canvas; status beside transport',
					behavior:
						'Show feed refresh and episode availability separately from live connection, buffering, and playback state.',
					status: 'New pattern',
				},
				{
					pattern: 'Playback transport',
					material: 'Proposed chrome layer',
					behavior:
						'Play, pause, speed, and progress remain available while reading; seek and duration appear only when the source supports them.',
					status: 'New pattern',
				},
				{
					pattern: 'Timed transcript',
					material: 'Reader page palette',
					behavior:
						'Current spoken span is distinct from the word opened in DictionaryPopover; seeking and lookup do not silently change each other.',
					status: 'New pattern',
				},
			],
			questions: [
				'Should playback continue across Reader navigation and when a dictionary detail opens?',
				'What is the offline contract for episodes, books, transcripts, and feed refresh, and what happens when a live stream disconnects?',
				'How should missing, delayed, or imperfect transcript alignment be explained?',
			],
		},
		rss: {
			title: 'Article feeds',
			intent: 'RSS subscriptions turn one-off webpage reading into a revisitable stream of articles.',
			current:
				'Reader can import a single webpage into the local library. Feed subscription, update state, and read/unread article states are not present.',
			requirements: [
				{
					pattern: 'Feed and article rows',
					material: 'Content list on canvas',
					behavior:
						'Separate source, article title, publication time, read state, and saved availability.',
					status: 'Extend pattern',
				},
				{
					pattern: 'Refresh status',
					material: 'Quiet status in chrome or row',
					behavior:
						'Show last refresh, pending updates, failures, and retry without implying constant connectivity.',
					status: 'New pattern',
				},
				{
					pattern: 'Article reading',
					material: 'Reader page palette',
					behavior:
						'Retain dictionary lookup and reading position while preserving source attribution.',
					status: 'Extend pattern',
				},
			],
			questions: [
				'Are feed items automatically cached for offline reading, or saved individually?',
				'Do feeds live among documents or in a distinct Reader collection?',
				'What should count as read: opening, reaching the end, or an explicit action?',
			],
		},
		sentence: {
			title: 'Sentence decomposition',
			intent: 'Explain contextual word boundaries, parts of speech, grammar, dependency, and clause structure while reading.',
			current:
				'ReaderText exposes clickable lexical tokens and DictionaryPopover explains words. It does not present overlapping phrase or sentence relationships.',
			requirements: [
				{
					pattern: 'Selectable span layers',
					material: 'Reader palette or content text',
					behavior:
						'Word, phrase, clause, and sentence focus need distinct, reversible states without obscuring the original text.',
					status: 'New pattern',
				},
				{
					pattern: 'Relationship explanation',
					material: 'Content panel; floating detail when contextual',
					behavior:
						'Present labels, relationships, and grammar notes in text as well as any diagram.',
					status: 'New pattern',
				},
				{
					pattern: 'Lookup coexistence',
					material: 'Current DictionaryPopover role',
					behavior:
						'A dictionary word selection and an analysis span must have a predictable priority and return path.',
					status: 'Extend pattern',
				},
			],
			questions: [
				'Is analysis on demand per sentence, or always available on the reading surface?',
				'How will low-confidence, ambiguous, or unavailable parses be presented?',
				'Which relationship view should be primary on phone versus iPad/desktop?',
			],
		},
		history: {
			title: 'Study history',
			intent: 'Let learners inspect practice over time without conflating activity, quiz accuracy, and mastery.',
			current:
				'Study offers list-based flashcards and quizzes; quiz results report a session score and incorrect answers. Reader progress tracks location only. No longitudinal study chart is established.',
			accepted:
				'Include both learning outcomes and activity, with accuracy and mastery most prominent. Preston clarified this on 2026-11-13.',
			requirements: [
				{
					pattern: 'Metric hierarchy',
					material: 'Primary outcome summary; quieter activity context',
					behavior:
						'Lead with accuracy and a separately defined mastery measure; show activity and consistency as supporting evidence.',
					status: 'New pattern',
				},
				{
					pattern: 'Metric definition',
					material: 'Content summary with secondary explanation',
					behavior:
						'Name the numerator, denominator, time period, and source for every metric; do not equate quiz accuracy with mastery.',
					status: 'New pattern',
				},
				{
					pattern: 'Trend chart and table',
					material: 'Content chart; well controls',
					behavior:
						'Show scale, dates, gaps, and exact values; provide a nonvisual data view.',
					status: 'New pattern',
				},
				{
					pattern: 'Session detail',
					material: 'Content list and floating detail',
					behavior:
						'Connect a historical point to its list, mode, score, and answer review where stored.',
					status: 'Extend pattern',
				},
			],
			questions: [
				'Which events should be stored: quiz completion, flashcard reviews, time spent, or all three?',
				'What evidence should count toward mastery beyond a correct answer?',
				'Should history be per list, overall, or both?',
				'How long should local history remain available, and can users delete or export it?',
			],
		},
		configuration: {
			title: 'Study configuration',
			intent: 'Allow question-type and timing choices without making session setup feel like a second Settings app.',
			current:
				'Study starts from a chosen list. Quiz and timer behavior are in the current session flow; SyRadio, SyToggle, and Settings patterns exist, but no advanced study configuration contract is established.',
			requirements: [
				{
					pattern: 'Choice groups',
					material: 'Content section; proposed well track',
					behavior:
						'Separate single-choice mode from multiple-choice question inclusions; explain disabled combinations.',
					status: 'Extend pattern',
				},
				{
					pattern: 'Time control',
					material: 'Content control with clear unit',
					behavior:
						'Expose timed/untimed and duration choices with a preview of their session effect.',
					status: 'New pattern',
				},
				{
					pattern: 'Saved scope',
					material: 'Secondary text near the action',
					behavior:
						'State whether changes apply to this run, this list, or future sessions.',
					status: 'New pattern',
				},
			],
			questions: [
				'Which settings should be quick session choices versus durable preferences?',
				'What are valid question combinations and sensible defaults?',
				'Does an active session accept timing changes, or only the next one?',
			],
		},
		stats: {
			title: 'Learning stats',
			intent: 'A personal yearly or all-time summary can make progress memorable without inventing mastery claims.',
			current:
				'Syng has Reader location and quiz session results, but no established longitudinal learning model or stats presentation.',
			accepted:
				'Use the same outcome-first hierarchy as Study history: accuracy and defined mastery lead; activity adds context. Preston clarified this on 2026-11-13.',
			requirements: [
				{
					pattern: 'Story panels',
					material: 'Content sections on canvas',
					behavior:
						'Lead with source-backed accuracy and mastery measures; place activity and consistency alongside them as context, with accessible text equivalents.',
					status: 'New pattern',
				},
				{
					pattern: 'Time and source context',
					material: 'Secondary text and well filters',
					behavior:
						'Name the covered period, excluded data, and whether the view is installation-local.',
					status: 'New pattern',
				},
				{
					pattern: 'Optional sharing',
					material: 'Action control and share preview',
					behavior:
						'Give explicit control over which personal data appears before export or sharing.',
					status: 'New pattern',
				},
			],
			questions: [
				'Is the summary private in-app only, or should it support export/share?',
				'Which measures feel rewarding without encouraging quantity over learning?',
				'How should sparse or newly collected history be celebrated honestly?',
			],
		},
	};

	const currentFeature = $derived(sample === 'shared' ? null : features[sample]);
</script>

<main class="catalog">
	<header class="header">
		<p class="eyebrow">Design-system planning</p>
		<h1>{currentFeature?.title ?? 'Shared contracts for future features'}</h1>
		<p class="intro">
			{currentFeature?.intent ??
				'Upcoming Reader and Study features put new pressure on source identity, persistent controls, annotated language, metrics, and preferences. These are requirements to discuss, not approved components.'}
		</p>
		{#if currentFeature?.accepted}
			<p class="accepted"><strong>Accepted direction</strong> · {currentFeature.accepted}</p>
		{/if}
	</header>

	<section class="context" aria-label="Current application anchor">
		<div class="context-label">Current anchor</div>
		<p>
			{currentFeature?.current ??
				'Syng is an offline-first Tauri app. Desktop and iPad use the desktop shell; phones and Android tablets use the mobile shell. The current five neutral materials cover canvas, chrome, content, well, and floating. Reader uses its own reading palettes.'}
		</p>
	</section>

	<section class="requirements" aria-label="Pattern requirements">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Role mapping</p>
				<h2>{sample === 'shared' ? 'Reusable patterns' : 'Patterns this feature needs'}</h2>
			</div>
			<span class="section-note">Material · behavior · gap</span>
		</div>
		<div class="pattern-list">
			{#each currentFeature?.requirements ?? sharedRequirements as requirement (requirement.pattern)}
				<article class="pattern">
					<div class="pattern-heading">
						<h3>{requirement.pattern}</h3>
						<span
							class="status"
							class:status--new={requirement.status === 'New pattern'}
							>{requirement.status}</span
						>
					</div>
					<div class="pattern-detail">
						<div>
							<span>Material role</span>
							<p>{requirement.material}</p>
						</div>
						<div>
							<span>Behavior contract</span>
							<p>{requirement.behavior}</p>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="questions" aria-label="Questions for the design discussion">
		<p class="eyebrow">Decisions still needed</p>
		<h2>{sample === 'shared' ? 'Across these features' : 'Before a production design'}</h2>
		<ol>
			{#each currentFeature?.questions ?? ['Which content is durable and available offline, and which states require a network?', 'What is the difference between activity, reading position, performance, and learning progress?', 'How do persistent controls adapt to the mobile action dock and collapsible sheets without crowding them?'] as question (question)}
				<li>{question}</li>
			{/each}
		</ol>
	</section>
	<footer>
		Existing anchor means Syng already has a related interaction. Extend and new patterns are
		planning gaps; their labels and role assignments are proposals. Accepted direction records
		Preston's stated product preferences; this catalog does not define APIs or data schemas.
	</footer>
</main>

<style>
	.catalog {
		box-sizing: border-box;
		min-height: 100vh;
		padding: 40px clamp(20px, 5vw, 64px) 60px;
		background: var(--sy-surface--canvas);
		color: var(--sy-text--dark);
		font-family: var(--sy-font-family);
	}
	.catalog > * {
		max-width: 1040px;
		margin-inline: auto;
	}
	.header {
		margin-bottom: 28px;
	}
	.eyebrow {
		margin: 0 0 9px;
		color: var(--sy-text--blue);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 9px;
		font-size: clamp(28px, 4vw, 42px);
		letter-spacing: -0.035em;
	}
	h2 {
		margin-bottom: 0;
		font-size: 19px;
		letter-spacing: -0.02em;
	}
	h3 {
		margin-bottom: 0;
		font-size: 16px;
	}
	.intro {
		max-width: 750px;
		margin-bottom: 0;
		color: var(--sy-text--secondary);
		line-height: 1.55;
	}
	.accepted {
		max-width: 750px;
		margin: 14px 0 0;
		line-height: 1.55;
	}
	.context {
		display: grid;
		grid-template-columns: 155px 1fr;
		gap: 24px;
		padding: 22px 24px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
		box-shadow: var(--sy-shadow);
	}
	.context-label {
		color: var(--sy-text--muted);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.context p {
		margin: 0;
		line-height: 1.55;
	}
	.requirements {
		margin-top: 34px;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 14px;
	}
	.section-note {
		color: var(--sy-text--muted);
		font-size: 12px;
	}
	.pattern-list {
		display: grid;
		gap: 10px;
	}
	.pattern {
		padding: 20px 23px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
	}
	.pattern-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}
	.status {
		flex: 0 0 auto;
		border-radius: 999px;
		padding: 5px 10px;
		background: var(--sy-surface--well);
		color: var(--sy-text--secondary);
		font-size: 11px;
		font-weight: 700;
	}
	.status--new {
		color: var(--sy-text--blue);
	}
	.pattern-detail {
		display: grid;
		grid-template-columns: minmax(170px, 0.7fr) minmax(260px, 1.3fr);
		gap: 24px;
		margin-top: 17px;
	}
	.pattern-detail span {
		color: var(--sy-text--muted);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pattern-detail p {
		margin: 5px 0 0;
		line-height: 1.5;
	}
	.questions {
		margin-top: 34px;
		padding: 23px 25px;
		border-radius: var(--sy-border-radius--content-list);
		background: var(--sy-surface--content);
	}
	.questions ol {
		margin: 16px 0 0;
		padding-left: 22px;
		line-height: 1.55;
	}
	.questions li + li {
		margin-top: 9px;
	}
	footer {
		margin-top: 20px;
		color: var(--sy-text--muted);
		font-size: 12px;
		line-height: 1.5;
	}
	@media (max-width: 650px) {
		.context,
		.pattern-detail {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.section-note {
			display: none;
		}
		.pattern-heading {
			align-items: start;
		}
	}
</style>
