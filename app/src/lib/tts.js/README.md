# tts.js
*v0.1*

中文文档看[这里](README_CN.md)

## Description
Javascript API for the Text-to-Speech service, provide an interface to manage built-in TTS speaker or your own TTS service.

## Develop
I use webpack as module bundler. The code depend on following project:

* Node.js(NPM)
* [Webpack](https://webpack.github.io/)

```shell
$ cd path/to/repo
```

Install dependencies.
```shell
$ npm install
```

Build `.min.js` file, run following command, and find min file in `/tts.js/`:
```shell
$ npm run build
```

## Usage

### Speaker

`tts.js` use `Speaker` class to handle each TTS service.

#### .available( callback )

Each speaker provide an static `available` function to tell whether this service is available, use `NativeSpeaker` as an example:

```javascript
// NativeSpeaker will detect whether your browser support
// speechSynthesis or not
NativeSpeaker.available(function(res) {
  console.log(res);
});
// The result look like this:
// {
//   base: true,
//   book: true,
// }
// This means the browser support NativeSpeaker's base service and
// support play book.
```

#### .speak( source [, cb [, err]] )

Speaker instance can speak an source class instance(Chapter or Book).

```javascript
// get an instance
var speaker = new NativeSpeaker();
speaker.speak(a_chapter_or_book, function() {
  console.log('finish');
});
```

#### Chapter and Book

Speaker should implement 2 static properties: Chapter and Book. They can point which chapter or book class are recommended to be used in this speaker.

```javascript
var speaker = new NativeSpeaker();
// use recommended Chapter
var chapter = new NativeSpeaker.Chapter('Something to speak', 'en-US');
speaker.speak(chapter);
// use your own Chapter
var chapter2 = new MyNativeChapter('Something to speak');
speaker.speak(chapter2);
```

### Chapter

Chapter class is the base service of `tts.js`.

#### .play( [callback [, err ]] )

Play a message.

```javascript
var chapter = new NativeSpeaker.Chapter('Something to speak', 'en-US');
chapter.play();
```

### Book

Book class can combine multiple Chapters one by one.

#### .play( [callback [, err ]] )

Play a list of messages.

```javascript
var msgs = [
  'Something to speak',
  'Long long ago',
  'There is a beautiful girl'
];
var chapters = msgs.map(function(msg) {
  return new NativeSpeaker.Chapter(msg);
});
var book = new NativeSpeaker.Book(chapters, 'en-US');
book.play();
```

### Use TTSManager

Using `TTSManager` is an easy way to manage your TTS service from `tts.js`.

#### constructor(speakers)

Use one or more speakers to initialize TTSManager.

```javascript
// Pass one or more speakers into manager
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
// This means if NativeSpeaker is available, the manager will use
// NativeSpeaker, if not, the manager will detect if BaiduSpeaker
// is available.
```

#### .available( callback )

When a speaker's available state changes, the callback will be invoked.

```javascript
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
ttsmanager.available(function(res) {
  console.log(res);
});
// available's callback may be invoked 2 times here.
```

#### .speak(msg [, cb [, err ]] )

Let TTSManager speak a string.

```javasciprt
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
ttsmanager.speak('Something to speak');

// ....

ttsmanager.speak('Something to speak');
```

#### .speakBook(msgs [, cb [, opts [, err ]]] )

Let TTSManager speak a list of strings.

```javascript
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
ttsmanager.speakBook([
  'Something to speak',
  'Long long ago',
  'There is a beautiful girl'
]);
```

## LICENSE

Copyright 2016 Xu Xiaomeng(@sekaiamber)

Released under the MIT and GPL (version 2 or later) Licenses.