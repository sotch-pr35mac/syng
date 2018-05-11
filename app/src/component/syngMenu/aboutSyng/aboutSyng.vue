<template>
  <div class="container">
    <br>
    <center>
      <img src="../style/img/syng-logo.png" height="120px" width="120px">
      <h2>Syng | 词应</h2>
      <h3>Dictionary App | 词典应用</h3>
      <h4>v1.1.1</h4>
    </center>
    <br>
    <br>
    <center>
      <Button-group size="large">
        <i-button type="primary" v-if="viewingAbout">About</i-button>
        <i-button v-on:click="switchView()" v-if="!viewingAbout">About</i-button>
        <i-button v-on:click="switchView()" v-if="viewingAbout">Acknowledgments</i-button>
        <i-button type="primary" v-if="!viewingAbout">Acknowledgments</i-button>
      </Button-group>
    </center>
    <div v-if="viewingAbout" class="about-dialog">
      <div class="about-dialog-content">
        <p>
          Syng was created to be a simple, yet full featured Chinese language study tool. Syng is free, cross platform, and open source, so that no matter how much money you have, or what computer you use, you can enjoy all of its features.
        </p>
        <br>
        <p>
          The name Syng comes from the stylized spelling of cíyīng, the pinyin for 词应. 词应 is short for 词典应用, literally translating to Dictionary App.
        </p>
        <br>
        <p>
          Syng is actively being developed, and contributors are welcome. For more information visit syngdict.com.
        </p>
      </div>
    </div>
    <div v-if="!viewingAbout" class="about-dialog">
      <div class="about-dialog-content">
        <center>
          <p><b>Created by Preston Wang-Stosur-Bassett</b></p>
        </center>
        <br>
        <center>
          <p>
            Syng relies on many libraries and projects. Currently Syng would not exist without:
          </p>
        </center>
        <br>
        <p><b>CC-CEDICT:</b> Chinese Dictionary Database</p>
        <p><b>node-cc-cedict:</b> Syng uses a heavily modified version of John Heroy's node-cc-cedict project for using Node.js to query the CC-CEDICT database.</p>
        <p><b>Franc:</b> Language Detection for Search</p>
        <p><b>hanzi-writer:</b> Stroke Order Animations</p>
      </div>
    </div>
  </div>
</template>

<script>
  module.exports = {
    data: function () {
      return {
        viewingAbout: true
      }
    },
    methods: {
      switchView: function() {
        if(this.viewingAbout) {
          this.viewingAbout = false;
        } else {
          this.viewingAbout = true;
        }
      }
    }
  }
</script>

<style scoped>
  .about-dialog-content {
    margin-left: 50px;
    margin-right: 50px;
  }
  .about-dialog {
    margin-top: 35px;
  }
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
</style>
