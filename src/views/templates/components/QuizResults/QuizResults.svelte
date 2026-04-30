<script lang="ts">
	import {
		GOOD_SCORE_THRESHOLD,
		OKAY_SCORE_THRESHOLD,
		type IncorrectAnswer,
	} from '@/composables/study.js';

	type Props = {
		score?: number;
		correct?: number;
		total?: number;
		incorrect?: IncorrectAnswer[];
		variant?: 'desktop' | 'mobile';
	};

	const {
		score = 0,
		correct = 0,
		total = 0,
		incorrect = [],
		variant = 'desktop',
	}: Props = $props();

	const scoreRatio = $derived(total ? correct / total : 0);
	const message = $derived.by(() => {
		if (correct === total) {
			return { label: 'Perfect score! Excellent work!', level: 'perfect' };
		}
		if (scoreRatio >= GOOD_SCORE_THRESHOLD) {
			return { label: 'Great job! Keep it up!', level: 'good' };
		}
		if (scoreRatio >= OKAY_SCORE_THRESHOLD) {
			return { label: 'Good effort! A bit more practice will help.', level: 'okay' };
		}
		return { label: "Keep practicing - you'll get there!", level: 'needs-work' };
	});
</script>

<div class="quiz-results" class:quiz-results--mobile={variant === 'mobile'}>
	<div class="quiz-results__score-container">
		<div class="quiz-results__score">
			<span class="quiz-results__score-text">{score}%</span>
			<span class="quiz-results__percentage">{correct}/{total}</span>
		</div>
		<p class="quiz-results__message quiz-results__message--{message.level}">
			{message.label}
		</p>
	</div>

	{#if incorrect.length > 0}
		<div class="quiz-results__incorrect">
			<h2 class="quiz-results__incorrect-title">Incorrect Answers</h2>
			<div class="quiz-results__incorrect-list">
				{#each incorrect as item, index (index)}
					<div class="quiz-results__incorrect-item">
						<div class="quiz-results__incorrect-question">
							<strong>Question:</strong>
							{item.question.MultipleChoice.question}
						</div>
						<div class="quiz-results__incorrect-details">
							<span>
								Your answer: <span class="quiz-results__incorrect-answer"
									>{item.response}</span
								>
							</span>
							<span>
								Correct answer:
								<span class="quiz-results__correct-answer">
									{item.question.MultipleChoice.answer}
								</span>
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.quiz-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: calc(var(--sy-space--extra-large) * 2);
		flex: 1;
		overflow-y: auto;
		width: 100%;
		box-sizing: border-box;
	}

	.quiz-results--mobile {
		gap: calc(var(--sy-mobile-space--large) * 2);
		min-height: 100%;
		padding: var(--sy-mobile-space--extra-large) var(--sy-mobile-space--large)
			calc(var(--sy-mobile-space--extra-large) + var(--sy-mobile-space--medium));
	}

	.quiz-results__score-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.quiz-results__score {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.quiz-results__score-text {
		font-size: var(--sy-font-size--display-extra-large);
		font-weight: 200;
		color: var(--sy-color--blue);
		line-height: 1;
		margin-bottom: var(--sy-space--large);
	}

	.quiz-results--mobile .quiz-results__score-text {
		font-size: clamp(4rem, 22vw, 6rem);
		margin-bottom: var(--sy-mobile-space--medium);
	}

	.quiz-results__percentage {
		font-size: var(--sy-font-size--display-medium);
		font-weight: 200;
		color: var(--sy-color--grey-3);
		margin-top: var(--sy-space);
	}

	.quiz-results--mobile .quiz-results__percentage {
		margin-top: var(--sy-mobile-space--medium);
		font-size: clamp(2.25rem, 12vw, 3.5rem);
	}

	.quiz-results__message {
		font-size: var(--sy-font-size--display-small);
		font-weight: 300;
		text-align: center;
	}

	.quiz-results--mobile .quiz-results__message {
		max-width: 20rem;
		margin: 0;
		font-size: clamp(1.125rem, 6vw, 1.75rem);
		line-height: 1.25;
	}

	.quiz-results__message--perfect {
		color: var(--sy-color--green-3);
	}

	.quiz-results__message--good {
		color: var(--sy-color--blue);
	}

	.quiz-results__message--okay {
		color: var(--sy-color--yellow);
	}

	.quiz-results__message--needs-work {
		color: var(--sy-color--grey-3);
	}

	.quiz-results__incorrect {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
	}

	.quiz-results--mobile .quiz-results__incorrect {
		max-width: 800px;
	}

	.quiz-results__incorrect-title {
		font-size: var(--sy-font-size--display-medium);
		font-weight: 300;
		margin-bottom: var(--sy-space--large);
		text-align: center;
		color: var(--sy-color--black);
	}

	.quiz-results--mobile .quiz-results__incorrect-title {
		margin: 0 0 var(--sy-mobile-space--large);
		font-size: clamp(1.75rem, 8vw, 2.5rem);
		font-weight: 300;
		text-align: center;
	}

	.quiz-results__incorrect-list {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}

	.quiz-results--mobile .quiz-results__incorrect-list {
		gap: var(--sy-mobile-space--large);
	}

	.quiz-results__incorrect-item {
		background-color: var(--sy-color--white);
		border-radius: var(--sy-border-radius);
		padding: var(--sy-space--large);
		box-shadow: var(--sy-shadow);
		border-left: var(--sy-result-accent-border-width) solid var(--sy-color--red);
	}

	.quiz-results--mobile .quiz-results__incorrect-item {
		padding: var(--sy-mobile-space--large);
		background-color: var(--sy-color--white);
		border: none;
		border-left: var(--sy-result-accent-border-width) solid var(--sy-color--red);
		box-shadow: var(--sy-shadow);
		font-size: var(--sy-font-size--mobile-large);
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.quiz-results__incorrect-question {
		font-size: var(--sy-font-size--display-small);
		margin-bottom: var(--sy-space);
		color: var(--sy-color--black);
	}

	.quiz-results--mobile .quiz-results__incorrect-question {
		font-size: var(--sy-font-size--mobile-extra-large);
		margin-bottom: var(--sy-mobile-space--medium);
	}

	.quiz-results__incorrect-details {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		font-size: var(--sy-font-size--display-extra-small);
		color: var(--sy-color--grey-3);
	}

	.quiz-results--mobile .quiz-results__incorrect-details {
		gap: var(--sy-mobile-space--medium);
		font-size: var(--sy-font-size--mobile-medium);
	}

	.quiz-results__incorrect-answer {
		color: var(--sy-color--red);
		font-weight: 600;
	}

	.quiz-results__correct-answer {
		color: var(--sy-color--green-3);
		font-weight: 600;
	}
</style>
