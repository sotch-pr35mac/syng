<script>
import { handleError } from "../../utils/";
import SyButton from "../SyButton/SyButton.svelte";

let currentVersion = $state(window.version || "");
let updateVersion = $state(window.updateVersion || "");
let releaseNotes = $state(window.updateReleaseNotes || "");
let knownStatus = $state(window.updateStatusAvailable || false);
let updateAvailable = $state(window.updateAvailable || false);
let checking = $state(false);
let updating = $state(false);

if (!window.version) {
  window.__TAURI__.app.getVersion().then((version) => {
    currentVersion = version;
    window.version = version;
  });
}

const resetStatus = () => {
  checking = false;
  updating = false;
  updateAvailable = false;
  knownStatus = false;
  updateVersion = "";
  releaseNotes = "";
  window.updateAvailable = false;
  window.updateStatusAvailable = false;
  window.updateVersion = "";
  window.updateReleaseNotes = "";
};

const updateStatus = () => {
  checking = true;
  updating = false;
  window.__TAURI__.updater
    .checkUpdate()
    .then((updater) => {
      if (updater.shouldUpdate) {
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
    })
    .catch((e) => {
      resetStatus();
      handleError(
        "There was an error checking for updates. Please try again later. Check the log for more details.",
        e,
      );
    });
};
const fetchUpdate = () => {
  updating = true;
  window.__TAURI__.updater
    .installUpdate()
    .then(() => {
      window.__TAURI__.process.relaunch();
    })
    .catch((e) => {
      resetStatus();
      handleError(
        "There was an error fetching the update. Please try again later. Check the log for more details.",
        e,
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
      <SyButton size="large" onclick={() => updateStatus()}>
        Check for updates
      </SyButton>
    {/if}
  {:else if updateAvailable}
    <!-- Button indicating there is an update available. Click it will initiaite the update. -->
    <div class="update-checker--status update-checker--update-available">
      <span class="updater-checker--status--title"> Update available </span>
      <span class="update-checker--status--subtitle">
        Version {updateVersion}<br />
        Release Notes: {releaseNotes}
      </span>
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
.update-checker--update-button {
  margin-top: var(--sy-space--extra-large);
}
</style>
