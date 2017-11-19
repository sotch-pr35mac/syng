var IView = require('iview');

Vue.use(IView);

var SyngMenu = require('./component/syngMenu/syngMenu.vue');
var Search = require('./component/search/search.vue');
var Yuedu = require('./component/yuedu/yuedu.vue');
var Bookmarks = require('./component/bookmarks/bookmarks.vue');
var Study = require('./component/study/study.vue');
var Tools = require('./component/tools/tools.vue');

var syng = new Vue({
  el: "#app",
  components: {
    syngMenu: SyngMenu,
    search: Search,
    yuedu: Yuedu,
    bookmarks: Bookmarks,
    study: Study,
    tools: Tools
  },
  data: {
    currentView: 'search'
  },
  methods: {
    loadView: function(viewName) {
      this.currentView = viewName;
    }
  }
});
