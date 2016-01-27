// I used this script to generate ../db/cc-cedict.sqlite
// CC-CEDICT version as of October 6, 2014
// see ../src/cc-cedict.txt for more details

var Sequelize = require('sequelize');
var sqlite = require('sqlite3');
var fs = require('fs');

// defined db config
var sequelize = new Sequelize(null, null, null, {
  dialect: 'sqlite',
  storage: '../db/cc-cedict.sqlite'
});

// create a sqlite database with every entry 
var Word = sequelize.define('Word', {
  traditional: Sequelize.STRING,
  simplified: Sequelize.STRING,
  pronunciation: Sequelize.STRING,
  definitions: Sequelize.STRING
});

// sync up the schema
sequelize
  .sync({ force: true })
  .complete(function(err) {
     if (!!err) {
       console.log('An error occurred while creating the table:', err);
     } else {
       console.log('It worked!');
     }
  });

fs.readFile('../src/cc-cedict.txt', 'UTF-8', function(err, data){
  
  console.log('dictionary loaded, now executing parser');
  var lines = data.toString().split('\n');
  var i = 0;

  var addNextRow = function(){

    var line = lines[i];

    // not a comment
    if (line[0] !== '#'){
      var spaceSplit = line.split(' ');
      var traditional = spaceSplit[0];
      var simplified = spaceSplit[1];

      var regex = /\[(.*?)\]/;
      var pronunciation = line.match(regex)[0];

      var slashSplit = line.split('/');
      var defs = slashSplit.slice(1, slashSplit.length - 1).join('; ');

      console.log(pronunciation);

      var word = Word.create({
        traditional: traditional,
        simplified: simplified,
        pronunciation: pronunciation,
        definitions: defs
      });
    }

    setTimeout(function(){
      if (i < lines.length){
        i += 1;
        addNextRow();
      } else {
        return;
      }
    }, 50);
  };
  addNextRow();
});

