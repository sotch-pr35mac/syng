'use strict';

const dialog = window.require('electron').remote.dialog;
var _ = window.require('underscore');

// Make sure localStorage can handle objects and arrays
Storage.prototype.setObj = function(key, obj) {
  return this.setObj(key, JSON.stringify(obj));
}

Storage.prototype.getObj = function(key) {
  return JSON.parse(this.getObj(key));
}

module.exports = class databaseManager {
  constructor() {
  	// Load database
  	var self = this;

  	self.path = window.require('path');
  	var tingo = window.require('tingodb')();
  	self.db = new tingo.Db(self.path.join(__dirname, 'db/syng'), {});
  	self.bookmarksDb = self.db.collection('bookmarks');
  	self.fs = window.require('fs');

  	// Load the localStorage to see if there are any user created lists that need to be loaded
  	if(!self.userLists) {
  		self.userLists = {};
  	}
  	if(!window.localStorage.getObj('userLists')) {
  		window.localStorage.setObj('userLists', new Array(0));
  	}
  	else {
  		var userListNames = window.localStorage.getObj('userLists');

  		for(var i = 0; i < userListNames.length; i++) {
  			// Check to make sure the file exists before loading the database
  			var fileToCheck = self.path.join(__dirname, 'db/syng/'+userListNames[i]);
  			self.fs.exists(fileToCheck, function(err) {
  				if(err) {
  					console.log('There was an error loading the user data lists.');
  					console.log(err);
  				}
  				else {
            console.log('this runs');
  					// self.userLists[userListNames[i]] = self.db.collection(userListNames[i]);
            self.loadUserList(userListNames[i]);
  				}
  			});
  		}
  	}
  }

  loadUserList(listName) {
    this.userLists[listName] = this.db.collection(listName);
  }

  get userListNames() {
	   return window.localStorage.getObj('userLists');
  }

  get loadedCollections() {
	   return this.db._cols;
  }

  createUserList(listName) {
  	var self = this;
  	// Check to make sure the file doesn't already exist
  	var fileToCheck = self.path.join(__dirname, 'db/syng/'+listName);

  	self.fs.exists(fileToCheck, function(exists) {
  		if(exists) {
        console.log('The file already exists. Cannot create user list.');
        dialog.showErrorBox('Cannot Create List', 'Cannot create user list because the database file with that name already exists. Please choose a different name.');
        return -1;
      }
      else {
        // The file does not already exist, go ahead and create it
        self.fs.writeFile(fileToCheck, '', function(err) {
          if(err) {
            console.log('There was an error writing the new user list to a file.');
            console.log(err);
            dialog.showErrorBox('Cannot Create List', 'There was an error while creating the new list. Error = '+err);
            return -1;
          }
          else {
            // The list was successfully created, go ahead and add the list name to the list of lists in localStorage
            var userListNames = window.localStorage.getObj('userLists');
            userListNames.push(listName);
            window.localStorage.setObj('userLists', userListNames);

            // Load the user list into the open collections
            self.loadUserList(listName);

            return 1;
          }
        });
      }
  	});
  }

  getUserListContent(listName) {
    var self = this;

    if(self.userLists[listName] == undefined || self.userLists[listName] == null) {
      self.userLists[listName].find().toArray(function(err, list) {
        if(err || list == undefined || list == null) {
          console.log('There was an error getting the custom user list.');
          console.log(err);
          dialog.showErrorBox('Error Getting Custom Vocab List', 'There was an error while getting the custom vocab list. Error = '+err);
          return -1;
        }
        else {
          return list;
        }
      });
    }
    else {
      return -1;
    }
  }

  addToBookmarks(simplified, traditional, pinyin, definitions, toneMarks) {
    var self = this;

    var dbObj = {
      traditional: traditional,
      simplified: simplified,
      pronunciation: pinyin,
      definitions: definitions,
      toneMarks: toneMarks,
      notes: ''
    };

    self.bookmarksDb.insert(dbObj, function(err, res) {
      if(err || res == undefined || res == null) {
        console.log('There was an error while adding the word to bookmarks.');
        console.log(err);
        dialog.showErrorBox('Cannot Add Word to Bookmarks', 'There was an error while adding that word to bookmarks. Error = '+err);
        return -1;
      }
      else {
        // Successfully added word to bookmarks
        console.log('Successfully added word to bookmarks.');
        return 1;
      }
    });
  }

  removeFromBookmarks(id) {
    var self = this;

    self.bookmarksDb.remove({ _id: id });
    return 1;
  }

  get bookmarks() {
    bookmarksDb.find().toArray(function(err, bookmarks) {
      if(err || bookmarks == undefined || bookmarks == null) {
        console.log('There was an error getting bookmarks.');
        console.log(err);
        dialog.showErrorBox('Cannot Load Bookmarks', 'There was an error while loading the bookmarks. Error = '+err);
        return -1;
      }
      else {
        return bookmarks;
      }
    });
  }

  addToUserList(listName, simplified, traditional, pinyin, definitions, toneMarks) {
    var self = this;

    if(self.userLists[listName] != undefined || self.userLIsts[listName] != null) {
      var ulObj = {
        simplified: simplified,
        traditional: traditional,
        pronunciation: pinyin,
        definitions: definitions,
        toneMarks: toneMarks,
        notes: ''
      };

      self.userLists[listName].insert(ulObj, function(err, res) {
        if(err || res == undefined || res == null) {
          console.log('There was an error adding word to user list.');
          console.log(err);
          dialog.showErrorBox('Error Adding Word to Vocab List', 'There was an error adding the word to the custom vocab list. Error = '+err);
          return -1;
        }
        else {
          return 1;
        }
      })
    }
    else {
      return -1;
    }
  }

  removeFromUserList(listName, id) {
    var self = this;

    if(self.userLists[listName] != undefined || self.userLists[listName] != null) {
      self.userLists[listName].remove({ _id: id });
      return 1;
    }
    else {
      return -1;
    }
  }

  removeUserList(listName) {
    var self = this;

    if(self.userLists[listName] != undefined || self.userLists[listName] != null) {
      var listPath = self.path.join(__dirname, 'db/syng/'+listName);

      self.fs.unlink(listPath, function(err) {
        if(err) {
          console.log('There was an error removing the user list database file.');
          console.log(err);
          dialog.showErrorBox('Error Removing Vocab List', 'There was an error removing the custom vocab list. Error = '+err);
          return -1;
        }
        else {
          var userLists = window.localStorage.getObj('userLists');

          var unwantedIndex = userLists.indexOf(listName);
          userLists = userLists.splice(unwantedIndex, 1);

          window.localStorage.setObj('userLists', userLists);

          return 1;
        }
      });
    }
    else {
      return -1;
    }
  }

  updateListing() {
    // TODO: Write this
    console.log('updateListing runs!');
  }
}
