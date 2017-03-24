<template>
  <i-col span="21">
    <div id="actions-frame">
      <Row>
        <!-- TODO: Write this -->
        <Dropdown trigger="click" placement="bottom-start">
          <i-button>
             <a v-if="currentList == 'bookmarks'" style="color: #657180;">Bookmarks</a>
             <a v-if="!(currentList == 'bookmarks')" style="color: #657180;">{{ currentList }}</a>
             &nbsp;
             <Icon type="arrow-down-b" size="large"></Icon>
          </i-button>
          <Dropdown-menu slot="list">
            <Dropdown-item v-on:click="switchList('bookmarks')">Bookmarks</Dropdown-item>
            <Dropdown-item v-for="collection in wordListings" v-on:click="switchList(collection)">{{ collection }}</Dropdown-item>
            <Dropdown-item divided v-on:click="createNewList()">Create New List</Dropdown-item>
          </Dropwdown-menu>
        </Dropdown>
      </Row>
    </div>
    <Row>
      <div class="clear-characters">
        <i-col span="5">
          <div class="word-listing">
            <li class="word-listing-item" v-for="word in wordList" track-by="$index">
              <div class="word-listing-content" v-on:click="switchWord(word.id)">
                <h2><strong>{{ word.simplified }}</strong> ({{ word.traditional }})</h2>
                <p>{{ word.pronunciation }}</p>
                <p>{{ word.definitions.join(' ').substring(0, 27); }}</p>
              </div>
            </li>
          </div>
        </i-col>
        <i-col span="19" class="word-content">
          <div v-if="displayWord">
            <div id="expanded-content" class="expanded-content">
              <div class="pull-right">
                <Button-group>
                  <i-button v-on:click="removeFromList(currentList)">
                    <Tooltip placement="left" content="Remove From Bookmarks">
                      <Icon type="minus-round" size="large"></Icon>
                    </Tooltip>
                  </i-button>
                  <i-button v-on:click="openLargeChars()">
                    <Tooltip placement="left" content="View Large Characters">
                      <Icon type="arrow-expand" size="large"></Icon>
                    </Tooltip>
                  </i-button>
                </Button-group>
              </div>
              <h1 style="margin-bottom: 0px;">
                <a v-for="char in currentWord.simplified" :style="{ color: currentWord.color[$index]}" track-by="$index">{{ char }}</a>
                (<a v-for="char in currentWord.traditional" :style="{ color: currentWord.color[$index] }" track-by="$index">{{ char }}</a>)
              </h1>
              <h3 style="margin-top: 0px; padding-left: 3px;">{{ currentWord.pinyin }}</h3>
              <br>
              <Collapse active-key="1">
                <Panel key="1">
                  Definitions
                  <div slot="content" class="definitions-list">
                    <li v-for="def in currentWord.definitions">{{ def }}</li>
                  </div>
                </Panel>
                <Panel key="2">
                  Characters
                  <div slot="content">
                    <br>
                    <Collapse accordion>
                      <Panel v-for="word in componentCharacters" track-by="$index">
                        {{ word.simplified }} ({{ word.traditional }}) - {{ word.pronunciation }}
                        <div slot="content">
                          <li v-for="def in word.definitions" class="definitions-list">{{ def }}</li>
                        </div>
                      </Panel>
                    </Collapse>
                  </div>
                </Panel>
              </Collapse>
            </div>
          </div>
        </i-col>
      </div>
    </Row>
  </i-col>
</template>

<style scoped>
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .word-content {
    height: 92vh;
    overflow: auto;
  }
  .word-listing {
    height: 92vh;
    overflow-y: scroll;
    background-color: #f5f5f4;
    text-overflow: ellipsis;
    list-style: none;
  }
  .word-listing-item {
    padding: 10px;
    font-size: 12px;
    color: #414142;
    border-top: 1px solid #ddd;
  }
  .word-listing-item:first-child {
    border-top: 0px;
  }
  .word-listing-item.active, .list-group-item.selected {
    color: #fff;
    background-color: #116cd6;
  }
  .word-listing-content {
    overflow: hidden;
    cursor: pointer;
    text-size: 14pt;
  }
  .expanded-content {
    padding-right: 15px;
    padding-left: 25px;
    margin-right: auto;
    margin-left: auto;
    color: black;
  }
  .expanded-content h1 {
    font-size: 42px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .expanded-content h2 {
    font-size: 36px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .expanded-content h3 {
    font-size: 30px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .expanded-content h4 {
    font-size: 24px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .expanded-content h5 {
    font-size: 18px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .expanded-content h6 {
    font-size: 12px;
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .clear-characters {
    font-family: system, -apple-system, ".SFNSDisplay-Regular", "Helvetica Neue", Helvetica, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.6;
    overflow-y: auto;
  }
  .definitions-list {
    list-style: circle;
    font-size: 12pt;
    color: black;
  }
  .pull-right {
    float: right;
  }
</style>

<script>
var databaseManager = new window.DatMan();

// Generate unqiue random ID's for the word listings expanded content to be linked with the expanded content
function generateUIID() {
  var d = new Date().getTime();
  if(window.performance && typeof window.performance.now === 'function') {
    d += performance.now();
  }
  var uiid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });

  return uiid;
}

function colorTones(originalListing) {
  var compiledListing = [];
  const BLACK_TONE = 'black';
  const BLUE_TONE = 'blue';
  const ORANGE_TONE = 'orange';
  const RED_TONE = 'red';
  const GREEN_TONE = 'green';

  console.log(originalListing);

  _.each(originalListing, function(word) {
    var uiid = generateUIID();
    var colors = [];

    _.each(word.toneMarks, function(tone) {
      if(tone == '1') {
        colors.push(BLUE_TONE);
      }
      else if(tone == '2') {
        colors.push(ORANGE_TONE);
      }
      else if(tone == '3') {
        colors.push(RED_TONE);
      }
      else if(tone == '4') {
        colors.push(GREEN_TONE);
      }
      else if(tone == '5') {
        colors.push(BLACK_TONE);
      }
      else if(tone == '0') {
        colors.push(BLACK_TONE);
      }
    });

    var formattedWord = {
      traditional: word.traditional,
      simplified: word.simplified,
      pinyin: word.pronunciation,
      toneMarks: word.toneMarks,
      definitions: word.definitions,
      id: uiid,
      _id: word._id,
      color: colors
    };

    compiledListing.push(formattedWord);
  });

  return compiledListing;
}

module.exports = {
  data: function() {
    return {
      currentList: 'bookmarks',
      wordList: [],
      displayWord: false,
      currentWord: {},
      componentCharacters: [],
      wordListings: databaseManager.userListNames
    };
  },
  attached: function() {
    var self = this;

    self.switchList('bookmarks');

    databaseManager.updateListing();

    ipc.on('receive-database-update', function(event, args) {
      self.wordListings = databaseManager.userListNames;
      databaseManager.updateListing();
    });
  },
  methods: {
    removeFromList: function(listName) {
      var self = this;

    	if(listName == 'bookmarks') {
    		// TODO: Figure out how to display a success or failure message to the user.
    		databaseManager.removeFromBookmarks(self.currentWord._id);
        self.switchList('bookmarks');
        self.displayWord = false;
    	}
    	else {
    		databaseManager.removeFromUserList(listName, self.currentWord._id).then(function(result) {
    			if(result == true) {
    				// TODO: Display the success message to the user
            self.switchList(listName);
            self.displayword = false;
    			}
    			else {
    				// TODO: Display the error message to the user
    			}
    		}, function(err) {
    			// TODO: Display the error message to the user
    			console.log('There was an error removing the word from the list.');
    			console.log(err);
    		});

    	}
    },
    openLargeChars: function() {
      var lgObj = {
        traditional: this.currentWord.traditional,
        simplified: this.currentWord.simplified
      };

      window.ipc.send('show-large-characters', lgObj);
    },
    switchWord: function(id) {
      var self = this;

      function getCharacterComponents(tradWord) {
        var componentCharacters = [];
        for(var x = 0; x < tradWord.length; x++) {
          window.engine.searchByChinese(tradWord[x], function(result) {
            componentCharacters.push(result);
          });
        }

        var mergedList = [].concat.apply([], componentCharacters);
        var flatList = [].concat.apply([], mergedList);

        return flatList;
      }

      self.currentWord = $.grep(self.wordList, function(e) { return e.id == id})[0];
      self.componentCharacters = getCharacterComponents(self.currentWord.traditional);
      self.displayWord = true;
    },
    switchList: function(list) {
      var self = this;

      if(list == 'bookmarks') {
        databaseManager.bookmarks.then(function(bookmarksList) {
          self.wordList = colorTones(bookmarksList);
          self.currentList = "bookmarks";
          self.displayWord = false;
        }, function(err) {
          // TODO: Handle the error
          console.log(err);
        });
      }
      else {
        databaseManager.getUserListContent(list).then(function(listContent) {
          self.wordList = colorTones(listContent);
          self.currentList = list;
          self.displayWord = false;
        }, function(err) {
          // TODO: Handle the error
          console.log(err);
        });
      }
    },
    createNewList: function() {
      window.ipc.send('show-manage-lists');
    }
  }
}
</script>
