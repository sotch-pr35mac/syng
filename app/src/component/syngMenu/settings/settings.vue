<template>
  <div id="settings-panel">
    <center>
      <h1>Settings</h1>
    </center>
    <br>
	<span class="setting-panel-list">
		<!--
		<language></language>
		-->
		<pinyin-color></pinyin-color>
	</span>
  </div>
</template>

<style>
#settings-panel {
  padding: 25px;
}
</style>

<script>
var Language = require('./language/language.vue');
var PinyinColor = require('./pinyinColor/pinyinColor.vue');

  module.exports = {
    data: function() {
	return {}
    },
    components: {
      language: Language,
	pinyinColor: PinyinColor
    }
  };
</script>
