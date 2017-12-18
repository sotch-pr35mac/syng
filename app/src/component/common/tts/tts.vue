<template>
  <i-button v-on:click="speak()" v-if="networkStatus">
    <Tooltip placement="left" content="Say Word (Requires Network Connection)">
      <Icon type="volume-high" size="large"></Icon>
    </Tooltip>
  </i-button>
</template>

<style scoped>
</style>

<script>
var ttsmanager = new window.TTSManager([window.BaiduSpeaker]);

module.exports = {
  props: [ 'chars' ],
  data: function() {
    return {
      networkStatus: navigator.onLine
    }
  },
  methods: {
    speak: function() {
      var self = this;

      if(navigator.onLine) {
        ttsmanager.speak(self.chars);
      } else {
        self.networkStatus = false;
        self.$Message.error("Not connected to the internet! A netork connection is required to speak the word aloud.");
      }
    }
  }
}
</script>
