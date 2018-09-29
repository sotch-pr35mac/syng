<template>
	<div class="help-section">
  		<h1 id="syng-help-guide">Syng Help Guide</h1>
<h5 id="for-desktop-version-1.2.0">For Desktop Version 1.4.0</h5>
<h5 id="document-version-0.1.0">Document Version 0.3.0</h5>
<p>This guide outlines Syng's features and how to use them.</p>
<hr />
<h5><a href="#tutorial">Tutorial</a></h5>
<ul>
<li><a href="#navigation">Navigation</a></li>
<li><a href="#syng-menu">Syng Menu</a></li>
<li><a href="#search">Search</a></li>
<li><a href="#yuedu">Reader</a></li>
<li><a href="#bookmarks">Bookmarks</a></li>
<li><a href="#study">Study</a></li>
<li><a href="#tools">Tools</a></li>
<li><a href="#large-characters-and-stroke-order-animations">Large Characters and Stroke Order Animations</a></li>
<li><a href="#manage-lists">Manage Lists</a></li>
</ul>
<h5><a href="#">How do I ..?</a></h5>
<ul>
<li><a href="#manage-lists">Create a custom list</a></li>
<li><a href="#word-action-buttons-and-information-tags-(search)">Add a word to a custom list</a></li>
<li><a href="#action-bar-bookmarks">Import a list</a></li>
<li><a href="#large-characters-and-stroke-order-animations">View character animations</a></li>
<li><a href="#study">Practice flashcards</a></li>
<li><a href="#study">Take a quiz</a></li>
<li><a href="#notes">Take notes on a specific word</a></li>
<li><a href="#character-converter">Convert between Simplified and Traditional characters</a></li>
<li><a href="#pinyinify">Get the Pinyin for a group of Chinese characters</a></li>
<li><a href="#prettify-pinyin">Turn Pinyin with tone numbers into Pinyin with tone marks</a></li>
<li><a href="#yuedu">Read a block of Chinese text</a></li>
</ul>
<h5><a href="#known-issues">Known Issues</a></h5>
<hr />
<h2 id="tutorial">Tutorial</h2>
<h3 id="navigation">Navigation</h3>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/navigation.png" alt="Navigation Panel" /><p class="caption">Navigation Panel</p>
</div>
<p>The main navigation of the app is on the left hand side. This tabbed navigation bar lets you switch between different “modes” of the app.</p>
<p>The first navigation item in the list is the Syng Menu (词应). The Syng Menu contains information about Syng, and lets you access the Help Menu, view license information, report a bug, or donate to Syng.</p>
<p>The second navigation item is Search. From the search screen you can query the dictionary in English, Chinese (both Traditional and Simplified), and Pinyin (both with and without tone marks). You can add words to bookmarks or other vocab lists, open the vocab list manager, or view stroke order animations from the search screen. For more information on the Search screen, you can go here to read more detailed documentation.</p>
<p>The third navigation item is Reader. From the reader screen you can paste text from your clipboard or enter in a websie URL to read the Chinse text and get a popup dictionary when you click on a word.</p>
<p>The fourth navigation item is Bookmarks. From the Bookmarks screen, you can view your saved bookmarks, import or export bookmarks for backup. You can also view and manage your vocab lists, or import and export your lists for backup. You can save notes on the words you have added to your bookmarks or vocab lists here as well. For more information on the Bookmarks screen, you can go here to read more detailed documentation.</p>
<p>The fifth view is the Study screen. From the Study screen you have two options, first to study flashcards from your bookmarks or lists, or to take a Quiz generated from your any one of your lists or bookmarks.</p>
<p>The sixth item in the navigation is the Tools screen. The Tools screen gives you access to a series of small, but helpful quick tools that you may need if you are studying Chinese. The first tool you can access is the Prettify Pinyin tool, this tool takes pinyin with tone numbers (ie ni3 hao3) and turns it into pinyin with tone marks (ie nǐ hǎo). The second tool on the tools screen is the Pinyinify tool. This tool lets you enter Chinese characters (in either Traditional or Simplified) and turns it into Pinyin with tone marks for you. The third tool is the Character Convert Tool, which lets you convert between Traditional and Simplified Chinese scripts. For more detailed information on the Tools screen, you can go here to read more information.</p>
<h3 id="syng-menu">Syng Menu</h3>
<p>The Syng Menu (词应) lets you access several house-keeping parts of the app. - About - Read about Syng and view acknowledgements - Settings - <em>coming soon!</em> - Licenses - View the license information for Syng and other technologies used in Syng - Report a bug - Report a bug you have found to the maintainer of the app. <strong>This requires a network connection.</strong> - Help - Read a help guide that will help you navigate around and use Syng like a pro. - Donate - Donate to the developers through Ko-Fi. <strong>This feautre requires a network connection</strong>.</p>
<h3 id="search">Search</h3>
<p>The search section lets you query the Chinese dictionary using English, Traditional Chinese characters, Simplified Chinese characters, and Pinyin - both with and without tone numbers. The search section has several parts:</p>
<ul>
<li><a href="#search-bar">Search bar</a></li>
<li><a href="#search-results">Search results</a></li>
<li><a href="#word-detail-(search)">Word detail (search)</a></li>
<li><a href="#chinese-representations">Chinese representations</a></li>
<li><a href="#word-action-buttons-and-information-tags-(search)">Word action buttons and information tags (search)</a></li>
<li><a href="#definitions">Definitions</a></li>
<li><a href="#component-characters">Component characters</a></li>
</ul>
<h4 id="search-bar">Search bar</h4>
<p>The search bar contains three main components. The first is the “Intended Latin Input” button. This button will display “PY” when searching in Pinyin (either with or without tone numbers), or “EN” when searching in English. You can click on this button to change your search from searching in English to searching in Pinyin, or vice versa. Syng will automatically guess that you are searching in Pinyin if your search term contains “zh” or a number next to a letter. If the guess is wrong, and you would like to override the guess, you can click the “PY” and it will search in English instead.</p>
<p>The second component of the search bar is the input field. You can type in English, Traditional Chinese characters, Simplified Chinese characters, or Pinyin (both with and without tone marks). Syng will automatically determine if you are searching in Chinese characters or searching in English / Pinyin. There is no need to specify. You can enter up to 4000 characters in a single search. Searches need an exact match to display results. Misspelling a word could yield no results.</p>
<p>When searching in English, the search terms to find a single Chinese word can be four English words long, for example “to put into practice” will yield results for Chinese words where the definition is “to put into practice”, but “to put something into practice” will search for the Chinese words with the definition “to put something into” and “practice”.</p>
<p>When searching in Pinyin, you can search either with or without tone numbers, but cannot search with tone marks. To search a single, multiple syllable word in pinyin, don’t enter spaces between syllables. For example, to search for “中国” (zhong1guo2), type “zhong1guo2” instead of “zhong1 guo2” (with no space). This will search for all multi-syllable words with match “zhong1guo2”, where searching “zhong1 guo2” will perform two searches, one for words with the pinyin “zhong1” and one for words with the pinyin “guo2”. The same applies to searching pinyin without tone numbers (ie search “zhongguo” instead of “zhong guo”).</p>
<p>The third and final section of the search bar is the search button. Clicking the search button will perform a search for whatever is in the search input field. You can also click the “Enter” key on your keyboard to initiate a search.</p>
<h4 id="search-results">Search results</h4>
<p>The search results are a list of entries in the dictionary that match your search terms.</p>
<h4 id="word-detail-search">Word detail (search)</h4>
<p>The word detail page consists of four parts:</p>
<ul>
  <li><a href="#chinese-representations">Chinese representations</a></li>
  <li><a href="#word-action-buttons-and-information-tags-search">Word action buttons and information tags (search)</a> </li>
  <li><a href="#definitions">Definitions</a></li>
  <li><a href="#component-characters">Component characters</a></li>
</ul>
<h5 id="chinese-representations">Chinese representations</h5>
<p>The are three ways the word is represented in Chinese. The first are the Simplified Chinese characters. The second, found in parenthesis directly to the right of the Simplified Chinese characters, are the Traditional Chinese characters. If the Traditional characters are the same as the Simplified characters, nothing will appear in parenthesis. Both these representations are color coded. These colors correspond to the tone of the character. Black represents “no-tone”, blue represents first tone, yellow represents second tone, red represents third tone, and green represents fourth tone. Finally under the two character representation, there is the Pinyin with tone marks for the character.</p>
<h5 id="word-action-buttons-and-information-tags-search">Word action buttons and information tags (search)</h5>
<p>The word detail page has an action buttons section. These buttons allow you to perform certain actions with the current word.</p>
<p>This dropdown allows you to add the current word to a vocab list, or to open to list manager to create or delete lists.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/add-to-list-search.png" alt="Add to Custom List Dropdown" /><p class="caption">Add to Custom List Dropdown</p>
</div>
<p>This button will add the current word to your Bookmarks, where you can come back to it later in the Bookmarks section.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/add-to-bookmarks.png" alt="Add to Bookmarks Button" /><p class="caption">Add to Bookmarks Button</p>
</div>
<p>This button will open a separate window where you can view a larger representation of the character, in both Simplified and Traditional characters. From this window you can play the stroke order animation by pressing the Play button.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/open-large-chars.png" alt="View Large Characters Button" /><p class="caption">View Large Characters Button</p>
</div>
<p>This is the “listen” button. Pressing it will play the audio of the character, this can be helpful with practicing tones. This features requires a network connection, and the button will not appear if you did not have a network connection when opening Syng.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/tts.png" alt="Listen to Spoken Word Button" /><p class="caption">Listen to Spoken Word Button</p>
</div>
<p>Under the action buttons, sometimes there will appear a tag with relevant information about the current word. For example, in the picture below, this tag appear on words that have an HSK level. This tag states that the current word is HSK Level 5.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/hsk-label.png" alt="HSK Label" /><p class="caption">HSK Label</p>
</div>
<h5 id="definitions">Definitions</h5>
<p>This is where you can read the English definitions for the current Chinese word. If a definition contains “CL:”, this means there are the possible Measure Words for the character.</p>
<h5 id="component-characters">Component Characters</h5>
<p>This section allows you to breakdown and inspect what characters make-up the current word.</p>
<h3 id="yuedu">Reader</h3>
<p>The reader section allows you to read a block of text, either pasted in from your clipboard or from a URL, both with a popup dictioary. You can read text from your clipboard by pasting in text you have already copied into the input field on the "Clipboard" section of the reader screen. Then after clicking "Read from Clipboard" you will be taken to the reading mode. You can read more about reading mode <a href="#reading-mode">here</a>. To read text from a website, you can click on the "Web" tab and paste a URL into the input field, then click "Read from Web", and you will be taken to the reading mode with the text content of the website displayed. You can read more about the reading mode <a href="#reading-mode">here</a>. Note, reading text from a webpage requires a network connection. Also note, large bodies of text may take a while to load since word boundaries have to be determined. Please be patient.</p>
<h4 id="reading-mode">Reading Mode</h4>
<p>In reading mode you can click on any Chinese word, and the definition for this word will popup in the dictionary listing below. The clicked on word will be highlighted to let you know where the word starts and ends. From the dictionary listing at the bottom, you can inspect a word's definitions and pinyin, as well as add it to your bookmarks or a custom list, view larger version of the characters and see stroke order animations, or have the word spoken out-loud to you. To exit reading mode, click on "Exit Reader" in the action bar at the top.</p>
<h3 id="bookmarks">Bookmarks</h3>
<p>The bookmarks section lets you refer back to characters that you have saved. You can also change to view a custom list by click the dropdown and selecting the list you would like to view, or you can also open the List Manager from this menu and create or delete lists. The Bookmarks section contains several parts:</p>
<ul>
  <li><a href="#action-bar-bookmarks">Action bar (bookmarks)</a></li>
  <li><a href="#list-contents">List contents</a></li>
  <li><a href="#word-detail-bookmarks">Word detail (bookmarks)</a></li>
  <li><a href="#chinese-representations">Chinese representations</a></li>
  <li><a href="#word-action-buttons-and-information-tags-bookmarks">Word action buttons and information tags (bookmarks)</a></li>
  <li><a href="#definitions">Definitions</a></li>
  <li><a href="#component-characters">Component characters</a></li>
  <li><a href="#notes">Notes</a></li>
</ul>
<h4 id="action-bar-bookmarks">Action bar (bookmarks)</h4>
<p>The Bookmarks section action bar has several buttons. The first is a dropdown that lets you switch lists, or open the list manager to create new or custom lists. The next two buttons are Import and Export. Clicking the import button will allow you to import words into the current list you are viewing, and the export button will allow you to export the current list to be shared or saved. If the list you are currently viewing is Bookmarks, there will be a Clear Bookmarks button, that allows you to erase all the words in the Bookmarks list.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/bookmarks-action-bar.png" alt="Bookmarks Action Bar" /><p class="caption">Bookmarks Action Bar</p>
</div>
<h4 id="list-contents">List contents</h4>
<p>The next part of the Bookmarks section is the list contents. This is the list of all the words that are in the current list you are viewing. You can quickly search through this list for matching English, Pinyin, Simplified or Traditional characters by typing into the “Filter List” search field that appears at the top of the List Content.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/list-content.png" alt="Bookmarks Section List Content" /><p class="caption">Bookmarks Section List Content</p>
</div>
<h4 id="word-detail-bookmarks">Word detail (bookmarks)</h4>
<h5 id="chinese-representations-bookmarks">Chinese representations (bookmarks)</h5>
<p><a href="#chinese-representations">Click here to read about Chinese representations</a></p>
<h5 id="word-action-buttons-and-information-tags-bookmarks">Word action buttons and information tags (bookmarks)</h5>
<p>This button will remove the current word from the current list.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/remove-from-bookmarks.png" alt="Remove from Bookmarks Button" /><p class="caption">Remove from Bookmarks Button</p>
</div>
<p>This button will open a separate window where you can view a larger representation of the character, in both Simplified and Traditional characters. From this window you can play the stroke order animation by pressing the Play button.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/open-large-chars.png" alt="Open Large Characters Window" /><p class="caption">Open Large Characters Window</p>
</div>
<p>This is the “listen” button. Pressing it will play the audio of the character, this can be helpful with practicing tones. This features requires a network connection, and the button will not appear if you did not have a network connection when opening Syng.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/tts.png" alt="Listen to Spoken Word Button" /><p class="caption">Listen to Spoken Word Button</p>
</div>
<p>Under the action buttons, sometimes there will appear a tag with relevant information about the current word. For example, in the picture below, this tag appear on words that have an HSK level. This tag states that the current word is HSK Level 5.</p>
<div class="figure">
<img src="https://github.com/sotch-pr35mac/syng/raw/master/assets/help-menu/hsk-label.png" alt="HSK Label" /><p class="caption">HSK Label</p>
</div>
<h5 id="definitions-bookmarks">Definitions (bookmarks)</h5>
<p><a href="#definitions">Click here to read more about definitions.</a></p>
<h5 id="component-characters-bookmarks">Component Characters (bookmarks)</h5>
<p><a href="#component-characters">Click here to read more about component characters.</a></p>
<h5 id="notes">Notes</h5>
<p>In the Bookmarks section, you can write, save, and review notes for individual characters. To create a note on a character, open that character in the Bookmarks section, click on the notes dropdown below the definitions and click “Add Notes”. To update or delete a note follow the same steps and click “Edit”, if you which to delete a note, remove all the text from the text field and click “Save”.</p>
<h3 id="study">Study</h3>
<p>This section allows you to study flashcards of words in your lists or take a quiz based off the words in any one of your lists.</p>
<h4 id="flashcards">Flashcards</h4>
<p>To study flashcards, select a list from the dropdown menu, and then click “Study”. There are two main section of the Flashcards section: The action bar, and the card content.</p>
<p>The action bar gives you buttons with the option to move to the previous card, the next card, or to flip the card.</p>
<h4 id="quiz">Quiz</h4>
<p>To study a quiz, you should select a list from the dropdown menu, and then click “Generate Test”. The quiz has several sections, the first is the action bar and progress bars.</p>
<p>When answering a question, the action bar has two buttons, one to skip the current question. Skipping a question will mark it as incorrect and move on. Another button is there to pause the quiz. You are only allowed 30 seconds to answer a single question. Clicking the pause button will pause the timer. When you resume, the timer will reset to 30 seconds.</p>
<p>When you answer a question, whether correct, incorrect, or you ran out of time, a notification will appear in the upper right hand corner of Syng letting you know if you got the question correct or incorrect, and then display the answer.</p>
<h3 id="tools">Tools</h3>
<p>The Syng Tools section has three tools:</p>
<ul>
  <a href="#prettify-pinyin">Prettify Pinyin</a>
  <a href="#pinyinify">Pinyinify</a>
  <a href="#character-converter">Character converter</a>
</ul>
<h4 id="prettify-pinyin">Prettify Pinyin</h4>
<p>This feature allows you to take Pinyin with tone numbers and convert it to Pinyin with tone marks. To do this you would first paste or type in your text with tone numbers. Then click &quot;Prettify&quot; and your pretty Pinyin should appear below.</p>
<p>The input format requires a space in-between every syllable to work properly. That means that &quot;ni3 hao3&quot; will work as expected, but &quot;ni3hao3&quot; will produce &quot;nǐ3hao&quot;.</p>
<h4 id="pinyinify">Pinyinify</h4>
<p>This feature allows you to paste or type in Chinese characters (both Traditional and Simplified) and get back the Pinyin with tone marks. After pasting in text, just click &quot;Pinyinify&quot; and your Pinyin text should appear in the section below.</p>
<h4 id="character-converter">Character converter</h4>
<p>This feature lets you convert Traditional characters to Simplified, and Simplified characters to Traditional. To do this, first type or paste your text in the upper section, then choose conversion direction from the dropdown menu in the action bar (ie Tradtional --&gt; Simplified / Simplified --&gt; Traditional). Then click &quot;Convert&quot;, your converted text should appear in the section below.</p>
<h3 id="large-characters-and-stroke-order-animations">Large characters and stroke order animations</h3>
<p>To view a larger version of a character or to watch the stroke order animation, navigate to your word of choice either through the search section or the bookmarks section. Then click on the &quot;View Large Characters&quot; button (picture below). This should bring up a new window with a larger version of the character. You can switch between Traditional and Simplified scripts at the top. To watch the stroke order animation, click the play button in the upper right hand corner. <strong>Not all characters have stroke order animation support.</strong></p>
<h3 id="manage-lists">Manage lists</h3>
<p>There are two ways to open the manage lists window: 1. Through the Bookmarks section. Click on the dropdown to chose a list and then click &quot;Create New List&quot;. 2. Through the Search section. Open a word from the dictionary and click the list dropdown, then click &quot;Create New List&quot;.</p>
<p>Through this window you can create new lists, and delete lists. When you delete a list, there is no way to recover the list, so make sure that you are deleting the correct list. The same list name cannot be used more than once.</p>
<hr />
<h2 id="known-issues">Known Issues</h2>
<ul>
<li>Alert dialogs display squares instead of text on Fedora Linux.</li>
<li>Sometimes reading from webpages in Reader include some of the document's HTML code.</li>
</ul>

  	</div>
</template>

<style>
.help-section {
  overflow-y: scroll;
  height: 100%;
  width: 100%;
  padding: 20px;
}
.help-section img {
  max-width: 100%;
}
.help-section .inner-list: {
  margin-left: 100px;
}
.help-section h1 {
  padding-top: 10px;
  padding-bottom: 5px;
  text-decoration: underline;
  font-size: 6vh;
}
.help-section h2 {
  padding-top: 10px;
  padding-bottom: 5px;
  text-decoration: underline;
  font-size: 5.3vh;
}
.help-section h3 {
  padding-top: 10px;
  padding-bottom: 5px;
  font-size: 4.6vh;
}
.help-section h4 {
  padding-top: 10px;
  padding-bottom: 5px;
  font-size: 3.9vh;
}
.help-section h5 {
  padding-top: 10px;
  padding-bottom: 5px;
  font-size: 3.2vh;
}
.help-section h6 {
  padding-top: 10px;
  padding-bottom: 5px;
  font-size: 2.5vh;
}
.help-section p {
  padding: 10px;
  font-size: 2.3vh;
}
.help-section a {
  font-size: 2.3vh;
}
</style>

<script>
  module.exports = {
    data: function() {
      return {}
    }
  };
</script>
