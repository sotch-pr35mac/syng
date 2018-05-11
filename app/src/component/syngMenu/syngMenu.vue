<template>
  <i-col span="4" class='main-column'>
    <Menu theme="light" width="100%" active-key='1'>
      <Menu-item key="1" v-on:click='loadView("aboutSyng")'>
        <center>
          <h2>About</h2>
        </center>
      </Menu-item>
      <!-- Settings menu not implmented in this version -->
      <!--
      <Menu-item key="2" v-on:click='loadView("settings")'>
        <center>
          <h2>Settings</h2>
        </center>
      </Menu-item>
    -->
      <Menu-item key="3" v-on:click='loadView("viewLicense")'>
        <center>
          <h2>Licenses</h2>
        </center>
      </Menu-item>
      <Menu-item key="4" v-on:click='loadView("reportBug")'>
        <center>
          <h2>Report Bug</h2>
        </center>
      </Menu-item>
      <!-- Help Menu not implemented in this version -->
      <!--
      <Menu-item key="5" v-on:click="loadView('help')">
        <center>
          <h2>Help</h2>
        </center>
      </Menu-item>
      -->
      <Menu-item key="6" v-on:click="loadView('donate')">
        <center>
          <h2>Donate</h2>
        </center>
      </Menu-item>
    </Menu>
  </i-col>
  <i-col span="17" class='main-column'>
    <component :is='currentView'></component>
  </i-col>
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
var AboutSyng = require('./aboutSyng/aboutSyng.vue');
var ReportBug = require('./reportBug/reportBug.vue');
var Settings = require('./settings/settings.vue');
var ViewLicense = require('./viewLicense/viewLicense.vue');
var Help = require('./help/help.vue');
var Donate = require('./donate/donate.vue');

module.exports = {
  data: function() {
    return {
      currentView: 'aboutSyng'
    }
  },
  components: {
    'aboutSyng': AboutSyng,
    'reportBug': ReportBug,
    'settings': Settings,
    'viewLicense': ViewLicense,
    'help': Help,
    'donate': Donate
  },
  methods: {
    loadView: function(viewName) {
      this.currentView = viewName;
    }
  }
}
</script>
