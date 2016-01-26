# __词应__ (CiYing)
#### 词典应用 (Dictionary App)

---

## __About__
CiYing is a free, open source, Chinese-To-English and English-To-Chinese Dictionary app that makes it easy to lookup words and phrases quickly. This service will be made for desktop operating systems, and there are no plans to build something for mobile platforms. _For a good mobile platform alternative the app [Pleco](https://www.pleco.com/) is an excellent option._ 

## __Features__
- ___Search___
    - CiYing will allow you to search by PinYin, English, and Chinese characters (both traditional and simplified)
- ___Save___
    - CiYing will allow you to save words and searches to your _"Bookmarks"_, so that you can reference them later.
- ___Study___
    - CiYing will let you study Chinese by creating flash cards out of your saved words and searches. 
    - CiYing will also test you on your knowledge and progress of your Chinese to measure your language development.
- Other Features
    - Offline Support

## __Platforms__
_For more information on supported platforms please refer to the Initial Development Section._
- Gnome Ubuntu?
- Cross Platform?

## __Initial Development__
- Possibly use [Electron](http://electron.atom.io) to build a cross-platform native app on Node.js and Webkit.
    - This seems like it would be the best solution, given that it will allow for a much, much, much easier and faster development process. 
    - The only cavieat to using this option is that it would make the design of the app difficult, because you don't get the same beautiful system elements and follow the same design that Gnome and GTK3+ use. 
    - This would also allow us to run the app on multiple platforms and systems, and not just on Linux. 
- Possibly build a native Gnome App to run on Linux.
    - This would take a while, require a lot of testing, and be rather difficult.
    - It would look and run beautifully.

## __Database Options__
- [CC-CEDICT](http://www.mdbg.net/chindict/chindict.php?page=cedict)
    - This is probably the best option for a translation database. It is used by several other production apps ([MDBG for Mac](http://www.mdbg.net/chindict/chindict.php?page=chinese_dictionary_mac_osx), [Pleco](http://www.pleco.com0) for mobile platforms). 
    - It is available for use under the [Creative Commons Attribution Share Alike 3.0 License](http://creativecommons.org/licenses/by-sa/3.0/)
        - "It more or less means that you are allowed to use this data for both non-commercial and commercial purposes provided that you: mention where you got the data from (attribution) and that in case you improve / add to the data you will share these changes under the same license (share alike)."

## __Contributors__
- Preston Stosur-Bassett (Project Maintainer)
    - [Email](mailto://preston@stosur.info)
    - [Website](http://www.stosur.info/)


