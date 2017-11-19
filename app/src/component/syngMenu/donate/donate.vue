<template>
  <div id="donate">
    <center>
      <br>
      <h2>Donate</h2>
      <br>
    </center>
    <Alert show-icon>
      Network Connection Required
      <span slot="desc">A network connection is required to make a donation.</span>
    </Alert>
    <center>
      <p>
        Show your support for Syng by making a donation! Syng is not backed by a
        company, does not sell your information, and does not give you ads, help keep
        Syng free by donating. Don't have money to donate? Consider contributing to
        the project on our <a href="#" v-on:click="openGithub()">Github page</a>!
      </p>
      <br>
      <i-button type="primary" size="large" v-on:click="makeDonation();">Donate</i-button>
    </center>
  </div>
</template>

<style>
  #donate {
    margin-left: 30px;
    margin-right: 30px;
  }
</style>

<script>
  var shell = window.require('electron').shell;

  module.exports = {
    data: function() {
      return {};
    },
    methods: {
      makeDonation: function() {
        shell.openExternal('http://ko-fi.com/A501IQQ');
      },
      openGithub: function() {
        shell.openExternal('https://github.com/sotch-pr35mac/syng');
      }
    }
  };
</script>
