import BaseSpeaker from './../baseSpeaker';
import NativeChapter from './nativeChapter';

export default class NativeSpeaker extends BaseSpeaker {
  constructor(lang) {
    super('native');
    this.lang = lang || NativeSpeaker.lang;
  }
  
  static available(cb) {
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      var voices = window.speechSynthesis.getVoices().filter(function(v) {return v.lang == NativeSpeaker.lang});
      if (voices.length > 0) {
        // Safari, firefox
        return cb({
          base: true,
          book: true
        });
      } else {
        // chrome
        window.speechSynthesis.onvoiceschanged = function() {
          voices = window.speechSynthesis.getVoices().filter(function(v) {return v.lang == NativeSpeaker.lang});
          return cb({
            base: voices.length > 0,
            book: voices.length > 0,
          });
        };
      }
    } else {
      return cb({
        base: false,
        book: false
      });
    }
  }
  
  speak(source, cb, err) {
    cb = cb || this.noop;
    err = err || this.noop;
    try {
      source.play(cb, this.lang, err);
    } catch (e) {
      err(e);
    }
  }
}

NativeSpeaker.Chapter = NativeChapter;
NativeSpeaker.lang = 'zh-CN';