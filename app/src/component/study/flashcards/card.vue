<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <i-button v-on:click="previous()" id="previousButton" v-if="iterator != 0">Previous</i-button>
          <i-button v-if="iterator == 0" disabled>Previous</i-button>
          <Button-group class="pull-right">
            <i-button v-on:click="flip()">
              <Icon type="loop" size="large"></Icon>
              Flip Card
            </i-button>
            <i-button v-on:click="next()" id="nextButton" v-if="iterator != (list.length - 1)">Next</i-button>
            <i-button disabled v-if="iterator == (list.length - 1)">Next</i-button>
          </Button-group>
        </Row>
      </div>
      <front v-if="!cardFlipped" v-bind:word="list[iterator]"></front>
      <back v-if="cardFlipped" v-bind:word="list[iterator]"></back>
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
</style>

<script>
var Front = require('./cardFront.vue');
var Back = require('./cardBack.vue');

module.exports = {
  props: [ 'list' ],
  data: function() {
    return {
      iterator: 0,
      cardFlipped: false
    }
  },
  components: {
    'front': Front,
    'back': Back
  },
  methods: {
    flip() {
      var self = this;

      if(self.cardFlipped == true) {
        self.cardFlipped = false;
      } else {
        self.cardFlipped = true;
      }
    },
    next() {
      var self = this;

      if(self.iterator < self.list.length) {
        self.cardFlipped = false;
        self.iterator = self.iterator + 1;
      }
    },
    previous() {
      var self = this;

      if((self.iterator - 1) >= 0) {
        self.cardFlipped = false;
        self.iterator = self.iterator - 1;
      }
    }
  }
}
</script>
