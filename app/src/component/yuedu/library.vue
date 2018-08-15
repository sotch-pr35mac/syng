<template>
  <div>
    <center>
      <div v-if="libraryItems < 1">
        <h1>No Items in Library</h1>
      </div>
    </center>
    <div v-if="libraryItems > 0">
      <!-- Put the list here -->
    </div>
  </div>
</template>

<style>
  .pull-right {
    float: right;
  }
  .notice {
      top: 20vh;
      left: 60vh;
      position: absolute;
  }
</style>

<script>
module.exports = {
  props: [],
  data: function() {
    return {
        libraryItems: 0
    }
  },
  components: {
  },
  methods: {

  }
}
</script>
