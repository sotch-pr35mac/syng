var AboutSyng = require('./component/aboutSyng/aboutSyng.vue');
var MainMenu = require('./component/common/mainMenu/mainMenu.vue');
var SyngMenu = requuire('./component/syngMenu/syngMenu.vue');

var testVue = new Vue({
  el: "#test",
  components: {
    aboutSyng: AboutSyng,
    mainMenu: MainMenu,
    syngMenu: SyngMenu
  },
  data: {}
});
