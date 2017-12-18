# tts.js
*v0.1*

For English document, click [here](README.md).

## 简介
使用JavaScript实现的TTS服务API，这个库提供了几个内置的TTS Speaker，也提供了一个用来管理这些Speaker或者你自己实现的Speaker的Manager和接口。

## 开发
我用Webpack来作为打包工具。本项目依赖下面的项目或工具：

* Node.js(NPM)
* [Webpack](https://webpack.github.io/)

```shell
$ cd path/to/repo
```

安装依赖
```shell
$ npm install
```

执行如下命令来打包压缩`.min.js`文件，你可以在`/tts.js/`目录下找到它:
```shell
$ npm run build
```

## API文档

### Speaker

`tts.js`使用`Speaker`这个类来处理和表示每种TTS服务。

#### .available( callback )

每个Speaker提供一个叫`available`的静态函数来返回浏览器当前是否支持这个TTS服务，以`NativeSpeaker`来举个例子：

```javascript
// NativeSpeaker将探测浏览器是否支持speechSynthesis
NativeSpeaker.available(function(res) {
  console.log(res);
});
// 返回结果如下形式
// {
//   base: true,
//   book: true,
// }
// 这表示浏览器支持NativeSpeaker的基本功能和支持播放Book
```

#### .speak( source [, cb [, err]] )

Speaker实例可以播放Chapter实例或者Book实例（两者均继承自Source实例）。

```javascript
// 初始化一个Speaker
var speaker = new NativeSpeaker();
speaker.speak(a_chapter_or_book, function() {
  console.log('finish');
});
```

#### Chapter和Book

Speaker类应该实现两个静态属性：Chapter和Book。它们能指出这个Speaker推荐使用哪个Chapter和Book。

```javascript
var speaker = new NativeSpeaker();
// 使用推荐的Chapter
var chapter = new NativeSpeaker.Chapter('Something to speak', 'en-US');
speaker.speak(chapter);
// 使用自己实现的Chapter
var chapter2 = new MyNativeChapter('Something to speak');
speaker.speak(chapter2);
```

### Chapter

Chapter类是`tts.js`中提供最基础功能的类.

#### .play( [callback [, err ]] )

播放一段文字。

```javascript
var chapter = new NativeSpeaker.Chapter('Something to speak', 'en-US');
chapter.play();
```

### Book

Book类可以将多个Chapter实例连接起来。

#### .play( [callback [, err ]] )

播放一系列文字。

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

使用`TTSManager`是一个很简单的方式来享受`tts.js`带来的TTS服务。

#### constructor(speakers)

使用一个或多个Speaker类来初始化TTSManager。

```javascript
// 将多个Speaker类传入TTSManager的构造器
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
// 这意味着如果NativeSpeaker可用，则用NativeSpeaker，若它不可用，则去
// 探测BaiduSpeaker是否可用
```

#### .available( callback )

如果一个Speaker的可用状态改变时，回调函数将被调用。

```javascript
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
ttsmanager.available(function(res) {
  console.log(res);
});
// 这里回调函数可能被调用2次。
```

#### .speak(msg [, cb [, err ]] )

使用TTSManager来朗读一段文字。

```javasciprt
var ttsmanager = new TTSManager([NativeSpeaker, BaiduSpeaker]);
ttsmanager.speak('Something to speak');

// ....

ttsmanager.speak('Something to speak');
```

#### .speakBook(msgs [, cb [, opts [, err ]]] )

使用TTSManager来朗读一系列文字。

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