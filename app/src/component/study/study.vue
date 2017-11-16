<template>
  <div>
    <i-col span="4" class="main-column">
      <Menu theme="light" width="100%" active-key="1">
        <Menu-item key="1" v-on:click="loadView('flashcards')">
          <center>
            <h2>Flashcards</h2>
          </center>
        </Menu-item>
        <Menu-item key="2" v-on:click="loadView('test')">
          <center>
            <h2>Quiz</h2>
          </center>
        </Menu-item>
      </Menu>
    </i-col>
    <i-col span="17" class="main-column">
      <component :is="currentView"></component>
    </i-col>
  </div>
</template>

<style>
.ivu-col-span-4 {
  background-color: #fff;
  border-right: 2px solid #d7dde4;
}
.ivu-col-span-4:after {
  background: #d7dde4;
  position: absolute;
  bottom: 0;
  display: block;
}
</style>

<script>
var Flashcards = require('./flashcards/flashcards.vue');
var Test = require('./test/test.vue');

module.exports = {
  data: function() {
    return {
      currentView: 'flashcards'
    }
  },
  components: {
    'flashcards': Flashcards,
    'test': Test
  },
  methods: {
    loadView: function(viewName) {
      this.currentView = viewName;
    }
  }
}
</script>
