# Change Log
All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org/).

## [x.x.x] - xxxx-xx-xx
### Added
- Added very basic pinyin detection for search as described in #26
- Added HSK Labels as described in Issue #98
- Added List Filtering in Bookmarks Section as described in Issue #30

### Changed
- Decreased load time to bottleneck as described in Issue #99
- Visual enhancements including Issue #100
- Updated CC-CEDICT database to most recent release (May 11 2018)

## [1.1.1] - 2018-02-10
### Fixed
- Fixed traditional character stroke order error as described in Issue #95

## [1.1.0] - 2018-02-07
### Added
- Text to Speech support as described in Issue #67
- Character Stroke Animations as described in Issue #90

### Fixed
- Duplicates in search results as described in Issue #85
- Issue with searching for pinyin with tone numbers
- Missing capital letter pinyin as described in Issue #86

### Changed
- Updated to a newer version of CC-CEDICT (Released 2018-02-07)
- Changed fields in dictionary database (app/src/db/cc-cedict.json)

## [1.0.1] - 2017-12-08
### Changed
- Moved prettify-pinyin to Rust (in syng-dictionary-creator)
- Improved startup load times by more than 30% by decreasing syng dictionary file size

### Fixed
- Improved searchable terms as described in Issue #40
- Fixed problem with text overflow with notes in bookmarks as described in Issue #81
- Fixed issue prettifying no-tone syllables in prettify pinyin tool as described in Issue #80

## [1.0.0] - 2017-11-18
### Added
- A menu item and keyboard shortcut for switching input, as described in Issue #64
- Pinyinify Characters (汉字 --> 拼音) as described in Issue #59
- Pinyin Searchable with Tones Marks as described in Issue #56
- Component Characters in Bookmarks Section as described in Issue #50
- Support for custom word lists as described in Issue #49
- Support for notes on words in bookmarks section as described in Issue #38
- Donate button as described in Issue #73
- Support for user error submitting
- One window user interface as described in #66

### Fixed
- 羡 Character Unsearchable #63
- Character Coloring for Words Containing No Tone Characters #52
- Pinyin search with capital letters #76
- Punctuation in search results in error

### Changed
- Search Engine's hashmap library
- Search Engine loading method (now complies with syng-dictionary-creator)
- User interface for Large Character View
- Development flow and build process
- Library for pinyinization
- Icon
- Location for syng persistant data (ie bookmarks)

## [0.2.1]
### Fixed
- Fixed Display Issues on Windows

## [0.2.0] - 2016-11-08
### Added
- Added Import and Export of bookmarks as described in Issue #36
- Added Error Reports as described in Issue #37
- Added Pinyin Converter as described in Issue #23
- Added Character Converter as described in Issue #22
- Added View Changelog to Help Menu
- Added Logging Platform for Debugging
- Added Automatically Generated Tests Based on Bookmarks as described in Issue #27
- Added Component Characters Section to Search Results as described in Issue #34

### Fixed
- Fixed Issue #31, Search Button on New Line on Windows
- Fixed Issue #43, Improper Behavior after Closing Main Window on Mac
- Fixed Issue #47, Pinyin Font too Small to Read

## [0.1.2] - 2016-04-18
### Fixed
- Fixed Issue #21 学 simplified character not searchable

## [0.1.1] - 2016-04-17
### Fixed
- Fixed Issue #28 Path error when adding words to bookmarks.

## [0.1.0] - 2016-04-15
Initial Release
