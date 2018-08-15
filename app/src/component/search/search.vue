<template>
  <i-col span="21">
    <div id="search-frame">
      <Row>
        <Tooltip placement='right' content='The intended language of latin input.'>
          <i-button id="input-method" v-on:click="switchInputMethod()">{{ inputMethod }}</i-button>
        </Tooltip>
        &nbsp;
        <i-input placeholder="Search in Chinese/English/Pinyin" style="width: 85%" id="default-search" :value.sync="searchText"></i-input>
        &nbsp;
        <i-button id="search-button" v-on:click="performSearch()">Search</i-button>
      </Row>
    </div>
    <Row>
      <div class="clear-characters">
        <i-col span="5">
          <div class="search-listing">
            <li class='search-listing-item' v-for='word in searchResults' track-by="$index">
              <div class='search-listing-content' v-on:click="switchWord(word.id)">
                <h2>{{ word.simplified }} <span v-if="word.simplified != word.traditional">({{ word.traditional }})</span></h2>
                <p>{{ word.pinyin }}</p>
                <p>{{ word.definitions.join(" ").substring(0, 27); }}</p>
              </div>
            </li>
          </div>
        </i-col>
        <i-col span="19" class="search-content">
          <div id='noSearchResults' v-if="noSearchResults">
            <center>
              <br>
              <br>
              <br>
              <br>
              <h1>No Search Results</h1>
            </center>
          </div>
          <div v-if="displayWord">
            <div id="expandedContent" v-if="!noSearchResults" class="expanded-content">
              <div class="pull-right">
                <Dropdown trigger="click" placement="bottom-end">
                  <i-button>
                    <Icon type="arrow-down-b" size="large"></Icon>
                    &nbsp;
                    <Tooltip placement="bottom" content="Add to List">
                      <Icon type="navicon-round" size="large"></Icon>
                    </Tooltip>
                  </i-button>
                  <Dropdown-menu slot="list">
                    <Dropdown-item v-for="collection in wordListings" v-on:click="addToList(collection)">{{ collection }}</Dropdown-item>
                    <Dropdown-item v-on:click="addToList('bookmarks')">Bookmarks</Dropdown-item>
                    <Dropdown-item divided v-on:click="createNewList()">Create New List</Dropdown-item>
                  </Dropdown-menu>
                </Dropdown>
                <Button-group>
                  <i-button v-on:click="addToList('bookmarks')">
                    <Tooltip placement="bottom" content="Add to Bookmarks">
                      <Icon type="plus-round" size="large"></Icon>
                    </Tooltip>
                  </i-button>
                  <i-button v-on:click="openLargeChars()">
                    <Tooltip placement="left" content="View Large Characters">
                      <Icon type="arrow-expand" size="large"></Icon>
                    </Tooltip>
                  </i-button>
                  <tts v-bind:chars="currentWord.traditional"></tts>
                </Button-group>
                <Row>
                  <div class="pull-right word-tags">
                    <Tag v-if="currentWord.hsk" color="yellow">HSK: {{currentWord.hsk}}</Tag>
                  </div>
                </Row>
              </div>
              <h1 style="margin-bottom: 0px;">
                <a v-for="char in currentWord.simplified" :style="{ color: currentWord.color[$index] }" track-by="$index">{{ char }}</a>
                <span v-if="currentWord.simplified != currentWord.traditional">
                  (<a v-for="char in currentWord.traditional" :style="{ color: currentWord.color[$index] }" track-by="$index">{{ char }}</a>)
                </span>
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
                        {{ word.simplified }} <span v-if="word.simplified != word.traditional">({{ word.traditional }})</span> - {{ word.pronunciation }}
                        <div slot="content">
                          <li v-for="def in word.definitions" class="definitions-list">{{ def }}</li>
                        </div>
                      </Panel>
                    </Collapse>
                  </div>
                </Panel>
              </Collapse>
              <br>
            </div>
          </div>
        </i-col>
      </div>
    </Row>
  </i-col>
</template>

<style scoped>
  #search-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .search-content {
    height: 92vh;
    overflow: auto;
  }
  .search-listing {
    height: 92vh;
    overflow-y: scroll;
    background-color: #f5f5f4;
    text-overflow: ellipsis;
    list-style: none;
  }
  .search-listing-item {
    padding: 10px;
    font-size: 12px;
    color: #414142;
    border-top: 1px solid #ddd;
  }
  .search-listing-item:first-child {
    border-top: 0;
  }
  .search-listing-item.active, .list-group-item.selected {
    color: #fff;
    background-color: #116cd6;
  }

  .search-listing-content {
      overflow: hidden;
      cursor: pointer;
      text-size: 14pt;
  }
  .expanded-content {
  	padding-right: 15px;
  	padding-left: 25px;
  	margin-right: auto;
  	margin-left: auto;
  	/*overflow-y: scroll;*/
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
  .word-tags {
    margin-top: 10px;
  }
</style>

<script>
const ENGLISH_INPUT = "EN";
const PINYIN_INPUT = "PY";
var searchResults = [];
var franc = window.require('franc');
var _ = window.require('underscore');
var hsk = window.require('hsk-list');

var databaseManager = new window.DatMan();

var Tts = require('../common/tts/tts.vue');

module.exports = {
  data: function() {
    return {
      inputMethod: ENGLISH_INPUT,
      searchResults: searchResults,
      noSearchResults: false,
      searchText: "",
      currentWord: {},
      displayWord: false,
      componentCharacters: [],
      wordListings: databaseManager.userListNames
    }
  },
  attached: function() {
    var self = this;

    $(document).ready(function() {
      // Hacky workaround to fix the loading animation inside the textbox
      $(".ivu-icon-load-c").hide();

      $(".ivu-input").keyup(function(event) {
        self.detectPinyin();
    		if(event.keyCode == 13) {
    			$("#search-button").click();
    		}
    	});
    });

    databaseManager.updateListing();

    ipc.on('receive-database-update', function(event, args) {
      self.wordListings = databaseManager.userListNames;
      databaseManager.updateListing();
    });

    ipc.on('toggle-search-input', function(event, args) {
      self.switchInputMethod();
    });
  },
  components: {
    'tts': Tts
  },
  methods: {
    detectPinyin: function() {
      var self = this;

      function containsNumber(text) {
        return /\d/.test(text);
      }

      function containsUniqueFeatures(text) {
        if(text.includes('zh') || text.includes('iang') || containsNumber(text)) {
          return true;
        } else {
          return false;
        }
      }

      if(containsUniqueFeatures(self.searchText)) {
        self.inputMethod = PINYIN_INPUT;
      }
    },
    switchInputMethod: function() {
      if(this.inputMethod == ENGLISH_INPUT) {
        this.inputMethod = PINYIN_INPUT;
      }
      else if(this.inputMethod == PINYIN_INPUT) {
        this.inputMethod = ENGLISH_INPUT;
      }

      this.performSearch();
    },
    createNewList: function() {
      window.ipc.send('show-manage-lists');
    },
    addToList: function(listName) {
      var self = this;

      function displaySuccess(listName, traditional, simplified) {
        self.$Message.success(simplified + ' (' + traditional + ') successfully added to ' + listName + '.');
      }

      if(listName == "bookmarks") {
        databaseManager.addToBookmarks(self.currentWord.simplified, self.currentWord.traditional, self.currentWord.pinyin, self.currentWord.definitions, self.currentWord.toneMarks).then(function(success) {
          if(success == true) {
            displaySuccess('Bookmarks', self.currentWord.traditional, self.currentWord.simplified);
          }
          else {
            // TODO: Handle error
            console.log(success);
          }
        }, function(err) {
          // TODO: Handle error
          console.log(err);
        });
      }
      else {
        databaseManager.addToUserList(listName, self.currentWord.simplified, self.currentWord.traditional, self.currentWord.pinyin, self.currentWord.definitions, self.currentWord.toneMarks).then(function(success) {
          if(success == true) {
            displaySuccess(listName, self.currentWord.traditional, self.currentWord.simplified);
          }
          else {
            // TODO: Handle error
            console.log(success);
          }
        }, function(err) {
          // TODO: Handle error
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
        var wordList = [];
        for(var x = 0; x < tradWord.length; x++) {
          window.engine.searchByChinese(tradWord[x], function(result) {
            wordList.push(result);
          });
        }

        var mergedList = [].concat.apply([], wordList);
        var flatList = [].concat.apply([], mergedList);

        return flatList;
      }

      self.currentWord = $.grep(self.searchResults, function(e) { return e.id == id })[0];
      self.componentCharacters = getCharacterComponents(self.currentWord.traditional);
      self.displayWord = true;
    },
    performSearch: function() {
      this.displayWord = false;
      this.noSearchResults = false;
      this.searchResults = [];
      this.currentWord = {};

      var self = this;
      var inputMethod = self.inputMethod;
      var text = self.searchText;
      var lang = franc(text, {'minLength': 1, 'whitelist': ['eng', 'cmn', 'und']});

      // Generate unique random ID's for the search result expanded content to be linked with the search results listing
    	function generateUIID(){
    	    var d = new Date().getTime();
    	    if(window.performance && typeof window.performance.now === "function"){
    	        d += performance.now(); //use high-precision timer if available
    	    }
    	    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    	        var r = (d + Math.random()*16)%16 | 0;
    	        d = Math.floor(d/16);
    	        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    	    });
    	    return uuid;
    	}

      function compileResults(originalResults) {
        var compiledResults = [];
        const BLACK_TONE = "black";
        const BLUE_TONE = "blue";
        const ORANGE_TONE = "orange";
        const RED_TONE = "red";
        const GREEN_TONE = "green";

        _.each(originalResults, function(wordList) {
          _.each(wordList, function(word) {
            var uiid = generateUIID();
            var colors = [];

            _.each(word.toneMarks, function(tone) {
              if(tone == "1") {
                colors.push(BLUE_TONE);
              }
              else if(tone == "2") {
                colors.push(ORANGE_TONE);
              }
              else if(tone == "3") {
                colors.push(RED_TONE);
              }
              else if(tone == "4") {
                colors.push(GREEN_TONE);
              }
              else if(tone == "5") {
                colors.push(BLACK_TONE);
              }
              else if(tone == "0") {
                colors.push(BLACK_TONE);
              }
            });

            var newWord = {
              traditional: word.traditional,
              simplified: word.simplified,
              pinyin: word.pronunciation,
              toneMarks: word.toneMarks,
              definitions: word.definitions,
              id: uiid,
              color: colors
            };

            var hskLevel = hsk(word.simplified);
            if(hskLevel > 0) {
              newWord.hsk = hskLevel;
            }

            compiledResults.push(newWord);
          });
        });

        // Remove duplicates from the search results
        compiledResults = compiledResults.filter((compiledResult, index, self) =>
          index === self.findIndex((w) => (
            w.traditional === compiledResult.traditional && w.pinyin === compiledResult.pinyin
          ))
        );

        return compiledResults;
      }

      if(lang == 'cmn') {
        console.log("Search Language is Chinese");
        window.engine.searchByChinese(text, function(results) {
          console.log(results);
          if(results.length < 1) {
            self.noSearchResults = true;
          }
          else {
            self.searchResults = compileResults(results);
          }
        });
      }
      else if(lang == "eng") {
        if(inputMethod == ENGLISH_INPUT) {
          console.log("Search Language is English");
          window.engine.searchByEnglish(text, function(results) {
            console.log(results);
            if(results.length < 1) {
              self.noSearchResults = true;
            }
            else {
              self.searchResults = compileResults(results);
            }
          });
        }
        else if(inputMethod == PINYIN_INPUT) {
          console.log("Search Language is Pinyin without Tone Numbers");
          window.engine.searchByPinyin(text, function(results) {
            console.log(results);
            if(results.length < 1) {
              self.noSearchResults = true;
            }
            else {
              self.searchResults = compileResults(results);
            }
          });
        }
      }
    }
  }
}
</script>
