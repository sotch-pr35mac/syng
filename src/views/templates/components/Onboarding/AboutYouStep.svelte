<script lang="ts">
	import { onboardingStore } from '@/stores/onboarding.svelte.js';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import {
		SURVEY_QUESTIONS,
		SURVEY_OTHER_MAX_LENGTH,
		type SurveyAnswers,
	} from '@/types/onboardingSurvey.js';
	const { disabled = false }: { disabled?: boolean } = $props();
	const question = $derived(SURVEY_QUESTIONS[onboardingStore.surveyQuestionIndex]);
	const otherKey = $derived(`${question.key}_other` as const);
	const otherOption = $derived(
		question.key === 'discovery_source' ? 'somewhere_else' : 'something_else'
	);
	const otherSelected = $derived(isSelected(otherOption));
	function isSelected(option: string): boolean {
		return question.key === 'goals'
			? (onboardingStore.surveyAnswers.goals?.includes(option) ?? false)
			: onboardingStore.surveyAnswers[question.key] === option;
	}
	function select(option: string, checked: boolean) {
		const answers = { ...onboardingStore.surveyAnswers };
		if (question.key === 'goals') {
			const goals = answers.goals ?? [];
			answers.goals = checked
				? [...goals.filter((goal) => goal !== option), option]
				: goals.filter((goal) => goal !== option);
		} else {
			answers[question.key] = option;
		}
		if (
			(question.key !== 'goals' && option !== otherOption) ||
			(option === otherOption && !checked)
		) {
			delete answers[otherKey];
		}
		onboardingStore.surveyAnswers = answers;
	}
	function clearAnswer() {
		const answers: SurveyAnswers = { ...onboardingStore.surveyAnswers };
		delete answers[question.key];
		delete answers[otherKey];
		onboardingStore.surveyAnswers = answers;
	}
</script>

<section class="about-you">
	<header>
		<h2>About you</h2>
		<p class="about-you__counter">
			Question {onboardingStore.surveyQuestionIndex + 1} of 3 · Optional
		</p>
		<p>Help us understand why you're using Syng.</p>
		<p class="about-you__optional">Answer only what you like, or skip the survey.</p>
	</header>
	<fieldset {disabled} aria-describedby={question.helper ? 'survey-help' : undefined}>
		<legend>{question.title}</legend>
		{#if question.helper}<p id="survey-help">{question.helper}</p>{/if}
		{#each question.options as option (option.id)}
			<label class="survey-choice">
				<input
					type={question.key === 'goals' ? 'checkbox' : 'radio'}
					name={question.key}
					checked={isSelected(option.id)}
					onchange={(event) => select(option.id, event.currentTarget.checked)}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
		{#if otherSelected}
			<div class="about-you__other">
				<label for="survey-other"
					>{question.key === 'discovery_source'
						? 'Where did you hear about Syng?'
						: 'Tell us a little more'} <span>(optional)</span></label
				>
				<SyTextInput
					id="survey-other"
					size="large"
					maxlength={SURVEY_OTHER_MAX_LENGTH}
					value={onboardingStore.surveyAnswers[otherKey] ?? ''}
					autocomplete="off"
					aria-describedby="survey-other-help"
					oninput={(value) => {
						onboardingStore.surveyAnswers = {
							...onboardingStore.surveyAnswers,
							[otherKey]: value,
						};
					}}
				/>
				<p id="survey-other-help">Up to {SURVEY_OTHER_MAX_LENGTH} characters.</p>
			</div>
		{/if}
		{#if question.key !== 'goals' && onboardingStore.surveyAnswers[question.key]}
			<div class="about-you__clear">
				<SyButton style="ghost" {disabled} onclick={clearAnswer}>Clear answer</SyButton>
			</div>
		{/if}
	</fieldset>
</section>

<style>
	.about-you {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}
	header {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--sy-font-size--heading);
	}
	.about-you__counter,
	#survey-help {
		color: var(--sy-text--muted);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--medium);
		min-width: 0;
	}
	legend {
		font-weight: var(--sy-font-weight--bold);
		margin-bottom: var(--sy-space--large);
	}
	.survey-choice {
		display: flex;
		align-items: center;
		gap: var(--sy-space--large);
		min-height: 44px;
		padding: var(--sy-space) var(--sy-space--large);
		box-sizing: border-box;
		border: 1px solid var(--sy-control--border);
		border-radius: var(--sy-border-radius);
		cursor: pointer;
	}
	.survey-choice:has(input:checked) {
		border-color: var(--sy-text--blue);
		background: color-mix(in srgb, var(--sy-text--blue) 10%, var(--sy-color--white));
		box-shadow: inset 0 0 0 1px var(--sy-text--blue);
	}
	@media (hover: hover) {
		.survey-choice:hover:not(:has(input:disabled)) {
			border-color: var(--sy-text--blue);
			background: color-mix(in srgb, var(--sy-text--blue) 7%, var(--sy-color--white));
		}
	}
	.survey-choice:active:not(:has(input:disabled)) {
		background: color-mix(in srgb, var(--sy-text--blue) 15%, var(--sy-color--white));
	}
	.survey-choice:has(input:focus-visible) {
		outline: 2px solid var(--sy-focus-color);
		outline-offset: 2px;
	}
	.survey-choice:has(input:disabled) {
		cursor: default;
	}
	input {
		accent-color: var(--sy-text--blue);
		flex-shrink: 0;
		margin: 0;
	}
	.about-you__optional {
		font-weight: var(--sy-font-weight--bold);
	}
	.about-you__other {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
		padding-top: var(--sy-space--large);
	}
	.about-you__other :global(input) {
		width: 100%;
		margin: 0;
		min-height: 44px;
	}
	.about-you__other span,
	#survey-other-help {
		color: var(--sy-text--muted);
	}
	#survey-other-help {
		font-size: var(--sy-font-size--small);
	}
	.about-you__clear {
		align-self: flex-start;
	}
</style>
