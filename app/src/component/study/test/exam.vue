<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <Button-group v-if="viewingAnswer == false">
            <i-button id="skipButton" v-on:click="skip()">Skip</i-button>
            <i-button id="pauseButton" v-if="paused == false" v-on:click="pause()">Pause</i-button>
            <i-button id="resumeButton" v-if="paused == true" v-on:click="resume()">Resume</i-button>
          </Button-group>
          <i-button id="continue" v-if="viewingAnswer == true" v-on:click="continueTest()">Continue</i-button>
        </Row>
      </div>
      <div id="timer" class="progress"></div>
      <div id="progress" class="progress"></div>
      <answer v-if="viewingAnswer && display == true" v-bind:question="shuffledQuestions[iterator]"></answer>
      <question v-if="!viewingAnswer && display == true" v-bind:question="shuffledQuestions[iterator]"></question>
      <scorecard v-if="viewScorecard && display == true"></scorecard>
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
var Answer = require('./answer.vue');
var Question = require('./question.vue');

module.exports = {
  props: [ 'list' ],
  data: function() {
    return {
      viewingAnswer: false,
      display: false,
      viewScorecard: false,
      paused: false,
      timerProgress: 1,
      testProgress: 0,
      timer: null,
      test: null,
      questions: [],
      shuffledQuestions: [],
      iterator: 0,
      correct: 0,
      skipped: 0,
      incorrect: 0,
      grandScore: 0,
      questionCounter: 0,
      timerTimeout: null,
      timerInterval: null
    }
  },
  components: {
    'answer': Answer,
    'question': Question
  },
  attached: function() {
    var self = this;

    self.$Notice.config({
      duration: 3,
      top: $('#progress').position().top + 30
    });

    function randomIntWithException(min, max, exception) {
      var b = 0;
      var num;
      while(b == 0) {
        num = Math.floor(Math.random() * (max - min) + min);
        if(num != exception) {
          b = 1;
          break;
        }
      }

      return num;
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function shuffler(array) {
      var j, x, i;
      for(i = array.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = array[i - 1];
        array[i - 1] = array[j];
        array[j] = x;
      }

      return array;
    }

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

    var generateAnswers = {
      pinyin: function(word, currentLocation) {
        var answers = [];

        // Add the correct answers
        answers.push(word.pronunciation);

        // Add the other three incorrect answers from the list
        for(var i = 0; i < 3; i++) {
          var num = randomIntWithException(0, self.list.length - 1, currentLocation);
          if(self.list[num].pronunciation == word.pronunciation) {
            console.log('There is going to be a duplicate in the answers....');
          }
          answers.push(self.list[num].pronunciation);
        }

        // Shuffle the list of answers
        var correctAnswer = word.pronunciation;
        var shuffledAnswers = shuffler(answers);

        // Determine the index of the correct answers
        var correctIndex;
        for(var i = 0; i < shuffledAnswers.length - 1; i++) {
          if(shuffledAnswers[i] == correctAnswer) {
            correctIndex = i;
            break;
          }
        }

        var answerObject = {
          list: shuffledAnswers,
          correctIndex: correctIndex
        };

        return answerObject;
      },
      definition: function(word, currentLocation) {
        var answers = [];
        word.definitionArray = word.definitions;

        // Determine random index from definitions of this word to pose as an answer
        var definitionIndex = randomInt(0, word.definitionArray.length - 1);
        answers.push(word.definitionArray[definitionIndex]);

        // Add the other three incorrect answers from the bookmarks dataset
        for(var i = 0; i < 3; i++) {
          var num = randomIntWithException(0, self.list.length - 1, currentLocation);
          self.list[num].definitionArray = self.list[num].definitions;
          if(self.list[num].definitionArray[definitionIndex] == word.definitionArray[definitionIndex]) {
            console.log('There is going to be a duplicate in the answers');
          }
          var incorrectDefinitionIndex = randomInt(0, self.list[num].definitionArray.length - 1);
          answers.push(self.list[num].definitionArray[incorrectDefinitionIndex]);
        }

        // Shuffle the list of answers
        var correctAnswer = word.definitionArray[definitionIndex];
        var shuffledAnswers = shuffler(answers);

        // Determine the index of the correct answers
        var correctIndex;
        for(var i = 0; i < shuffledAnswers.length; i++) {
          if(shuffledAnswers[i] == correctAnswer) {
            correctIndex = i;
            break;
          }
        }

        var answerObject = {
          list: shuffledAnswers,
          correctIndex: correctIndex
        };

        return answerObject;
      },
      character: function(word, currentLocation) {
        var answers = [];

        var characterString;

        if(word.simplified != word.traditional) {
          characterString = word.simplified + ' (' + word.traditional + ')';
        } else {
           characterString = word.simplified;
        }

        answers.push(characterString);

        for(var i = 0; i < 3; i++) {
          var num = randomIntWithException(0, self.list.length - 1, currentLocation);
          if(self.list[num].traditional == word.traditional) {
            console.log('There will be duplicate answers');
          }
          var incorrectString;

          if(self.list[num].simplified != self.list[num].traditional) {
            incorrectString = self.list[num].simplified + ' (' + self.list[num].traditional + ')';
          } else {
            incorrectString = self.list[num].simplified;
          }

          answers.push(incorrectString);
        }

        // Shuffle the list of answers
        var correctAnswer;

        if(word.traditional != word.simplified) {
          correctAnswer = word.simplified + ' (' + word.traditional + ')';
        } else {
          correctAnswer = word.simplified;
        }

        var shuffledAnswers = shuffler(answers);

        var correctIndex;
        for(var i = 0; i < shuffledAnswers.length; i++) {
          if(shuffledAnswers[i] == correctAnswer) {
            correctIndex = i;
            break;
          }
        }

        // Return the shuffled list of answers and the correct answer index
        var answerObject = {
          list: shuffledAnswers,
          correctIndex: correctIndex
        };

        return answerObject;
      }
    };

    // The object with all the generator functions to generate questions
    var generateQuestion = {
      character: function(word, currentLocation) {
        var ansObj; // The object that will hold information returned from the generation of answers functions

        // Give it a 50 / 50 chance on whether or not asking what it sounds like (pinyin) or what it mean (definition)
        // 0 for pinyin and 1 for definition
        var ansType = Math.floor(Math.random() * 2);

        if(ansType == 0) {
          // The answer type will be pinyin
          ansObj = generateAnswers.pinyin(word, currentLocation);
        }
        else if(ansType == 1) {
          // The answer type will be definition
          ansObj = generateAnswers.definition(word, currentLocation);
        }

        // Generate the question itself
        var question;

        if(word.simplified != word.traditional) {
          question = word.simplified + ' (' + word.traditional + ')';
        } else {
          question = word.simplified;
        }

        // Generate the question object and return it to the calling function
        var questionObj = {
          answers: ansObj.list,
          correctAnswer: ansObj.correctIndex,
          question: question,
          questionType: "character"
        };

        self.questionCounter++;

        return questionObj;
      },
      pinyin: function(word, currentLocation) {
        var ansObj; // The object that will hold inforation returned from the generated answers

        // Give it a 50 / 50 chance on whether or not asking what it means or what the character is
        // 0 for character, 1 for definition
        var ansType = Math.floor(Math.random() * 2);

        if(ansType == 0) {
          // The answer type will be characters
          ansObj = generateAnswers.character(word, currentLocation);
        }
        else if(ansType == 1){
          // The answer type will be definitions
          ansObj = generateAnswers.definition(word, currentLocation);
        }

        // Generate the question itself
        var question = word.pronunciation;

        // Generate the question object and return it to the calling function
        var questionObj = {
          answers: ansObj.list,
          correctAnswer: ansObj.correctIndex,
          question: question,
          questionType: "pinyin"
        };

        self.questionCounter++;

        return questionObj;
      },
      definition: function(word, currentLocation) {
        var allDefQs = []; // An array containing all the definition question objects created from one word
        word.defArray = word.definitions;
        for(var h = 0; h < word.defArray.length; h++) {
          var ansObj; // The object that will hold information returned from the generated answers

          // Give it a 50 / 50 chance on whether or not asking what it means or what the character is
          // 0 for character, 1 for pinyin
          var ansType = Math.floor(Math.random() * 2);

          if(ansType == 0) {
            // The answer type will be characters
            ansObj = generateAnswers.character(word, currentLocation);
          }
          else if(ansType == 1) {
            // The answer type will be pinyin
            ansObj = generateAnswers.pinyin(word, currentLocation);
          }

          // Generate the question itself
          var question = word.defArray[h];

          var questionObj = {
            answers: ansObj.list,
            correctAnswer: ansObj.correctIndex,
            question: question,
            questionType: "definition"
          };

          self.questionCounter++;

          allDefQs.push(questionObj);
        }

        return allDefQs;
      }
    };

    for(var i = 0; i < self.list.length; i++) {
      self.questions.push(generateQuestion.character(self.list[i], i));
      self.questions.push(generateQuestion.pinyin(self.list[i], i));
      var definitionQuestions = generateQuestion.definition(self.list[i], i);
      for(var x = 0; x < definitionQuestions.length; x++) {
        self.questions.push(definitionQuestions[x]);
      }
    }

    self.shuffledQuestions = shuffler(self.questions);
    self.processNext();
  },
  events: {
    'correctAnswer': function() {
      var self = this;

      self.correctAnswer();
    },
    'incorrectAnswer': function() {
      var self = this;

      self.incorrectAnswer();
    }
  },
  methods: {
    processNext() {
      var self = this;

      if(self.iterator <= self.questionCounter) {
        self.paused = false;
        self.viewingAnswer = false;

        self.iterator++;

        self.testProgress = (self.iterator / self.shuffledQuestions.length);
        self.test.animate(self.testProgress);

        self.display = true;
        self.setTimer();
      }
    },
    setTimer() {
      var self = this;

      self.timerProgress = 1;
      self.timer.animate(self.timerProgress);

      window.timerInterval = setInterval(function() {
        self.timerProgress = self.timerProgress - .03825;

        self.timer.animate(self.timerProgress);
      }, 1000);

      window.timerTimeout = setTimeout(function() {
        self.incorrectAnswer();
        clearInterval(self.timerInterval);
      }, 27000);
    },
    cancelTimer() {
      self.timerProgress = 0;
      clearTimeout(self.timerTimeout);
      clearInterval(self.timerInterval);
    },
    incorrectAnswer() {
      var self = this;

      console.log('incorrect answer!');
      self.cancelTimer();

      // TODO: Display that they got the question incorrect
      self.timer.animate(0);
      self.viewingAnswer = true;
      self.incorrect = self.incorrect + 1;
      self.$Notice.error({
        title: 'Incorrect'
      });
    },
    correctAnswer() {
      var self = this;

      console.log('correct answer!');
      self.cancelTimer();

      // TODO: Display that they got the question correct
      self.timer.animate(0);
      self.viewingAnswer = true;
      self.correct = self.correct + 1;
      self.$Notice.success({
        title: 'Correct!'
      });
    },
    skip() {
      var self = this;

      console.log('skipped question');
      self.cancelTimer();

      // TODO: Display that they skipped the question
      self.timer.animate(0);
      self.viewingAnswer = true;
      self.skipped = self.skipped + 1;
      self.$Notice.error({
        title: 'Skipped'
      });
    },
    continueTest() {
      var self = this;

      self.processNext();
    },
    pause() {
      var self = this;

      self.paused = true;
      self.cancelTimer();
    },
    resume() {
      var self = this;

      self.paused = false;
      self.setTimer();
    }
  }
}
</script>
