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
var Card = require('./card.vue');

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
    'card': Card
  },
  events: {
    'selectedList': function(cardList) {
      var self = this;

      if(cardList == 'bookmarks') {
        databaseManager.bookmarks.then(function(bookmarksList) {
          if(bookmarksList.length > 0) {
            self.list = bookmarksList;
            self.currentView = 'card';
          } else {
            alert("you have too little bookmarks");
          }
        }, function(err) {
          // TODO: Handle this error
          console.log(err);
        });
      } else {
        console.log('attempting to get user list: ' + cardList);
        databaseManager.getUserListContent(cardList).then(function(listContent) {
          if(listContent.length > 0) {
            self.list = listContent;
            self.currentView = 'card';
          } else {
            alert('this list has too little elements');
          }
        }, function(err) {
          // TODO: Handle this error
          console.log(err);
        });
      }
    }
  },
  methods: {}
}
</script>
