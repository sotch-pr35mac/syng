<template>
  <i-col span="21">
    <div id="search-frame">
      <Row>
        <Tooltip placement='right' content='The intended language of latin input.'>
          <i-button>EN</i-button>
        </Tooltip>
        &nbsp;
        <i-input placeholder="Search in Chinese/English/Pinyin" style="width: 85%"></i-input>
        &nbsp;
        <i-button>Search</i-button>
      </Row>
    </div>
    <Row id='search-result-and-content'>
      <i-col span="5">
        <!-- <div class="search-listing"></div> -->
      </i-col>
      <i-col span="19">
      </i-col>
    </Row>
  </i-col>
</template>

<style>
  #search-result-and-content {
    height: calc(100vh - 40px);
  }
  #search-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
  }
  .search-listing {
    height: calc(100vh - 40px);
    overflow-y: scroll;
    background-color: #f5f5f4;
  }
</style>

<script>
module.exports = {
  data: function() {
    return {
      value: ''
    }
  }
}
</script>
