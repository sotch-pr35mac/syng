# node-cc-cedict [![Build Status](https://travis-ci.org/johnheroy/node-cc-cedict.svg)](https://travis-ci.org/johnheroy/node-cc-cedict)

node-cc-cedict provides a convenient asynchronous JavaScript API for the popular [CC-CEDICT](http://cc-cedict.org/) Chinese-English dictionary. This is a 'batteries-included' library and comes with a premade SQLite conversion of the entire dictionary.

Single search method defaults to traditional if the entire word provided is in traditional characters, otherwise converts everything to simplified and performs that lookup instead.

## Usage

```
var cedict = require('node-cc-cedict');

cedict.searchByChinese('世界', function(words){
  console.log(words);
});

```

## License

MIT