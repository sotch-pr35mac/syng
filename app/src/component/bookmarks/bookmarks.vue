<template>
  <center>
    <i-col span="21">
      <div id="actions-frame">
        <Row>
          <!-- TODO: Write this -->
        </Row>
      </div>
      <Row>
        <div class="clear-characters">
          <i-col span="5">
            <div class="listing">
              <li class="listing-item" v-for="word in wordList" track-by="$index">
                <div class="listing-content" v-on:click="switchWord(word.id)">
                  <h2><strong>{{ word.simplified }}</strong> ({{ word.traditional }}))</h2>
                  <p>{{ word.pinyin }}</p>
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
                      <Tooltip placement="bottom" content="Remove From Bookmarks">
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
                  (<a v-for="char in currentWord.traditional" :style="{ currentWord.color[$index] }" track-by="$index">{{ char }}</a>)
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
                        <Panel v-for="word in ComponentCharacters" track-by="$index">
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
  </center>
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
  .listing {
    height: 92vh;
    overflow-y: scroll;
    background-color: #f5f5f4;
    text-overflow: ellipsis;
    list-style: none;
  }
  .listing-item {
    padding: 10px;
    font-size: 12px;
    color: #414142;
    border-top: 1px solid #ddd;
  }
  .listing-item:first-child {
    border-top: 0px;
  }
  .listing-item.active .list-group-item.selected {
    color: #fff;
    background-color: #116cd6;
  }
  .listing-content {
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

module.exports = {
  data: function() {
    return {
      currentList: 'bookmarks',
      wordList: databaseManager.bookmarks,
      displayWord: false,
      currentWord: {}
    };
  },
  attached: function() {
    // TODO: Add the words to the page here
  }
  methods: {
    removeFromList: function() {
      // TODO: write this
    },
    openLargeChars: function() {
      // TODO: Write this
    },
    switchWord: function() {
      // TODO: Write this
    }
  }
}
</script>
