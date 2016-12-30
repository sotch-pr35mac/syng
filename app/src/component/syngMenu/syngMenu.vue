<template>
  <i-col span="4" class='main-column'>
    <Menu theme="light" width="100%" active-key='1'>
      <Menu-item key="1" v-on:click='loadView("aboutSyng")'>
        <center>
          <h2>About</h2>
        </center>
      </Menu-item>
      <Menu-item key="2" v-on:click='loadView("settings")'>
        <center>
          <h2>Settings</h2>
        </center>
      </Menu-item>
      <Menu-item key="3" v-on:click='loadView("viewLicense")'>
        <center>
          <h2>View Licenses</h2>
        </center>
      </Menu-item>
      <Menu-item key="4" v-on:click='loadView("reportBug")'>
        <center>
          <h2>Report Bug</h2>
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
    'viewLicense': ViewLicense
  },
  methods: {
    loadView: function(viewName) {
      this.currentView = viewName;
    }
  }
}
</script>
