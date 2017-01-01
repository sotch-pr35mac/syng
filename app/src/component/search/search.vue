<template>
  <i-col span="21">
    <div id="search-frame">
      <Row>
        <Tooltip placement='right' content='The intended language of latin input.'>
          <i-button id="input-method" v-on:click="switchInputMethod()">{{ inputMethod }}</i-button>
        </Tooltip>
        &nbsp;
        <i-input placeholder="Search in Chinese/English/Pinyin" style="width: 85%"></i-input>
        &nbsp;
        <i-button id="search-button" v-on:click="performSearch()">Search</i-button>
      </Row>
    </div>
    <Row>
      <i-col span="5">
        <div class="search-listing">
          <li class='search-listing-item' v-for='wordItem in searchResults'>
            <div class='search-listing-content'>
              <h4><strong>{{ wordItem.simplified }} ({{ wordItem.traditional }})</strong></h4>
              <p>{{ wordItem.pinyin }}</p>
              <p>{{ wordItem.definitions.join(" "); }}</p>
            </div>
          </li>
        </div>
      </i-col>
      <i-col span="19">
      </i-col>
    </Row>
  </i-col>
</template>

<style>
  #search-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .search-listing {
    height: 92vh;
    overflow-y: scroll;
    background-color: #f5f5f4;
    text-overflow: ellipsis;
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
  }
</style>

<script>
const ENGLISH_INPUT = "EN";
const PINYIN_INPUT = "PY";
var searchResults = [];

module.exports = {
  data: function() {
    return {
      inputMethod: ENGLISH_INPUT,
      searchResults: searchResults
    }
  },
  methods: {
    switchInputMethod: function() {
      if(this.inputMethod == ENGLISH_INPUT) {
        this.inputMethod = PINYIN_INPUT;
      }
      else if(this.inputMethod == PINYIN_INPUT) {
        this.inputMethod = ENGLISH_INPUT;
      }
    },
    performSearch: function() {
      // Get the input method to determine search method
      var inputMethod = this.inputMethod;
    }
  }
}
</script>
