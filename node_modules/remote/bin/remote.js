#!/usr/bin/env node
(function() {
    require('coffee-script');
    // Call the main function
    var Remote = require('../libs/remote.coffee');
		new Remote({cli:true});
}).call(this);