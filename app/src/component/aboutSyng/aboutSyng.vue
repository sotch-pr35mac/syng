<template>
  <div>
    <br>
    <center>
      <img src="../style/img/syng-logo.png" height="115px" width="115px">
      <h2>Syng | 词应</h2>
      <h3>Dictionary App | 词典应用</h3>
      <h4>v0.3.0 (Beta 3)</h4>
    </center>
    <br>
    <p>
      Syng is a free, open source, Chinese-to-English dictionary app that makes it easy to lookup words and phrases quickly, built by Preston Stosur-Bassett.
      To contribute to Syng or submit a bug, the project is hosted publically @ https://github.com/sotch-pr35mac/syng.
      Syng is a stylized spelling of Ciying, the pinyin for 词应, 词应 has been shortened from 词典应用, literally translating to "Dictionary App".
      Syng relies on many libraries and projects. Currently, Syng would not work if not for:
      <ul>
        <li><b>Electron:</b> Framework for Native Cross-Platform Support</li>
        <li><b>CC-CEDICT:</b> Chinese Dictionary Database</li>
        <li><b>Photon:</b> User Interface</li>
        <li><b>node-cc-cedict:</b> Syng uses a heavily modified version of John Heroy's node-cc-cedict project for using Node.js to query the CC-CEDICT database.</li>
        <li><b>Franc:</b> Language Detection for Search</li>
      </ul>
    </p>
  </div>
</template>

<script>
  module.exports = {
    data: function () {
      return {}
    }
  }
</script>

<style scoped>
  div {
    padding-right: 15px;
    padding-left: 15px;
    margin-right: auto;
    margin-left: auto;
  }
</style>
