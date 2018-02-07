import BaseChapter from './../baseChapter';

export default class NativeChapter extends BaseChapter {
  constructor(msg, lang) {
    super(msg);
    lang = lang || 'zh-CN';
    this.lang = lang;

    this.utterance = NativeChapter._makeUtterance(this.lang);
    this.utterance.text = msg;
    this.source = this.utterance;
  }
  
  play(cb, lang, err) {
    let uttr = this.utterance;
    console.log(lang);
    if (lang != this.lang) {
      uttr = NativeChapter._makeUtterance(lang);
      uttr.text = this.text;
    }
    // this.utterance.onend = function(e) {
    //   cb(e);
    // };
    // Don't use `.onend` even in Chrome, this is not stabilized.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=509488
    // http://stackoverflow.com/questions/23483990/speechsynthesis-api-onend-callback-not-working
    speechSynthesis.speak(uttr);
    function _wait() {
      if ( ! window.speechSynthesis.speaking ) {
        cb();
        return;
      }
      window.setTimeout( _wait, 100 );
    }
    _wait();
  }
}

NativeChapter._makeUtterance = function(lang) {
  let utterance = new SpeechSynthesisUtterance();
  let voices = window.speechSynthesis.getVoices().filter(function(v) {
    return v.lang == lang;
  });
  utterance.voice = voices[0]; // Note: some voices don't support altering params
  utterance.voiceURI = 'native';
  utterance.volume = 1; // 0 to 1
  utterance.rate = 1; // 0.1 to 10
  utterance.pitch = 1; //0 to 2
  utterance.lang = lang;
  return utterance;
}