'use strict';

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
				}
  		}
  	}
  }

  reloadDatabase() {
    var tingo = window.require('tingodb')();
  	this.db = new tingo.Db(this.path.join(__dirname, 'db/syng'), {});
  	this.bookmarksDb = this.db.collection('bookmarks');
  }

  loadUserList(listName) {
    this.userLists[listName] = this.db.collection(listName);
  }

  updateListing() {
    var self = this;

    if(!self.userLists) {
      self.userLists = {};
    }
    if(!window.localStorage.getItem('userLists')) {
      window.localStorage.setItem('userLists', JSON.stringify(new Array(0)));
    }
    else {
      var userListNames = JSON.parse(window.localStorage.getItem('userLists'));

      for(var i = 0; i < userListNames.length; i++) {
        // Check ot make sure the file exists before loading the database
        var fileToCheck = self.path.join(__dirname, 'db/syng/' + userListNames[i]);
        var exists = self.fs.existsSync(fileToCheck);
        if(exists) {
          self.loadUserList(userListNames[i]);
        }
        else {
          console.log('There was an error loading the user data list.');
        }
      }
    }
  }

  get userListNames() {
	   return JSON.parse(window.localStorage.getItem('userLists'));
  }

  get loadedCollections() {
	   return this.db._cols;
  }

  createUserList(listName) {
  	// Check to make sure the file doesn't already exist
  	var fileToCheck = this.path.join(__dirname, 'db/syng/'+listName);

    return new Promise((resolve, reject) => {
      this.fs.exists(fileToCheck, exists => {
    		if(exists) {
          console.log('The file already exists. Cannot create user list.');
          reject(new Error('Cannot create user list because the database file with that name already exists. Please choose a different name.'));
        }
        else {
          // The file does not already exist, go ahead and create it
          this.fs.writeFile(fileToCheck, '', err => {
            if(err) {
              console.log('There was an error writing the new user list to a file.');
              console.log(err);
              reject(new Error('There was an error while creating the new list. Error = '+err));
            }
            else {
              // The list was successfully created, go ahead and add the list name to the list of lists in localStorage
              var userListNames = JSON.parse(window.localStorage.getItem('userLists'));
              userListNames.push(listName);
              window.localStorage.setItem('userLists', JSON.stringify(userListNames));

              // Load the user list into the open collections
              this.loadUserList(listName);

              resolve(true);
            }
          });
        }
    	});
    });
  }

  removeUserList(listName) {
    return new Promise((resolve, reject) => {
      if(this.userLists[listName] != undefined || this.userLists[listName] != null) {
        var listPath = this.path.join(__dirname, 'db/syng/'+listName);

        this.fs.unlink(listPath, err => {
          if(err) {
            console.log('There was an error removing the user list database file.');
            console.log(err);
            reject(new Error('There was an error removing the user list database file. Error = '+err));
          }
          else {
            var userLists = JSON.parse(window.localStorage.getItem('userLists'));

            var unwantedIndex = userLists.indexOf(listName);
            userLists.splice(unwantedIndex, 1);

            window.localStorage.setItem('userLists', JSON.stringify(userLists));
            this.userLists[listName] = null;

            resolve(true);
          }
        });
      }
      else {
        reject(new Error('The user list was not defined in the database manager.'));
      }
    });
  }

  addToUserList(listName, simplified, traditional, pinyin, definitions, toneMarks) {
    return new Promise((resolve, reject) => {
      this.updateListing();
      if(this.userLists[listName] != undefined || this.userLists[listName] != null) {
        var ulObj = {
          simplified: simplified,
          traditional: traditional,
          pronunciation: pinyin,
          definitions: definitions,
          toneMarks: toneMarks,
          notes: ''
        };

        this.userLists[listName].insert(ulObj, (err, res) => {
          if(err || res == undefined || res == null) {
            console.log('There was an error adding word to user list.');
            console.log(err);
            reject(new Error('There was an error adding the word to the custom vocab list. Error = '+err));
          }
          else {
            resolve(true);
          }
        })
      }
      else {
        reject(new Error('The user list is not defined in the database manager.'));
      }
    });
  }

  removeFromUserList(listName, id) {
    return new Promise((resolve, reject) => {
      if(this.userLists[listName] != undefined || this.userLists[listName] != null) {
        this.userLists[listName].remove({ _id: id });
        resolve(true);
      }
      else {
        reject(new Error('The user list was not defined in the database manager.'));
      }
    });
  }

  getUserListContent(listName) {
    this.reloadDatabase();

    return new Promise((resolve, reject) => {
      if(this.userLists[listName] != undefined || this.userLists[listName] != null) {
        this.userLists[listName].find().toArray((err, list) => {
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
  }

  addToBookmarks(simplified, traditional, pinyin, definitions, toneMarks) {
    var dbObj = {
      traditional: traditional,
      simplified: simplified,
      pronunciation: pinyin,
      definitions: definitions,
      toneMarks: toneMarks,
      notes: ''
    };

    return new Promise((resolve, reject) => {
      this.bookmarksDb.insert(dbObj, (err, res) => {
        if(err || res == undefined || res == null) {
          console.log('There was an error while adding the word to bookmarks.');
          console.log(err);
          reject(new Error('There was an error while adding that word to bookmarks. Error = '+err));
        }
        else {
          // Successfully added word to bookmarks
          console.log('Successfully added word to bookmarks.');
          resolve(true);
        }
      });
    });
  }

  removeFromBookmarks(id) {
    this.bookmarksDb.remove({ _id: id });
  }

  get bookmarks() {
    this.reloadDatabase();

    return new Promise((resolve, reject) => {
      this.bookmarksDb.find().toArray((err, bookmarks) => {
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
  }
}
