<template>
  <center>
    <div class="card-container">
      <h1 class="big-word">{{ word.simplified }} <span v-if="word.simplified != word.traditional">({{ word.traditional }})</span></h1>
    </div>
  </center>
</template>

<style scoped>
  .big-word {
    text-align: center;
    font-size: 15vh;
    margin-top: 25%;
    font-weight: lighter;
  }
  .card-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }
</style>

<script>
module.exports = {
  props: [ 'word' ],
  data: function() {
    return {}
  },
  methods: {}
}
</script>
