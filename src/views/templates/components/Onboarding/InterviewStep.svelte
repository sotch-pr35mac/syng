<script lang="ts">
	import { openUrl } from '@tauri-apps/plugin-opener';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import { privacySettingsStore } from '@/stores/privacySettings.svelte.js';
	import {
		INTERVIEW_CONSENT,
		interviewErrorMessage,
		submitInterviewSignup,
	} from '@/utils/interviews.js';

	interface Props {
		variant?: 'desktop' | 'mobile';
		submitting?: boolean;
		oncomplete: () => Promise<void>;
	}
	// eslint-disable-next-line prefer-const -- Svelte bindable props need one mutable $props declaration.
	let { variant = 'desktop', submitting = $bindable(false), oncomplete }: Props = $props();
	let preferredName = $state('');
	let email = $state('');
	let consent = $state(false);
	let errorMessage = $state('');
	let errorElement = $state<HTMLParagraphElement>();
	let submissionId = '';
	let previousPayload = '';
	const privacyUrl = 'https://getsyng.com/privacy';
	const preferredNameMaxLength = 80;
	const emailMaxLength = 254;

	$effect(() => {
		if (errorMessage && errorElement) {
			// Reveal errors inside the scrolling form, above the fixed footer.
			errorElement.focus();
		}
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting || !consent || privacySettingsStore.childPrivacyMode) {
			return;
		}
		submitting = true;
		errorMessage = '';
		try {
			const fields = {
				preferred_name: preferredName.trim(),
				email: email.trim(),
				consent,
				consent_version: INTERVIEW_CONSENT.version,
			};
			const payload = JSON.stringify(fields);
			if (payload !== previousPayload) {
				submissionId = crypto.randomUUID();
				previousPayload = payload;
			}
			await submitInterviewSignup({ signup_id: submissionId, ...fields });
			await oncomplete();
		} catch (error) {
			errorMessage = interviewErrorMessage(error);
		} finally {
			submitting = false;
		}
	}

	async function openLink(event: MouseEvent, url: string): Promise<void> {
		event.preventDefault();
		try {
			await openUrl(url);
		} catch {
			errorMessage = 'The link couldn’t be opened. Visit getsyng.com/privacy directly.';
		}
	}
</script>

<section class="interview-step" class:interview-step--mobile={variant === 'mobile'}>
	<header>
		<h2>{INTERVIEW_CONSENT.title}</h2>
		<p class="interview-step__intro">{INTERVIEW_CONSENT.invitation}</p>
	</header>
	<form id="interview-signup" onsubmit={submit} aria-busy={submitting}>
		<fieldset disabled={submitting}>
			<div class="interview-step__fields">
				<div class="interview-step__field">
					<label for="interview-name">Preferred name</label>
					<SyTextInput
						id="interview-name"
						size="large"
						name="preferred-name"
						autocomplete="given-name"
						required
						maxlength={preferredNameMaxLength}
						ariaDescribedby="interview-name-help"
						value={preferredName}
						oninput={(value) => (preferredName = value)}
					/>
					<p id="interview-name-help">A first name or nickname is fine.</p>
				</div>
				<div class="interview-step__field">
					<label for="interview-email">Email address</label>
					<SyTextInput
						id="interview-email"
						size="large"
						name="email"
						type="email"
						inputmode="email"
						autocomplete="email"
						autocapitalize="none"
						spellcheck="false"
						required
						maxlength={emailMaxLength}
						value={email}
						oninput={(value) => (email = value)}
					/>
				</div>
			</div>
			<label class="interview-step__consent">
				<input type="checkbox" required bind:checked={consent} />
				<span
					>{INTERVIEW_CONSENT.checkbox}
					<a href={privacyUrl} onclick={(event) => openLink(event, privacyUrl)}
						>Privacy Policy</a
					>.</span
				>
			</label>
		</fieldset>
		{#if errorMessage}<p
				class="interview-step__error"
				role="alert"
				tabindex="-1"
				bind:this={errorElement}
			>
				{errorMessage}
			</p>{/if}
		{#if submitting}<p role="status">Saving your signup…</p>{/if}
	</form>
</section>

<style>
	.interview-step,
	form,
	fieldset,
	header {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	header {
		gap: var(--sy-space--large);
	}
	h2 {
		margin: 0;
		font-size: var(--sy-font-size--heading);
		font-weight: var(--sy-font-weight--bold);
	}
	p {
		margin: 0;
		line-height: var(--sy-line-height--body);
	}
	.interview-step__intro {
		font-size: var(--sy-font-size--medium);
	}
	.interview-step__field {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space);
		min-width: 0;
	}
	.interview-step__field label {
		font-weight: var(--sy-font-weight--bold);
	}
	.interview-step__field p {
		color: var(--sy-text--dark);
		font-size: var(--sy-font-size--mobile-small);
	}
	.interview-step__fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sy-space--extra-large);
	}
	a {
		color: var(--sy-color--blue);
		text-decoration: underline;
	}
	.interview-step__consent {
		display: flex;
		align-items: flex-start;
		gap: var(--sy-space--large);
		line-height: var(--sy-line-height--body);
		cursor: pointer;
		font-size: var(--sy-font-size--mobile-small);
		min-height: 44px;
	}
	.interview-step__consent input {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		margin: 2px 0 0;
		accent-color: var(--sy-color--blue);
	}
	.interview-step__error {
		color: var(--sy-color--red);
	}
	.interview-step--mobile h2 {
		font-size: var(--sy-font-size--mobile-heading);
	}
	.interview-step--mobile .interview-step__intro {
		font-size: var(--sy-font-size--mobile-medium);
	}
	@container onboarding (max-width: 36rem) {
		.interview-step__fields {
			grid-template-columns: 1fr;
		}
	}
</style>
