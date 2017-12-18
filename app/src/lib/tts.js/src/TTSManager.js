import Console from './_utils/devtoolConsole';

export default class TTSManager {
  constructor(speakers) {
    // build speakers
    speakers = speakers.map((s, i) => {
      var fac = null;
      var opt = [];
      if (typeof s == 'function') {
        fac = s
      } else if (typeof s == 'object'){
        fac = s.speaker,
        opt = s.opt ? s.opt : []
      }
      opt = [null].concat(opt);
      return {
        factory: fac,
        speaker: new (fac.bind.apply(fac, opt))(),
        order: i,
        available: {
          base: false,
          book: false,
        },
      };
    });
    // props
    this.speakers = speakers;
    this.speaking = false;
    this.speaker = null;
    this._availableCallbacks = [];
    // init
    var self = this;
    for (var i = 0; i < this.speakers.length; i++) {
      var speaker = this.speakers[i];
      (function (speaker) {
        speaker.factory.available(function(res) {
          speaker.available = res;
          if (res.base) {
            if (self.speaker == null || (self.speaker && self.speaker.order > speaker.order)) {
              self.speaker = speaker;
            }
            self.available();
          }
        });
      })(speaker);
    }
  }
  noop() {}
  
  available(cb) {
    if (cb) {
      this._availableCallbacks.push(cb);
      if (this.speaker) {
        this.available();
      }
    } else {
      for (var i = 0; i < this._availableCallbacks.length; i++) {
        this._availableCallbacks[i](this.speaker.available);
      }
    }
  }
  
  speak(msg, cb, err) {
    cb = cb || this.noop;
    err = err || this.noop;
    if (this.speaker) {
      var chapter = new this.speaker.factory.Chapter(msg);
      var speaker = this.speaker.speaker;
      Console.log('speaking start: ' + msg);
      this.speaking = true;
      var self = this;
      speaker.speak(chapter, function() {
        self.speaking = false;
        Console.log('speaking end: ' + msg);
        cb();
      }, function () {
        self.speaking = false;
        Console.log('an error occor');
        Console.log('speaking end: ' + msg);
        err();
      });
    }
  }
  
  speakBook(msgs, cb, opts, err) {
    opts = opts || this.noop;
    cb = cb || this.noop;
    err = err || this.noop;
    var self = this;
    if (typeof opts == 'function') {
      opts = {
        onChapterEnded: opts
      }
    }
    msgs = msgs.map(function(msg) {
      return new self.speaker.factory.Chapter(msg);
    });
    var book = new this.speaker.factory.Book(msgs);
    for (var key in opts) {
      if (opts.hasOwnProperty(key)) {
        book[key] = opts[key];
      }
    }
    var speaker = this.speaker.speaker;
    Console.log('speaking book start');
    this.speaking = true;
    speaker.speak(book, function() {
      self.speaking = false;
      Console.log('speaking book end');
      cb();
    }, function () {
      self.speaking = false;
      Console.log('an error occor');
      Console.log('speaking book end');
      err();
    });
  }
}