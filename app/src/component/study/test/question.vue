<template>
  <div>
    <center>
      <br>&nbsp;<br>
      <br>&nbsp;<br>
      <h1 class="question">{{ question.question }}</h1>
      <br>&nbsp;<br>
      <Row>
        <i-col span="12">
          <i-button type="primary" size="large" long v-on:click="checkAnswer(0)"><span class="answer">{{ question.answers[0] }}</span></i-button>
          <br>&nbsp;<br>
          <i-button type="primary" size="large" long v-on:click="checkAnswer(1)"><span class="answer">{{ question.answers[1] }}</span></i-button>
        </i-col>
        <i-col span="12">
          <i-button type="primary" size="large" long v-on:click="checkAnswer(2)"><span class="answer">{{ question.answers[2] }}</span></i-button>
          <br>&nbsp;<br>
          <i-button type="primary" size="large" long v-on:click="checkAnswer(3)"><span class="answer">{{ question.answers[3] }}</span></i-button>
        </i-col>
      </Row>
    </center>
  </div>
</template>

<style scoped>
  .question {
    font-size: 9vh;
    font-weight: lighter;
  }
  .answer {
    font-size: 4vh;
    overflow: auto;
  }
  .ivu-btn-long {
    width: 90%;
  }
</style>

<script>
module.exports = {
  props: [ 'question' ],
  data: function() {
    return {}
  },
  methods: {
    checkAnswer(index) {
      var self = this;

      console.log(self.question);

      if(index == self.question.correctAnswer) {
        self.$dispatch('correctAnswer');
      } else {
        self.$dispatch('incorrectAnswer');
      }
    }
  }
}
</script>
