<script lang="ts">
	import ResultIndicator from '@/components/ResultIndicator/ResultIndicator.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyTimer from '@/components/SyTimer/SyTimer.svelte';
	import MobileTimer from '@/components/MobileTimer/MobileTimer.svelte';
	import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
	import { setPreferenceManagerForTest } from '@/utils/appServices.js';

	const parameters = new URLSearchParams(location.search);
	const mobile = parameters.has('mobile');
	const showTimers = parameters.has('timers');
	const Timer = mobile ? MobileTimer : SyTimer;
	const isCorrect = !parameters.has('incorrect');
	const chosenAnswer = parameters.has('longAnswer')
		? 'A long chosen answer with several words and 汉字 that should stay readable at larger text sizes'
		: '你好';
	let show = $state(false);
	let suspended = $state(false);

	if (showTimers) {
		setPreferenceManagerForTest({
			set: () => {},
		} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	}
</script>

<main>
	<h1>Quiz feedback</h1>
	{#if showTimers}
		<IncreaseContrastSettings />
		<SyButton onclick={() => (suspended = !suspended)}>
			{suspended ? 'Resume timers' : 'Suspend timers'}
		</SyButton>
		<section aria-label="Result timer">
			<Timer autoStart {suspended} />
		</section>
		<section aria-label="Question timer">
			<Timer autoStart {suspended} progressColor="var(--sy-fill--red)" />
		</section>
	{/if}
	<SyButton onclick={() => (show = !show)}>Toggle feedback</SyButton>
	<div class="feedback">
		<ResultIndicator
			{show}
			{isCorrect}
			{chosenAnswer}
			slideAxis={mobile ? 'y' : 'x'}
			timerVisible={!mobile}
			suspended
		/>
	</div>
</main>

<style>
	main {
		padding: 1rem;
	}
	.feedback {
		display: flex;
		max-width: 40rem;
		margin-top: 1rem;
	}
</style>
