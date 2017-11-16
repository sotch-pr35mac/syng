<template>
  <div>
    <center>
      <br>&nbsp;<br>
      <br>&nbsp;<br>
      <h1 class="question">{{ question.question }}</h1>
      <br>&nbsp;<br>
      <h2 class="answer">{{ question.answers[question.correctAnswer] }}
    </center>
  </div>
</template>

<style scoped>
  .question {
    font-size: 9vh;
    font-weight: lighter;
  }
  .answer {
    font-size: 8vh;
    overflow: auto;
    font-weight: lighter;
  }
</style>

<script>
module.exports = {
  props: [ 'question' ],
  data: function() {
    return {}
  },
  methods: {}
}
</script>
