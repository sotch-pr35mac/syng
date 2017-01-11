/*
  TODO: This entire page needs to be refactored to be in a better order, include more comments, and use Promises were necessary
*/

'use strict';

const dialog = window.require('electron').remote.dialog;

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
  	if(!window.localStorage.getItem('userLists')) {
  		window.localStorage.setItem('userLists', JSON.stringify(new Array(0)));
  	}
  	else {
  		var userListNames = JSON.parse(window.localStorage.getItem('userLists'));

  		for(var i = 0; i < userListNames.length; i++) {
  			// Check to make sure the file exists before loading the database
  			var fileToCheck = self.path.join(__dirname, 'db/syng/'+userListNames[i]);
  			var exists = self.fs.existsSync(fileToCheck);
				if(exists) {
          self.loadUserList(userListNames[i]);
				}
				else {
          console.log('There was an error loading the user data lists.');
					console.log(err);
				}
  		}
  	}
  }

  loadUserList(listName) {
    this.userLists[listName] = this.db.collection(listName);
  }

  get userListNames() {
	   return JSON.parse(window.localStorage.getItem('userLists'));
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
        return false;
      }
      else {
        // The file does not already exist, go ahead and create it
        self.fs.writeFile(fileToCheck, '', function(err) {
          if(err) {
            console.log('There was an error writing the new user list to a file.');
            console.log(err);
            dialog.showErrorBox('Cannot Create List', 'There was an error while creating the new list. Error = '+err);
            return false;
          }
          else {
            // The list was successfully created, go ahead and add the list name to the list of lists in localStorage
            var userListNames = JSON.parse(window.localStorage.getItem('userLists'));
            userListNames.push(listName);
            window.localStorage.setItem('userLists', JSON.stringify(userListNames));

            // Load the user list into the open collections
            self.loadUserList(listName);

            return true;
          }
        });
      }
  	});
  }

  getUserListContent(listName) {
    var self = this;

    var listContent = new Promise(function(resolve, reject) {
      if(self.userLists[listName] != undefined || self.userLists[listName] != null) {
        self.userLists[listName].find().toArray(function(err, list) {
          if(err || list == undefined || list == null) {
            console.log('There was an error getting the custom user list.');
            console.log(err);
            reject(new Error(err));
          }
          else {
            resolve(list);
          }
        });
      }
      else {
        reject(new Error('There was an unexpected error while getting the custom vocab list.'));
      }
    });

    return listContent;
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
        return false;
      }
      else {
        // Successfully added word to bookmarks
        console.log('Successfully added word to bookmarks.');
        return true;
      }
    });
  }

  removeFromBookmarks(id) {
    var self = this;

    self.bookmarksDb.remove({ _id: id });
    return true;
  }

  get bookmarks() {
    var self = this;

    var bookmarksContent = new Promise(function(resolve, reject) {
      self.bookmarksDb.find().toArray(function(err, bookmarks) {
        if(err || bookmarks == undefined || bookmarks == null) {
          console.log('There was an error getting bookmarks.');
          console.log(err);
          reject(new Error(err));
        }
        else {
          resolve(bookmarks);
        }
      });
    });

    return bookmarksContent;
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
          return false;
        }
        else {
          return true;
        }
      })
    }
    else {
      return false;
    }
  }

  removeFromUserList(listName, id) {
    var self = this;

    if(self.userLists[listName] != undefined || self.userLists[listName] != null) {
      self.userLists[listName].remove({ _id: id });
      return true;
    }
    else {
      return false;
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
          return false;
        }
        else {
          var userLists = JSON.parse(window.localStorage.getItem('userLists'));

          var unwantedIndex = userLists.indexOf(listName);
          userLists.splice(unwantedIndex, 1);

          window.localStorage.setItem('userLists', JSON.stringify(userLists));
          self.userLists[listName] = null;

          return true;
        }
      });
    }
    else {
      return false;
    }
  }

  updateListing() {
    // TODO: Write this
    console.log('updateListing runs!');
  }
}
