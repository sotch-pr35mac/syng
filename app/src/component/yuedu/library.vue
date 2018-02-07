<template>
  <div>
    <i-col span="21">
      <div id="actions-frame">
        <Row>
          <i-button v-on:click="addToLibrary()" id="addToLibraryButton" class="pull-right">Add to Library</i-button>
        </Row>
      </div>
        <div v-if="libraryItems < 1" class="notice">
            <h1>No Items in Library</h1>
        </div>
        <div v-if="libraryItems > 0">
            <!-- Put the list here -->
        </div>
    </i-col>
  </div>
</template>

<style>
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
  .pull-right {
    float: right;
  }
  .notice {
      top: 20vh;
      left: 60vh;
      position: absolute;
  }
</style>

<script>
module.exports = {
  props: [],
  data: function() {
    return {
        libraryItems: 0
    }
  },
  components: {
  },
  methods: {
    
  }
}
</script>
