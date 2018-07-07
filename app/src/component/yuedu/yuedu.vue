<template>
  <div>
    <i-col span="21">
      <div id="actions-frame">
        <Row>
          <i-button v-on:click="switchMode('library')" v-if="currentView == 'reader'" id="exitReaderModeButton">Exit Reader</i-button>
          <i-button v-on:click="addToLibrary()" id="addToLibraryButton" class="pull-right">Add to Library</i-button>
        </Row>
      </div>
      <br>
      <div v-if="currentView != 'reader'">
        <center>
          <Button-group>
            <i-button v-if="currentView == 'library'" size="large" type="primary">Library</i-button>
            <i-button v-if="currentView != 'library'" size="large" v-on:click="switchMode('library')">Library</i-button>
            <i-button v-if="currentView == 'clipboard'" size="large" type="primary">Clipboard</i-button>
            <i-button v-if="currentView != 'clipboard'" size="large" v-on:click="switchMode('clipboard')">Clipboard</i-button>
            <i-button v-if="currentView == 'web'" size="large" type="primary">Web</i-button>
            <i-button v-if="currentView != 'web'" size="large" v-on:click="switchMode('web')">Web</i-button>
          </Button-group>
        </center>
      </div>
      <br>
      <component :is="currentView" v-bind:segmented-words='segmentedText'></component>
    </i-col>
  </div>
</template>

<style>
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .pull-right {
    float: right;
  }
</style>

<script>
var Library = require('./library.vue');
var Clipboard = require('./clipboard.vue');
var Web = require('./web.vue');
var Reader = require('./reader.vue');

function prepareText(text) {
  return text.map(elem => {
    return elem
  });
}

module.exports = {
  data: function() {
    return {
      currentView: 'library',
      segmentedText: ''
    }
  },
  components: {
    'library': Library,
    'web': Web,
    'clipboard': Clipboard,
    'reader': Reader
  },
  events: {
    readText: function(segmentedText) {
      var self = this;

      self.segmentedText = segmentedText;
      self.switchMode('reader');
    }
  },
  methods: {
    addToLibrary: function() {
      alert("This feature is not yet supported.");
    },
    switchMode(view) {
      this.currentView = view;
    }
  }
}
</script>
