<script>
  import SyButton from '../SyButton/SyButton.svelte';
  import { CopyIcon, AwardIcon } from 'svelte-feather-icons';
  import { createEventDispatcher } from 'svelte';

  
  /**
   * @typedef {Object} Props
   * @property {any} value - Required Value Prop
   */

  /** @type {Props} */
  let { value } = $props();

  const dispatch = createEventDispatcher();

  const handleSelection = actionType => {
  	if (value) {
  		dispatch('selection', {
  			action: actionType,
  			list: value
  		});
  	}
  };

  const actions = [
  	{
  		icon: CopyIcon,
  		action: () => handleSelection('flashcards'),
  		tooltip: `Flashcards for ${value}`,
  	},
  	{
  		icon: AwardIcon,
  		action: () => handleSelection('quiz'),
  		tooltip: `Start quiz for ${value}`,
  	}
  ];
</script>

<div class="study-list-item">
  <span>
    {value}
  </span>
  <span class="study-list-item--actions">
    {#each actions as action}
      <SyButton
        center={true}
        on:click={action.action}
        size="large"
        classes={['sy-tooltip--container']}
      >
        <action.icon size="18" />
        <div class="sy-tooltip--body sy-tooltip--body-bottom">
          <p>
            {action.tooltip}
          </p>
        </div>
      </SyButton>
    {/each}
  </span>
</div>

<style>
  .study-list-item {
    padding: var(--sy-space--large);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .study-list-item--actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-around;
  }
</style>
