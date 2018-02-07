<template>
  <div>
    <Row>
      <i-col span="16">
        <h2 class="item-label">Interface Language</h2>
      </i-col>
      <i-col span="8">
        <i-select :model.sync="language" placeholder="Language Preference" :on-change="">
          <i-option value="en">English</i-option>
          <i-option value="cn" :on-click="changeLanguage()">中文</i-option>
        </i-select>
      </i-col>
    </Row>
  </div>
</template>

<style>
.item-label {
  font-size: 1.5em;
  font-weight: normal;
}
</style>

<script>
module.exports = {
  data: function() {
    return {
      language: ''
    }
  },
  attached: function() {
  },
  methods: {
    changeLanguage: function() {
    }
  }
}
</script>
