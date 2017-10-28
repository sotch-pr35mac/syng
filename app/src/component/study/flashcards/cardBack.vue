<template>
  <center>
    <div class="card-container">
      <h1 class="pinyin">{{ word.pronunciation }}</h1>
      <br>
      <ol>
        <li v-for="def in word.definitions" class="definitions">{{ def }}</li>
      </ol>
    </div>
  </center>
</template>

<style scoped>
  .definitions {
    font-weight: lighter;
    font-size: 3.5vh;
    text-align: left;
    padding-right: 10px;
    padding-left: 10px;
  }
  .pinyin {
    text-align: center;
    font-size: 10vh;
    margin-top: 10px;
    font-weight: lighter;
  }
  .card-container {
    height: 92%;
    width: 71%;
    overflow-y: scroll;
    overflow-x: hidden;
    position: fixed;
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
