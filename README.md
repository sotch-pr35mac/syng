# __Syng | 词应__
##### Dictionary App | 词典应用
##### v0.1.2 (beta)

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
   - Search (for Characters, Pinyin, and English)
   - Saving searches to Bookmarks
   - Studying Flashcards

#### __What's Not__
   - Generating tests have not been built yet

## __Built On__
   - [Electron](http://electron.atom.io)
      - Framework for Native Cross-Platform Support
   - [CC-CEDICT](http://www.mdbg.net/chindict/chindict.php?page=cedict)
      - Chinese Dictionary Database
      - The file has been modified to JSON
   - [Photon](http://photonkit.com/)
      - User Interface
   - Heavily modified version of [node-cc-cedict](https://github.com/johnheroy/node-cc-cedict) by [John Heroy](http://johnheroy.com/)
      - Node.js framework for CC-CEDICT Dictionary
      - Modified to work using hashtables and support English search functionality.
   - [Franc](https://github.com/wooorm/franc)
      - Language Detection for Search

## __Contribute__
1. Fork it!
2. Create a branch `git checkout my-feature`
3. Commit your changes
4. Submit a pull request

## __Getting Started__
1. First go to the project directory
    `cd /path/to/project`
2. Install the dependencies
    `npm install`
3. Run Syng
    `electron .`

## __Contributors__
- [Preston Stosur-Bassett](http://www.stosur.info)

## __License__
This software is licensed under the [Creative Commons Attribution-Share Alike 3.0 License](http://creativecommons.org/licenses/by-sa/3.0/).
