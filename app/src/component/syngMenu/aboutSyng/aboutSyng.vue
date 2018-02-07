<template>
  <div class="container">
    <br>
    <center>
      <img src="../style/img/syng-logo.png" height="120px" width="120px">
      <h2>Syng | 词应</h2>
      <h3>Dictionary App | 词典应用</h3>
      <h4>v1.1.0</h4>
    </center>
    <br>
    <br>
    <p>
      Syng is a free, open source, Chinese-To-English and English-To-Chinese Dictionary app that makes it easy to lookup words and phrases quickly and effortlessly.
      Syng is a stylized spelling of cíyīng, the Pinyin for 词应. 词应 has been shorted from 词典应用, literally translating to Dictionary App.
      Syng is pubically hosted at https://github.com/sotch-pr35mac/syng and is welcome to community contribution.
    </p>
    <br>
    <p>
      Syng relies on many libraries and projects. Currently, Syng would not exist if not for:
      <ul>
        <li><b>Electron:</b> Framework for Native Cross-Platform Support</li>
        <li><b>CC-CEDICT:</b> Chinese Dictionary Database</li>
        <li><b>Vue.js:</b> Framework for Building Interfaces</li>
        <li><b>IView UI:</b> User Interface Framework</li>
        <li><b>node-cc-cedict:</b> Syng uses a heavily modified version of John Heroy's node-cc-cedict project for using Node.js to query the CC-CEDICT database.</li>
        <li><b>Franc:</b> Language Detection for Search</li>
        <li><b>hanzi-writer:</b> Stroke Order Animations</li>
      </ul>
    </p>
    <br>
    <div id="footer">
      <center>
        <h4>built with Love from All Around the World by Preston Wang-Stosur-Bassett</h4>
      </center>
    </div>
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
  .container {
    padding-right: 15px;
    padding-left: 15px;
    margin-right: auto;
    margin-left: auto;
  }
  p {
    font-size: 2.3vh;
  }
  li {
    font-size: 2.3vh
  }
  h2 {
    font-size: 3.5vh;
  }
  h3 {
    font-size: 2.5vh;
  }
  h4 {
    font-size: 2.1vh;
  }
  #footer {
    position: absolute;
    bottom: 10px;
    text-align: center;
    left: 18%;
  }
</style>
