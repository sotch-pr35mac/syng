<script lang="ts">
	import ResultIndicator from '@/components/ResultIndicator/ResultIndicator.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';

	const parameters = new URLSearchParams(location.search);
	const mobile = parameters.has('mobile');
	const isCorrect = !parameters.has('incorrect');
	const chosenAnswer = parameters.has('longAnswer')
		? 'A long chosen answer with several words and 汉字 that should stay readable at larger text sizes'
		: '你好';
	let show = $state(false);
</script>

<main>
	<h1>Quiz feedback</h1>
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
