<template>
  <div>
    <i-col span="26">
      <div id="actions-frame">
        <Row>
          <i-button v-on:click="translate()" class="pull-right" id="main-action-button">
            Translate
          </i-button>
          <Dropdown trigger="click" placement="bottom-start" class="pull-right">
            <i-button>
              <a style="color: #657180;" v-if="(translateFrom == 'chiToEng')">Chinese <b>&rarr;</b> English</a>
              <a style="color: #657180;" v-if="(translateFrom == 'engToChi')">English <b>&rarr;</b> Chinese</a>
              &nbsp;
              <Icon type="arrow-down-b" size="large"></Icon>
            </i-button>
            <Dropdown-menu slot="list">
              <Dropdown-item v-on:click="translateFrom = 'chiToEng'">Chinese <b>&rarr;</b> English</Dropdown-item>
              <Dropdown-item v-on:click="translateFrom = 'engToChi'">English <b>&rarr;</b> Chinese</Dropdown-item>
            </Dropdown-menu>
          </Dropdown>
          <h1 class="title">Baidu Translate</h1>
        </Row>
      </div>
      <Row>
        <i-input :value.sync="input" type="textarea" :autosize="{minRows: 10, maxRows: 10}" placeholder="Enter text to be translated here (requires network connection)"></i-input>
        <hr>
        <div id="output_text_container">
          <p id="output_text">Translation appears here</p>
        </div>
      </Row>
    </i-col>
  </div>
</template>

<style scoped>
  .title {
    text-align: center;
    margin-left: 25%;
    color: #fff;
  }
  #main-action-button {
    margin-left: 10px;
  }
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
  // var baiduTranslate = require('node-baidu-translate');

  module.exports = {
    data: function() {
      return {
        translateFrom: 'chiToEng',
        input: ''
      }
    },
    methods: {
      translate() {
        var self = this;

        // Get the input text to be translated
        var text = self.input;

        // Get the language translation preference
        var sourceLang = 'chiToEng' ? 'zh' : 'en';
        var destLang = 'chiToEng' ? 'en' : 'zh';

        // TODO: Make the actual calls to translation here

        var output = 'This is some translated text';
        $('#output_text').html(output);
      }
    }
  }
</script>
