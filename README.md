# __Syng | 词应__
##### Dictionary App | 词典应用
##### v1.0.0
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

---

## __About__
Syng is a free, open source, Chinese-To-English and English-To-Chinese Dictionary app that makes it easy to lookup words and phrases quickly. Currently Syng works on macOS, Windows, and Linux systems. 

### Name
Syng is a stylized spelling of Ciying, the Pinyin for 词应. 词应 has been shorted from 词典应用, literally translating to Dictionary App.

## __Features__
- ___Search___
    - Syng allows you to search by Pinyin, English, and Chinese characters (both traditional and simplified)
- ___Save___
    - Syng allows you to save words and searches to your _"Bookmarks"_, so that you can reference them later.
- ___Study___
    - Syng lets you study Chinese by creating flash cards out of your saved words and searches.
    - Syng also tests you on your knowledge and progress of your Chinese to measure your language development.
- Offline Support
- Cross-Platform
    - Mac OS X
    - Windows
    - Linux
- Prettify Pinyin: Convert pinyin with tone numbers with tone marks
- Convert Characters: Convert between traditional and simplified characters

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
This is a [Commitizen Friendly](https://github.com/commitizen/cz-cli) Repository. When contributing please use commitizen when committing changes.
You can install commitizen using npm:
```
npm install -g commitizen
```
1. Fork it!
2. Create a branch `git checkout -b my-feature`
3. Commit your changes `git cz`
4. Submit a pull request

## __Getting Started__
1. First go to the project directory
    `cd /path/to/project/`
2. Install the dependencies
    `npm install`
3. Run Syng
    `npm start`

## __Contributors__
- [Preston Stosur-Bassett](http://www.stosur.info)

## __License__
This software is licensed under the [Creative Commons Attribution-Share Alike 3.0 License](http://creativecommons.org/licenses/by-sa/3.0/).
