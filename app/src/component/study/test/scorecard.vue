<template>
  <div>
    <br>
    <br>
    <br>
    <center>
      <h2>Your Score: </h2>
      <br>
      <h1>{{score}}%</h1>
      <br>
      <br>
      <p v-if="score >= 90">Excellent!! Keep up the great work!</p>
      <p v-if="score < 90">Nice!</p>
      <p v-if="score < 50">Keep studying and you'll do better next time!</p>
    </center>
  </div>
</template>

<style scoped>
  h1 {
    font-size: 9vh;
  }
  h2 {
    font-size: 4vh;
  }
  p {
    font-size: 3vh;
  }
</style>

<script>
module.exports = {
  props: [ 'score' ],
  data: function() {
    return {}
  },
  methods: {}
}
</script>
