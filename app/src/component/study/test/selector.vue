<template>
  <div>
    <center>
      <div class="selector-menu">
        <h2>Select a list to generate test from: </h2>
        <br>
        <i-select :model.sync="examList" style="width: 300px;">
          <i-option value="bookmarks" v-on:click="madeSelection = true">Bookmarks</i-option>
          <i-option v-for="item in list" v-if="item != 'bookmarks'" :value="item" v-on:click="madeSelection = true">{{ item }}</i-option>
        </i-select>
        <br>
        <i-button type="primary" shape="circle" v-on:click="select()" v-if="madeSelection" class="select-button">Generate Test</i-button>
      </div>
    </center>
  </div>
</template>

<style>
  .selector-menu {
    position: absolute;;
    top: 40vh;
    left: 40vh;
  }
  .select-button {
    margin-top: 20px;
  }
</style>

<script>
module.exports = {
  props: [ 'list' ],
  data: function() {
    return {
      examList: null,
      madeSelection: false
    }
  },
  methods: {
    select() {
      var self = this;

      self.$dispatch('selectedList', self.examList);
    }
  }
}
</script>
