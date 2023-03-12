<script>
  import SyButton from '../SyButton/SyButton.svelte';
  import { CopyIcon } from 'svelte-feather-icons';
  import { createEventDispatcher } from 'svelte';

  /* Required Value Prop */
  export let value;

  const dispatch = createEventDispatcher();

  const handleFlashcards = () => {
  	if (value) {
  		dispatch('selection', value);
  	}
  };

  const actions = [
  	{
  		icon: CopyIcon,
  		action: handleFlashcards,
  		tooltip: `Flashcards for ${value}`,
  	},
  ];
</script>

<div class="study-list-item">
  <span>
    {value}
  </span>
  <span>
    {#each actions as action}
      <SyButton
        center={true}
        on:click={action.action}
        size="large"
        classes={['sy-tooltip--container']}
      >
        <svelte:component this={action.icon} size="18" />
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
</style>
