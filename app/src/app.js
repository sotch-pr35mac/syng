var AboutSyng = require('./component/aboutSyng/aboutSyng.vue');
var MainMenu = require('./component/common/mainMenu/mainMenu.vue');
var SyngMenu = require('./component/syngMenu/syngMenu.vue');
var ReportBug = require('./component/reportBut/reportBug.vue');
var Settings = require('./component/settings/settings.vue');
var ViewLicense = require('./component/viewLicense/viewLicense.vue');

var testVue = new Vue({
  el: "#test",
  components: {
    aboutSyng: AboutSyng,
    mainMenu: MainMenu,
    syngMenu: SyngMenu,
    reportBug: ReportBug,
    settings: Settings,
    viewLicense: ViewLicense
  },
  data: {}
});
