# __词应__ (Syng)
#### 词典应用 (Dictionary App)

---

## __About__
Syng is a free, open source, Chinese-To-English and English-To-Chinese Dictionary app that makes it easy to lookup words and phrases quickly. This service will be made for desktop operating systems, and there are no plans to build something for mobile platforms. _For a good mobile platform alternative the app [Pleco](https://www.pleco.com/) is an excellent option._

### Name
Syng is a stylized spelling of CiYing, the PinYin for 词应. 词应 has been shorted from 词典应用, literally translating to Dictionary App.

## __Features__
- ___Search___
    - Syng will allow you to search by PinYin, English, and Chinese characters (both traditional and simplified)
- ___Save___
    - Syng will allow you to save words and searches to your _"Bookmarks"_, so that you can reference them later.
- ___Study___
    - Syng will let you study Chinese by creating flash cards out of your saved words and searches.
    - Syng will also test you on your knowledge and progress of your Chinese to measure your language development.
- Offline Support
- Cross-Platform
   - Mac OS X
   - Windows
   - Linux

## __Development Status__
#### __What's Working__
   - Electron App Runs
   - User Interface (Very Basic)

#### __What's Not__
   - Search Functionality
      - Right now, the search functionality depends on the `node-cc-cedict` package which relies on `sqlite3`. But for some reason `sqlite3` does not work on Electron.
      - The possible fix for this is to migrate `node-cc-cedict` sqlite database to [tingoDB](http://www.tingodb.com/) and then rewrite `node-cc-cedict` to work with tingoDB which is based off of mongoDB (so NoSQL) and then finish writing the `SearchByEnglish` function and implement it. That way we can use this method and this database, but avoid the incompatible sqlite package.

## __Built On__
   - [Electron](http://electron.atom.io)
      - Framework for Native Cross-Platform Support
   - [CC-CEDICT](http://www.mdbg.net/chindict/chindict.php?page=cedict)
      - Chinese Dictionary Database
   - [Materialize](http://materializecss.com/)
      - A Material Design for the User Interface
   - Modified Version of [node-cc-cedict](https://github.com/johnheroy/node-cc-cedict) by [John Heroy](http://johnheroy.com/)
      - Node.js framework for CC-CEDICT Dictionary
      - An alternative to this might be: [cc-cedict-php2json](https://github.com/pffy/php-cedict2json)

## __Contributors__
- [Preston Stosur-Bassett](http://www.stosur.info)
