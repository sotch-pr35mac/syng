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
   - User Interface

#### __What's Not__
   - Search Functionality
      - When the database is queried it returns useless results.
        - This might be because of the pre-existing Mongo Database that Tingodb is supposed to read from, it may be possible to perform a "first-run" check when the program opens, and if so, use JQuery's [getJSON](http://api.jquery.com/jQuery.getJSON/) to import the CC-CEDICT dictionary into the tingodb database, and then this function could also be used to perform updates to the dictionary without having to update the whole application. 

## __Built On__
   - [Electron](http://electron.atom.io)
      - Framework for Native Cross-Platform Support
   - [CC-CEDICT](http://www.mdbg.net/chindict/chindict.php?page=cedict)
      - Chinese Dictionary Database
   - [Materialize](http://materializecss.com/)
      - A Material Design for the User Interface
   - Modified Version of [node-cc-cedict](https://github.com/johnheroy/node-cc-cedict) by [John Heroy](http://johnheroy.com/)
      - Node.js framework for CC-CEDICT Dictionary
      - Modified to work with `tingoDb` instead of `sqlite` and support English search functionality
   - [Franc](https://github.com/wooorm/franc)
      - Language Detection for Search

## __Getting Started__
1. First go to the project directory
    `cd /path/to/project`
2. Install the dependencies
    `npm install`
3. Download the database files [here](https://drive.google.com/folderview?id=0B6xRtoBgjYmvTTFWc19QU24tTkk&usp=sharing) and unzip it to `src/node-cc-cedict/db`.
4. Run Syng
    `electron .`

## __Contributors__
- [Preston Stosur-Bassett](http://www.stosur.info)
