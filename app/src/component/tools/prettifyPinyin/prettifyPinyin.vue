<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <i-button v-on:click="convert()">
            Prettify
          </i-button>
        </Row>
      </div>
      <Row>
        <i-input :value.sync="input" type="textarea" :autosize="{minRows: 10, maxRows: 10}" placeholder="Enter your pinyin with tone numbers here"></i-input>
        <hr>
        <div id="output_text_container">
          <p id="output_text">Your pinyin with tone marks will appear here</p>
        </div>
      </Row>
    </i-col>
  </div>
</template>

<style scoped>
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  #output_text_container {
    padding: 10px;
    overflow-y: scroll;
    height: 57.5vh;
  }
  #output_text {
    font-size: 2.5em;
  }
  textarea {
    resize: none;
  }
</style>

<script>
  var prettifier = require('prettify-pinyin');

  module.exports = {
    data: function() {
      return {
        input: ''
      }
    },
    methods: {
      convert() {
        var self = this;

        var inputPrime = self.input.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        inputPrime = inputPrime.replace(/\s{2,}/g," ");

        output = prettifier.prettify(inputPrime);
        $('#output_text').html(output);
      }
    }
  }
</script>
