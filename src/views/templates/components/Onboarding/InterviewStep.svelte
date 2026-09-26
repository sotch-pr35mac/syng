<script lang="ts">
	import { openUrl } from '@tauri-apps/plugin-opener';
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
	const contactUrl = 'mailto:hello@bytecraft.xyz?subject=Syng%20interview%20signup';

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
			errorMessage =
				'The link couldn’t be opened. Visit getsyng.com/privacy or email hello@bytecraft.xyz directly.';
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
			<div class="interview-step__field">
				<label for="interview-name">What would you like us to call you?</label>
				<p id="interview-name-help">A first name or nickname is fine.</p>
				<input
					id="interview-name"
					name="preferred-name"
					autocomplete="given-name"
					required
					maxlength="80"
					aria-describedby="interview-name-help"
					bind:value={preferredName}
				/>
			</div>
			<div class="interview-step__field">
				<label for="interview-email">Email address</label>
				<input
					id="interview-email"
					name="email"
					type="email"
					inputmode="email"
					autocomplete="email"
					autocapitalize="none"
					spellcheck="false"
					required
					maxlength="254"
					bind:value={email}
				/>
			</div>
			<div class="interview-step__disclosure" id="interview-disclosure">
				<p>{INTERVIEW_CONSENT.linkage}</p>
				<p>{INTERVIEW_CONSENT.retention}</p>
				<p class="interview-step__links">
					<a href={privacyUrl} onclick={(event) => openLink(event, privacyUrl)}
						>Privacy policy</a
					>
					<a href={contactUrl} onclick={(event) => openLink(event, contactUrl)}
						>Contact us about your signup</a
					>
				</p>
			</div>
			<label class="interview-step__consent">
				<input
					type="checkbox"
					required
					bind:checked={consent}
					aria-describedby="interview-disclosure"
				/>
				<span>{INTERVIEW_CONSENT.checkbox}</span>
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
		gap: var(--sy-space--large);
	}
	.interview-step__field label {
		font-weight: var(--sy-font-weight--bold);
	}
	.interview-step__field p,
	.interview-step__disclosure {
		color: var(--sy-text--dark);
		font-size: var(--sy-font-size--small);
	}
	.interview-step__field input {
		width: 100%;
		min-height: 44px;
		box-sizing: border-box;
		border: 1px solid var(--sy-color--grey-3);
		border-radius: var(--sy-border-radius);
		background: var(--sy-color--white);
		color: var(--sy-text--dark);
		padding: var(--sy-space--large);
		font: inherit;
		font-size: 16px;
		user-select: text;
	}
	.interview-step__disclosure {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--large);
	}
	.interview-step__links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sy-space--large);
	}
	a {
		color: var(--sy-interview-accent);
		text-decoration: underline;
	}
	.interview-step__consent {
		display: flex;
		align-items: flex-start;
		gap: var(--sy-space--large);
		line-height: var(--sy-line-height--body);
		cursor: pointer;
	}
	.interview-step__consent input {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		margin: 2px 0 0;
		accent-color: var(--sy-interview-accent);
	}
	input:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--sy-interview-accent);
		outline-offset: 3px;
	}
	.interview-step__error {
		color: var(--sy-interview-error);
	}
	.interview-step--mobile h2 {
		font-size: var(--sy-font-size--mobile-heading);
	}
	.interview-step--mobile .interview-step__intro {
		font-size: var(--sy-font-size--mobile-medium);
	}
	.interview-step--mobile .interview-step__disclosure,
	.interview-step--mobile .interview-step__field p {
		font-size: var(--sy-font-size--mobile-small);
	}
</style>
