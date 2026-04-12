<script>
	import { handleError, checkForUpdate, installPendingUpdate } from '../../utils/';
	import { marked } from 'marked';
	import SyButton from '../SyButton/SyButton.svelte';

	let currentVersion = $state(window.version || '');
	let updateVersion = $state(window.updateVersion || '');
	let releaseNotes = $state(window.updateReleaseNotes || '');
	let knownStatus = $state(window.updateStatusAvailable || false);
	let updateAvailable = $state(window.updateAvailable || false);
	let checking = $state(false);
	let updating = $state(false);

	if (!window.version) {
		window.__TAURI__.app
			.getVersion()
			.then((version) => {
				currentVersion = version;
				window.version = version;
				return undefined;
			})
			.catch((e) => {
				console.error('Error getting version:', e);
			});
	}

	const resetStatus = () => {
		checking = false;
		updating = false;
		updateAvailable = false;
		knownStatus = false;
		updateVersion = '';
		releaseNotes = '';
		window.updateAvailable = false;
		window.updateStatusAvailable = false;
		window.updateVersion = '';
		window.updateReleaseNotes = '';
		window.pendingUpdate = null;
	};

	const updateStatus = () => {
		checking = true;
		updating = false;
		checkForUpdate()
			.then((update) => {
				knownStatus = true;
				checking = false;
				if (update) {
					updateVersion = update.version;
					releaseNotes = update.body || '';
					updateAvailable = true;
				} else {
					updateAvailable = false;
				}
				return undefined;
			})
			.catch((e) => {
				resetStatus();
				handleError(
					'There was an error checking for updates. Please try again later. Check the log for more details.',
					e
				);
			});
	};

	const fetchUpdate = () => {
		updating = true;
		installPendingUpdate()
			.then(() => undefined)
			.catch((e) => {
				resetStatus();
				handleError(
					'There was an error fetching the update. Please try again later. Check the log for more details.',
					e
				);
			});
	};
</script>

<div class="update-checker">
	{#if !knownStatus}
		{#if checking}
			<!-- Disabled button indicating to user we're fetching the update status -->
			<SyButton disabled={true} size="large">Checking for updates...</SyButton>
		{:else}
			<!-- Default button, there is no known state and we are not actively checking -->
			<SyButton size="large" onclick={() => updateStatus()}>Check for updates</SyButton>
		{/if}
	{:else if updateAvailable}
		<!-- Button indicating there is an update available. Click it will initiaite the update. -->
		<div class="update-checker--status update-checker--update-available">
			<span class="updater-checker--status--title"> Update available </span>
			<span class="update-checker--status--subtitle">Version {updateVersion}</span>
			{#if releaseNotes}
				<div class="update-checker--release-notes sy-text--selectable">
					{@html marked(releaseNotes)}
				</div>
			{/if}
			<span class="update-checker--update-button">
				<SyButton
					color="green"
					size="large"
					onclick={() => fetchUpdate()}
					disabled={updating}
				>
					{#if !updating}
						Update
					{:else}
						Updating...
					{/if}
				</SyButton>
			</span>
		</div>
	{:else}
		<!-- Disabled button indicating to the user they are on the latest version -->
		<div class="update-checker--up-to-date update-checker--status">
			<span class="updater-checker--status--title"> You are up to date </span>
			<span class="update-checker--status--subtitle">
				Version {currentVersion}
			</span>
		</div>
	{/if}
</div>

<style>
	.update-checker {
		padding: var(--sy-space--large) 0px;
	}
	.update-checker--status {
		display: flex;
		flex-direction: column;
	}
	.updater-checker--status--title {
		margin-bottom: var(--sy-space);
		font-size: var(--sy-font-size--medium);
		font-weight: var(--sy-font-weight--regular);
	}
	.update-checker--status--subtitle {
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--light);
	}
	.update-checker--update-available {
		color: var(--sy-color--green);
	}
	.update-checker--release-notes {
		margin-top: var(--sy-space--large);
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--light);
	}
	.update-checker--release-notes :global(h1),
	.update-checker--release-notes :global(h2),
	.update-checker--release-notes :global(h3) {
		font-size: var(--sy-font-size--small);
		font-weight: var(--sy-font-weight--bold);
		margin: var(--sy-space--large) 0 var(--sy-space) 0;
	}
	.update-checker--release-notes :global(h1:first-child),
	.update-checker--release-notes :global(h2:first-child),
	.update-checker--release-notes :global(h3:first-child) {
		margin-top: 0;
	}
	.update-checker--release-notes :global(p) {
		margin: 0 0 var(--sy-space) 0;
	}
	.update-checker--release-notes :global(ul),
	.update-checker--release-notes :global(ol) {
		margin: 0 0 var(--sy-space) 0;
		padding-left: var(--sy-space--extra-large);
	}
	.update-checker--release-notes :global(li) {
		margin-bottom: var(--sy-space--small);
	}
	.update-checker--update-button {
		margin-top: var(--sy-space--extra-large);
	}
</style>
