import BaseSpeaker from './../baseSpeaker';
import BaiduChapter from './baiduChapter';

export default class BaiduSpeaker extends BaseSpeaker {
  constructor() {
    super('baidu');
  }

  static available(cb) {
    try {
      // Test for Audio
      if ('undefined' === typeof window.Audio)
        return cb({
          base: false,
          book: false
        });

      let audio = new Audio();

      //Shortcut which doesn't work in Chrome (always returns ""); pass through
      // if "maybe" to do asynchronous check by loading MP3 data: URI
      let ret = {
        base: false,
        book: false,
      }
      if ('probably' === audio.canPlayType('audio/mpeg')) {
        ret.base = true;
        ret.book = true;
      }

      //If this event fires, then MP3s can be played
      audio.addEventListener('canplaythrough', function () {
        // here have some props to gave more details of supportment
        ret.base = true;
        // In some mobile browser, the `canplaythrough` event fired unexpected,
        // Thus when an Audio.play() call in callback of another Audio's `ended`
        // event, nothing will play.
        // Example, in MiuiBrowser/2.1.1 at Xiaomi phone MI4:
        // audio.networkState is 2 (it is weird)
        // audio.readyState is 4
        // audio.duration is 1 (always 1)
        // audio.buffered.length is 0 (always 0)
        ret.book = audio.networkState == 1 && audio.readyState == 4 && audio.duration > 0 && audio.buffered.length > 0 && (audio.buffered.end(0) - audio.buffered.start(0)) > 0;
        cb(ret);
      }, false);

      //If this is fired, then client can't play MP3s
      audio.addEventListener('error', function () {
        cb({
          base: false,
          book: false
        });
      }, false);

      //Smallest base64-encoded MP3 I could come up with (less than 0.000001 seconds long)
      audio.src = "data:audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

      audio.load();
    }
    catch (e) {
      return cb({
        base: false,
        book: false
      });
    }
  }
}

BaiduSpeaker.Chapter = BaiduChapter;