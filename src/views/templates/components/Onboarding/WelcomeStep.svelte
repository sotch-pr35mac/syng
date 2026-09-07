<script lang="ts">
	import { Award, Bookmark, BookOpen, GraduationCap, Search, SquareStack } from 'lucide-svelte';

	const features = [
		{
			id: 'search',
			title: 'Search',
			description:
				'Look up words and phrases with characters, pinyin, and English. Explore what their meaning and build vocabulary lists.',
			emphasized: true,
			icons: [Search],
		},
		{
			id: 'read',
			title: 'Read',
			description:
				'Read real Chinese and look up anything you don’t know without leaving the page.',
			emphasized: false,
			icons: [BookOpen],
		},
		{
			id: 'review',
			title: 'Review',
			description:
				'Save words you want to remember, then review them with flashcards and quizzes.',
			emphasized: false,
			icons: [Bookmark, GraduationCap],
		},
		{
			id: 'and_more',
			title: 'And More',
			description:
				'Go further with tone coloring, script conversion, pinyin tools, and more.',
			emphasized: false,
			icons: [Award, SquareStack],
		},
	];
</script>

<div class="welcome-step">
	<h2 class="welcome-step__title">Welcome to Syng</h2>
	<p class="welcome-step__intro">
		Syng helps you understand the Chinese you encounter and learn from it. Look up words, read
		real text, save what matters, and practice it later.
	</p>
	<ul class="welcome-step__features">
		{#each features as feature (feature.id)}
			<li
				class="welcome-step__feature"
				class:welcome-step__feature--emphasized={feature.emphasized}
			>
				<span class="welcome-step__icons" aria-hidden="true">
					{#each feature.icons as Icon, iconIndex (`${feature.id}-${iconIndex}`)}
						<Icon size="22" />
					{/each}
				</span>
				<div>
					<p class="welcome-step__feature-title">{feature.title}</p>
					<p class="welcome-step__feature-copy">{feature.description}</p>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.welcome-step {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}

	.welcome-step__title,
	.welcome-step__intro {
		text-align: center;
	}

	.welcome-step__title {
		margin: 0;
		font-size: var(--sy-font-size--large);
		font-weight: var(--sy-font-weight--bold);
	}

	.welcome-step__intro {
		margin: 0;
		font-size: var(--sy-font-size--medium);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	.welcome-step__features {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--sy-space--large);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.welcome-step__feature {
		display: flex;
		gap: var(--sy-space--extra-large);
		align-items: flex-start;
		padding: var(--sy-space--large);
		border-radius: var(--sy-border-radius);
	}

	.welcome-step__feature--emphasized {
		background-color: var(--sy-color--grey-2);
	}

	.welcome-step__icons {
		display: flex;
		gap: var(--sy-space);
		color: var(--sy-color--blue-2);
		flex-shrink: 0;
		margin-top: var(--sy-space);
	}

	.welcome-step__feature-title {
		margin: 0 0 var(--sy-space) 0;
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--bold);
	}

	.welcome-step__feature-copy {
		margin: 0;
		font-size: var(--sy-font-size--small);
		line-height: var(--sy-line-height--body);
		color: var(--sy-text--dark);
	}

	:global(.onboarding-flow--mobile) .welcome-step__title {
		font-size: var(--sy-font-size--mobile-extra-large);
	}

	:global(.onboarding-flow--mobile) .welcome-step__intro,
	:global(.onboarding-flow--mobile) .welcome-step__feature-title {
		font-size: var(--sy-font-size--mobile-medium);
	}

	:global(.onboarding-flow--mobile) .welcome-step__feature-copy {
		font-size: var(--sy-font-size--mobile-small);
	}

	@container onboarding (min-width: 36rem) {
		.welcome-step__features {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
