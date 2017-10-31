<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <Button-group v-if="viewingAnswer == false">
            <i-button id="skipButton" v-on:click="skip()">Skip</i-button>
            <i-button id="pauseButton" v-if="paused == false">Pause</i-button>
            <i-button id="resumeButton" v-if="paused == true">Resume</i-button>
          </Button-group>
          <i-button id="continue" v-if="viewingAnswer == true" v-on:click="continueTest()">Continue</i-button>
        </Row>
      </div>
      <div id="timer" class="progress"></div>
      <div id="progress" class="progress"></div>
    </i-col>
  </div>
</template>

<style>
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .pull-right {
    float: right;
  }
  .progress {
    width: 100%;
  }
</style>

<script>
var ProgressBar = require('progressbar.js');

module.exports = {
  data: function() {
    return {
      viewingAnswer: false,
      paused: false,
      timerProgress: 100,
      testProgress: 0,
      timer: null,
      test: null,
      questions: [],
      shuffledQuestions: [],
      iterator: 0,
      correct: 0,
      skipped: 0,
      incorrect: 0,
      grandScore: 0
    }
  },
  attached: function() {
    var self = this;

    self.timer = new ProgressBar.Line('#timer', {
      color: '#F13869',
      easing: 'easeInOut',
      trailColor: '#f4f4f4',
      from: { color: '#f13869' },
      to: { color: '#f1c438' },
      step: (state, bar) => {
        bar.path.setAttribute('stroke', state.color);
      }
    });
    self.timer.set(1);

    self.test = new ProgressBar.Line('#progress', {
      color: '#5CBFDD',
      easing: 'easeInOut',
      trailColor: '#f4f4f4',
      from: { color: '#5CBFDD' },
      to: { color: '#5DB65C' },
      step: (state, bar) => {
        bar.path.setAttribute('stroke', state.color);
      }
    });
  },
  methods: {
    skip() {
      var self = this;

      self.timer.animate(.5);
      self.test.animate(.5);

      self.viewingAnswer = true;
    },
    continueTest() {
      var self = this;

      self.timer.animate(.1);
      self.test.animate(.9);

      self.viewingAnswer = false;
    }
  }
}
</script>
