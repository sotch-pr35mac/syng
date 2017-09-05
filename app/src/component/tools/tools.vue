<template>
  <div>
    <i-col span="4" class="main-column">
      <Menu theme="light" width="100%" active-key="1">
        <Menu-item key="1" v-on:click="loadView('prettifyPinyin')">
          <center>
            <h2>Prettify Pinyin</h2>
          </center>
        </Menu-item>
        <Menu-item key="2" v-on:click="loadView('pinyinify')">
          <center>
            <h2>Pinyinify</h2>
          </center>
        </Menu-item>
        <Menu-item key="3" v-on:click="loadView('characterConvert')">
          <center>
            <h2>语言&nbsp;&#8644;&nbsp;語言</h2>
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
var PrettifyPinyin = require('./prettifyPinyin/prettifyPinyin.vue');
var Pinyinify = require('./pinyinify/pinyinify.vue');
var CharacterConvert = require('./characterConvert/characterConvert.vue');

module.exports = {
  data: function() {
    return {
      currentView: 'prettifyPinyin'
    }
  },
  components: {
    'prettifyPinyin': PrettifyPinyin,
    'pinyinify': Pinyinify,
    'characterConvert': CharacterConvert
  },
  methods: {
    loadView: function(viewName) {
      this.currentView = viewName;
    }
  }
}
</script>
