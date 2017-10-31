<template>
  <div>
    <component :is="currentView" v-bind:list="list"></component>
  </div>
</template>

<style scoped>
  .pull-right {
    float: right;
  }
  #actions-frame {
    padding-left: 10px;
    padding-right: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
    background-color: #9ea7b4;
    height: 8vh;
  }
</style>

<script>
var Selector = require('./selector.vue');
var Exam = require('./exam.vue');

var databaseManager = new window.DatMan();

module.exports = {
  data: function() {
    return {
      currentView: 'selector',
      list: databaseManager.userListNames
    }
  },
  attached: function() {
    databaseManager.updateListing();
  },
  components: {
    'selector': Selector,
    'exam': Exam
  },
  events: {
    'selectedList': function(examList) {
      var self = this;

      if(examList == 'bookmarks') {
        databaseManager.bookmarks.then(function(bookmarksList) {
          if(bookmarksList.length >= 4) {
            self.list = bookmarksList;
            self.currentView = 'exam';
          } else {
            alert('You must have words at least 4 words in bookmarks to generate test.');
          }
        }, function(err) {
          console.log(examList);
          alert("An unexpected error has occurred. Error = " + err);
          console.log(err);
        });
      } else {
        databaseManager.getUserListContent(examList).then(function(listContent) {
          if(listContent.length >= 4) {
            self.list = listContent;
            self.currentView = 'exam';
          } else {
            alert('Your list ' + examList + ' must have at least 4 words in it to generate a test.');
          }
        }, function(err) {
          console.log(examList);
          alert("An unexpected error has occurred. Error = " + err);
          console.log(err);
        });
      }
    }
  }
}
</script>
