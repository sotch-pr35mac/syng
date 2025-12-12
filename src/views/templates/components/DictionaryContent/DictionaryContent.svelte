<script>
import { run } from "svelte/legacy";

import { CheckIcon, Maximize2Icon, PlusIcon } from "svelte-feather-icons";
import { handleError } from "../../utils/";
import SyButton from "../SyButton/SyButton.svelte";
import SyButtonBar from "../SyButtonBar/SyButtonBar.svelte";
import SimpleTextDropdownItem from "../SyDropdown/SimpleTextDropdownItem.svelte";
import SyDropdown from "../SyDropdown/SyDropdown.svelte";
import TextWithIconDropdownItem from "../SyDropdown/TextWithIconDropdownItem.svelte";
import SyList from "../SyList/SyList.svelte";
import DefinitionItem from "./DefinitionItem.svelte";
import EntryTopline from "./EntryTopline.svelte";
import MeasureWord from "./MeasureWord.svelte";
import { invoke } from "@tauri-apps/api/core";

/* Background Color Prop */
/* Possible Values */
// 'grey' - Grey Background

/**
 * @typedef {Object} Props
 * @property {any} word - Word Prop
 * @property {any} [lists] - Lists Prop
 * @property {string} [backgroundColor] - 'white' - White Background
 * @property {(detail: any) => void} [onlink] - Callback when link is clicked
 */

/** @type {Props} */
let { word, lists = [], backgroundColor = "grey", onlink } = $props();

let memberLists = $state([]);

const updateListMembership = () => {
  window.bookmarkManager
    .inList(word.hash)
    .then((lists) => {
      memberLists = lists;

      // After updating list membership update the 'add to bookmarks' action item icon
      // and tooltip to best reflect the new state.
      // Note: Here, the 'add to bookmarks' action item is assumed to be the first action
      actions[0].component = getBookmarkIcon();
      actions[0].tooltip = getBookmarkTooltip();
    })
    .catch((e) => {
      handleError(
        "There was an error fetching list membership. Check the log for more details.",
        e,
      );
    });
};
const _modifyListMembership = (fnName, list, word) => {
  window.bookmarkManager[fnName](list, word)
    .then(() => {
      updateListMembership();
    })
    .catch((e) => {
      handleError(
        "There was an error modifying the list membership. Check the log for more details.",
        {
          e,
          word,
          list,
        },
      );
    });
};
const removeListMembership = (list, word) => {
  _modifyListMembership("removeFromList", list, word);
};
const addListMembership = (list, word) => {
  _modifyListMembership("addToList", list, word);
};

run(() => {
  word
    ? (() => {
        updateListMembership();
      })()
    : null;
});

const getBookmarkIcon = () => (memberLists.length ? CheckIcon : PlusIcon);
const getBookmarkTooltip = () =>
  `${memberLists.length ? "Remove from" : "Add to"} ${lists.length > 1 ? "List" : "Bookmarks"}`;
let actions = $derived([
  {
    component: getBookmarkIcon(),
    tooltip: getBookmarkTooltip(),
    action: () => {
      if (lists.length === 1) {
        const bookmarks = lists[0];
        if (memberLists.includes(bookmarks)) {
          removeListMembership(bookmarks, word);
        } else {
          addListMembership(bookmarks, word);
        }
      }
    },
    dropdown:
      lists.length === 1
        ? undefined
        : lists.map((item) => {
            let inList = memberLists.includes(item);
            return {
              text: item,
              id: item,
              component: inList
                ? TextWithIconDropdownItem
                : SimpleTextDropdownItem,
              icon: inList ? CheckIcon : undefined,
              hover: inList ? "red" : undefined,
            };
          }),
    classes: ["sy-button--grouped--first"],
  },
  {
    component: Maximize2Icon,
    tooltip: "Enlarge Characters",
    action: () => {
      invoke("open_character_window", {
        word: {
          traditional: word.traditional,
          simplified: word.simplified,
        },
      }).catch((e) => {
        handleError(
          "An unknown error occurred while trying to open the enlarged character window. Please check the log for more details.",
          e,
        );
      });
    },
  },
  /*
	{
		component: MoreHorizontalIcon,
		tooltip: '',
		action: () => {
			alert('Feature Not Implemented');
		}
	}
	*/
]);
const handleOpenLink = (detail) => onlink?.(detail);

let saveNotesDebounce;
const saveNotes = () => {
  const cachedWord = word;
  clearTimeout(saveNotesDebounce);
  saveNotesDebounce = setTimeout(() => {
    const notes = document
      .getElementById("dictionary-content--notes")
      .value.trim();
    window.bookmarkManager
      .updateProperty(cachedWord.hash, "notes", notes)
      .then(() => {
        cachedWord.notes = notes;
      })
      .catch((e) => {
        handleError(
          "An unknown error occurred while trying to save the notes. Please check the log for more details.",
          e,
        );
      });
  }, 500);
};

const handleMembershipModification = (e) => {
  const listName = e.detail;
  if (memberLists.includes(listName)) {
    // The word is present in the selected list. The user must be
    // requesting to remove the word from this list.
    removeListMembership(listName, word);
  } else {
    // The word is not present in the selected list. The user must be
    // requesting to add the word to that list.
    addListMembership(listName, word);
  }
};

const getContainerClasses = () => {
  return [
    "dictionary-content-container",
    `dictionary-content--background-${backgroundColor}`,
  ].join(" ");
};
</script>

<div class={getContainerClasses()}>
  {#if word}
    <section class="dictionary-content dictionary-content--header">
      <EntryTopline {word} />
      <SyButtonBar>
        {#each actions as action}
          {#if action.dropdown}
            <SyDropdown
              values={action.dropdown}
              on:selection={handleMembershipModification}
              position="right"
            >
              <SyButton
                grouped="true"
                classes={["sy-tooltip--container", ...action.classes]}
                on:click={action.action}
              >
                <action.component size="18" />
                {#if action.tooltip}
                  <div class="sy-tooltip--body sy-tooltip--body-bottom">
                    <p>
                      {action.tooltip}
                    </p>
                  </div>
                {/if}
              </SyButton>
            </SyDropdown>
          {:else}
            <SyButton
              grouped="true"
              classes={["sy-tooltip--container"]}
              on:click={action.action}
            >
              <action.component size="18" />
              {#if action.tooltip}
                <div class="sy-tooltip--body sy-tooltip--body-bottom">
                  <p>
                    {action.tooltip}
                  </p>
                </div>
              {/if}
            </SyButton>
          {/if}
        {/each}
      </SyButtonBar>
    </section>
    <section class="dictionary-content">
      <h2 class="dictionary-content--section-title">Definitions</h2>
      <SyList
        values={word.english}
        component={DefinitionItem}
        onevent={handleOpenLink}
      />
    </section>
    {#if word.measure_words.length}
      <section class="dictionary-content">
        <h2 class="dictionary-content--section-title">Measure Words</h2>
        <SyList
          values={word.measure_words}
          component={MeasureWord}
          onevent={handleOpenLink}
        />
      </section>
    {/if}
    {#if typeof word.notes === "string"}
      <section class="dictionary-content">
        <h2 class="dictionary-content--section-title">Notes</h2>
        <textarea
          placeholder="No Notes"
          class="dictionary-content--notes"
          id="dictionary-content--notes"
          oninput={saveNotes}>{word.notes}</textarea
        >
      </section>
    {/if}
  {/if}
</div>

<style>
.dictionary-content-container {
  width: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
}
.dictionary-content--background-grey {
  background-color: var(--sy-color--grey-2);
}
.dictionary-content--background-white {
  background-color: var(--sy-color--white);
}
.dictionary-content {
  padding: var(--sy-space--extra-large);
}
.dictionary-content--header {
  display: flex;
  justify-content: space-between;
}
.dictionary-content--section-title {
  font-size: 1.8em;
  font-weight: 400;
  margin: var(--sy-space--small) var(--sy-space--large);
  color: var(--sy-color--grey-4);
}
.dictionary-content--notes {
  background-color: var(--sy-color--white);
  border-radius: var(--sy-border-radius);
  border: var(--sy-border);
  padding: var(--sy-space--extra-large);
  margin: var(--sy-space--extra-large);
  font-size: var(--sy-font--size);
  color: var(--sy-color--black);
  height: auto;
  /* Full width subtracting the margin on it and its parent to achieve a cross-compatible `-webkit-fill-available` effect */
  width: calc(
    95% - calc(var(--sy-space--extra-large) + var(--sy-space--extra-large))
  );
}
</style>
