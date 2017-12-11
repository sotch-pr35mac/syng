<template>
  <div>
    <component :is="currentView"></component>
  </div>
</template>

<style>
</style>

<script>
var Selector = require('./selector.vue');

module.exports = {
  data: function() {
    return {
      currentView: 'selector'
    }
  },
  components: {
    'selector': Selector
  }
}
</script>
