<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <Dropdown trigger="click" placement="bottom-start">
            <i-button>
              <a style="color: #657180;" v-if="(convertFrom == 'tradToSimp')">Traditional <b>&rarr;</b> Simplified</a>
              <a style="color: #657180;" v-if="(convertFrom == 'simpToTrad')">Simplified <b>&rarr;</b> Traditional</a>
              &nbsp;
              <Icon type="arrow-down-b" size="large"></Icon>
            </i-button>
            <Dropdown-menu slot="list">
              <Dropdown-item v-on:click="convertFrom = 'tradToSimp'">Traditional <b>&rarr;</b> Simplified</Dropdown-item>
              <Dropdown-item v-on:click="convertFrom = 'simpToTrad'">Simplified <b>&rarr;</b> Traditional</Dropdown-item>
            </Dropdown-menu>
          </Dropdown>
          <i-button v-on:click="convert()" class="pull-right">
            Convert
          </i-button>
        </Row>
      </div>
      <Row>
        <i-input :value.sync="input" type="textarea" :autosize="{minRows: 10, maxRows: 10}" placeholder="Enter your Chinese characters here"></i-input>
        <hr>
        <div id="output_text_container">
          <p id="output_text">Your converted Chinese characters will appear here</p>
        </div>
      </Row>
    </i-col>
  </div>
</template>

<style scoped>
  .pull-right {
    float: right;
  }
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
    font-size: 1.5em;
  }
  textarea {
    resize: none;
  }
</style>

<script>
  var cnchars = require('chinese-conv');

  module.exports = {
    data: function() {
      return {
        convertFrom: 'tradToSimp',
        input: ''
      }
    },
    methods: {
      convert() {
        var self = this;

        var text = self.input.slice().split('');

        for(var i = 0; i < text.length; i++) {
          /*if(text[i] == '學') {
            text[i] = '学';
          } else {
            if(self.convertFrom == 'simpToTrad') {
              text[i] = cnchars.tify(text[i]);
            } else {
              text[i] = cnchars.sify(text[i]);
            }
          }*/
          if(self.convertFrom == 'simpToTrad') {
            text[i] = cnchars.tify(text[i]);
          } else {
            text[i] = cnchars.sify(text[i]);
          }
        }

        $('#output_text').html(text.join(''));
      }
    }
  }
</script>
