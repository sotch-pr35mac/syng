<style>
#issue-reporter {
  margin-left: 30px;
  margin-right: 30px;
}
</style>

<template>
  <div id="issue-reporter">
    <center>
      <br>
      <h2>Report Bug</h2>
      <br>
    </center>
    <Alert show-icon>
      Network Connection Required
      <span slot="desc">A network connection is required to submit a bug report.</span>
    </Alert>
    <center>
      <p>
        If you find a bug, please report it so that it can be corrected. You can report the bug to the developer using the button below. Thank you for helping make Syng
        better for everyone!
      </p>
      <br>
      <i-button type='primary' size='large' v-on:click='reportIssue'>Report Bug</i-button>
    </center>
  </div>
</template>

<script>
  var shell = window.require('electron').shell;
  module.exports = {
    data: function() {
      return {}
    },
    methods: {
      reportIssue: function() {
        shell.openExternal('https://gitreports.com/issue/sotch-pr35mac/syng');
      }
    }
  };
</script>
