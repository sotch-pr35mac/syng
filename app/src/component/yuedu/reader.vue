<template>
    <div class="reader">
        <i-col span="26">
            <Row>
               <div class="text-section">
                   <span v-for="word in segmentedWords" track-by"$index"><span v-if="word.isWord" class="clickableWord" v-bind:class="{'word-clicked': activeIndex == $index}" v-on:click="inspectWord($index)">{{word.text}}</span><span v-if="word.isWord == false">{{word.text}}</span></span>
              </div>
            </Row>
            <Row>
                <div class="inspection-section">
                    <div v-if="activeIndex == -1">
                        <center>
                            <br>
                            <h3>No Word Selected</h3>
                            <h4>Click on a word to inspect it.</h4>
                        </center>
                    </div>
                    <div v-if="activeIndex != -1">
                        <Row>
                            <i-col span="5">
                                <div class="word-listing">
                                    <li class="word-listing-item" v-for="word in inspectionInformation" track-by="$index">
                                        <div class="word-listing-content" v-on:click="switchWord($index)">
                                            <h2>{{ word.simplified }} <span v-if="word.simplified != word.tranditional">({{ word.traditional }})</span></h2>
                                            <p>{{ word.pinyin }}</p>
                                            <p>{{ word.definitions.join(" ").substring(0, 27); }}</p>
                                        </div>
                                    </li>
                                </div>
                            </i-col>
                            <i-col span="19">
                                <div id="inspection-content">
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
                                                <Dropdown-item v-on:click="createNewList()">Create New List</Dropdown-item>
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
                                        <a v-for="char in currentWord.simplified" track-by="$index" :style="{ color: currentWord.color[$index] }">{{ char }}</a>
                                        <span v-if="currentWord.simplified != currentWord.traditional">
                                            (<a v-for="char in currentWord.traditional" track-by"$index" :style="{ color: currentWord.color[$index] }">{{ char }}</a>)
                                        </span>
                                    </h1>
                                    <h3 style="margin-top: 0px; padding-left: 3px;">{{ currentWord.pronunciation }}</h3>
                                    <br>
                                    <Collapse active-key="1">
                                        <Panel key="1">
                                            Definitions
                                            <div slot="content" class="definitions-list">
                                                <li v-for="def in currentWord.definitions">{{ def }}</li>
                                            </div>
                                        </Panel>
                                    </Collapse>
                                </div>
                            </i-col>
                        </Row>
                    </div>
                </div>
            </Row>
        </i-col>
    </div>
</template>

<style scoped>
.word-content {
    height: 31.75vh;
    overflow: auto;
}
.word-listing {
    height: 31.75vh;
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
    background-color: #11cd6;
}
.word-listing-content {
    overflow: hidden;
    cursor: pointer;
    text-size: 14pt;
}
.word-clicked {
    background-color: #39f;
    border-radius: 5px;
    color: #fff;
    padding: 2px;
}
.text-section {
    height: 60vh;
    font-size: 1.6em;
    padding: 10px;
    overflow-x: hidden;
    overflow-y: scroll;
}
.inspection-section {
    height: 31.75vh;
    border-top: 0.25vh solid #657180;
}
.word-tags {
    margin-top: 10px;
}
.pull-right {
    float: right;
}
.definitions-list {
    list-style: circle;
    font-size: 12pt;
    color: black;
}
#inspection-content {
    overflow-x: none;
    overflow-y: scroll;
    padding: 10px;
    height: 31vh;
}
a {
    color: black;
}

</style>

<script>
var hsk = window.require('hsk-list');
var _ = window.require('underscore');
var Tts = require('../common/tts/tts.vue');
var databaseManager = new window.DatMan();

module.exports = {
    props: [ 'segmentedWords' ],
    data: function() {
        return {
            inspectionInformation: [],
            activeIndex: -1,
            currentWord: {},
            wordListings: databaseManager.userListNames,
            pageContent: [],
            currentPage: 0
        }
    },
    attached: function() {
        var self = this;

        databaseManager.updateListing();

        ipc.on('receive-database-update', function(event, args) {
            self.wordListings = databaseManager.userListNames;
            databaseManager.updateListing();
        });
    },
    components: {
        'tts': Tts
    },
    methods: {
    	inspectWord: function(wordIndex) {
    		var self = this;
            self.inspectionInformation = self.segmentedWords[wordIndex].wordObject;
            self.switchWord(0);
            self.activeIndex = wordIndex;
    	},
        switchWord: function(entryIndex) {
            var self = this;
            self.currentWord = self.inspectionInformation[entryIndex];
            
            var hskLevel = hsk(self.currentWord.simplified);
            if(hskLevel > 0) {
                self.currentWord.hsk = hskLevel;
            }

            var colors = [];
            _.each(self.currentWord.toneMarks, function(tone) {
                if(tone == "1") {
                    colors.push("blue");
                } else if(tone == "2") {
                    colors.push("orange");
                } else if(tone == "3") {
                    colors.push("red");
                } else if(tone == "4") {
                    colors.push("green");
                } else if(tone == "5") {
                    colors.push("black");
                } else if(tone == "0") {
                    colors.push("black");
                }
            });

            self.currentWord.color = colors;
        },
        createNewList: function() {
            window.ipc.send('show-manage-lists');
        },
        addToList: function(listName) {
            var self = this;

            function displaySuccess(listName, traditional, simplified) {
                self.$Message.success(simplified + ' (' + traditional + ') successfully added to ' + listName + '.');
            }

            if(listName == 'bookmarks') {
                databaseManager.addToBookmarks(self.currentWord.simplified, self.currentWord.traditional, self.currentWord.pinyin, self.currentWord.definitions, self.currentWord.toneMarks).then(function(success) {
                    if(success == true) {
                        displaySuccess('Bookmarks', self.currentWord.traditional, self.currentWord.simplified);
                    } else {
                        console.log(success);
                    }
                }, function(err) {
                    console.log(err);
                });
            } else {
                databaseManager.addToUserList(listName, self.currentWord.simplified, self.currentWord.traditional, self.currentWord.pinyin, self.currentWord.definitions, self.currentWord.toneMarks).then(function(success) {
                    if(success == true) {
                        displaySuccess(listName, self.currentWord.traditional, self.currentWord.simplified);
                    } else {
                        console.log(success);
                    }
                }, function(err) {
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
        }
    }
}
</script>
