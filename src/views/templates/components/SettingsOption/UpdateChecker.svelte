<script>
import SyButton from '../SyButton/SyButton.svelte';
import { handleError } from '../../utils/';

let currentVersion = window.version || '';
let updateVersion = window.updateVersion || '';
let releaseNotes = window.updateReleaseNotes || '';
let knownStatus = window.updateStatusAvailable || false;
let updateAvailable = window.updateAvailable || false;
let checking = false;
let updating = false;

if(!window.version) {
	window.__TAURI__.app.getVersion().then(version => {
		currentVersion = version;
		window.version = version;
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
};

const updateStatus = () => { 
	checking = true;
	updating = false;
	window.__TAURI__.updater.checkUpdate().then(updater => {
		if(updater.shouldUpdate) {
			// Update the page
			updateVersion = updater.manifest.version;
			releaseNotes = updater.manifest.body;
			knownStatus = true;
			updateAvailable = true;
			checking = false;

			// Cache the results
			window.updateVersion = updater.manifest.version;
			window.updateReleaseNotes = updater.manifest.body;
			window.updateStatusAvailable = true;
			window.updateAvailable = true;
		} else {
			// Update the page
			knownStatus = true;
			checking = false;
			updateAvailable = false;

			// Cache the results
			window.updateAvailable = false;
			window.updateStatusAvailable = true;
		}
	}).catch(e => {
		resetStatus();
		handleError('There was an error checking for updates. Please try again later. Check the log for more details.', e);
	});
};
const fetchUpdate = () => {
	updating = true;
	window.__TAURI__.updater.installUpdate().then(() => {
		window.__TAURI__.process.relaunch();
	}).catch(e => {
		resetStatus();
		handleError('There was an error fetching the update. Please try again later. Check the log for more details.', e);
	});
};
</script>

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
.update-checker--update-button {
    margin-top: var(--sy-space--extra-large);
}
</style>

<div class="update-checker">
{#if !knownStatus}
    {#if checking}
        <!-- Disabled button indicating to user we're fetching the update status -->
        <SyButton disabled={true} size="large">
            Checking for updates...
        </SyButton>
    {:else}
        <!-- Default button, there is no known state and we are not actively checking -->
        <SyButton size="large" on:click={ () => updateStatus() }>
            Check for updates
        </SyButton>
    {/if}
{:else}
    {#if updateAvailable}
        <!-- Button indicating there is an update available. Click it will initiaite the update. -->
       <div class="update-checker--status update-checker--update-available">
            <span class="updater-checker--status--title">
                Update available
            </span>
            <span class="update-checker--status--subtitle">
                Version { updateVersion }<br/>
                Release Notes: { releaseNotes }
            </span>
            <span class="update-checker--update-button" >
                <SyButton color="green" size="large" on:click={() => fetchUpdate() } disabled={ updating }>
                    {#if !updating }
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
            <span class="updater-checker--status--title">
                You are up to date
            </span>
            <span class="update-checker--status--subtitle">
                Version { currentVersion }
            </span>
        </div>
    {/if}
{/if}
</div>
