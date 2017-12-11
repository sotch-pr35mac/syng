<template>
  <div>
    <component :is="currentView"></component>
  </div>
</template>

<style>
</style>

<script>
var Library = require('./library.vue');
var Reader = require('./reader.vue');

module.exports = {
  data: function() {
    return {
      currentView: 'library'
    }
  },
  components: {
    'library': Library
  }
}
</script>
