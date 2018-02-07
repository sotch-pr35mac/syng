<template>
  <div id="settings-panel">
    <center>
      <h2>Settings</h2>
    </center>
    <br>
    <language></language>
  </div>
</template>

<style>
#settings-panel {
  padding: 25px;
}
</style>

<script>
var Language = require('./language.vue');

  module.exports = {
    data: function() {
      return {}
    },
    components: {
      language: Language
    }
  };
</script>
