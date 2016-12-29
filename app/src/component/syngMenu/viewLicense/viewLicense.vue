<template>
  <i-col span="4">
    <Menu theme="light" width='100%' active-key='1'>
      <Menu-item key='1' v-on:click='loadView("syngLicense")'>
        <center>
          <h3>Syng License</h3>
        </center>
      </Menu-item>
      <Menu-item key='2' v-on:click='loadView("cccedictLicense")'>
        <center>
          <h3>CC-CEDICT License</h3>
        </center>
      </Menu-item>
      <Menu-item key='3' v-on:click='loadView("nodecccedictLicense")'>
        <center>
          <h3>Node-CC-CEDICT License</h3>
        </center>
      </Menu-item>
    </Menu>
  </i-col>
  <i-col span="17">
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
  var SyngLicense = require('./syngLicense.vue');
  var CCCEDICTLicense = require('./cccedictLicense.vue');
  var NodeCCCEDICTLicense = require('./nodeCCCEDICTLicense.vue');

  module.exports = {
    data: function() {
      return {
        currentView: 'syngLicense'
      }
    },
    components: {
      'syngLicense': SyngLicense,
      'cccedictLicense': CCCEDICTLicense,
      'nodecccedictLicense': NodeCCCEDICTLicense
    },
    methods: {
      loadView: function(viewName) {
        this.currentView = viewName;
      }
    }
  };
</script>
