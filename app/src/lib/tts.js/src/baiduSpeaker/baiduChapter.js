import BaseChapter from './../baseChapter';

export default class BaiduChapter extends BaseChapter {
  constructor(msg) {
    super(msg);
    let audio = new Audio('http://tts.baidu.com/text2audio?lan=zh&pid=101&ie=UTF-8&text=' + encodeURI(msg) + '&_=' + new Date().getTime() + '.' + Math.random());
    audio.preload = 'auto';
    this.audio = audio;
    // In mobile safari, you should load first, it is weird.
    // http://www.ibm.com/developerworks/library/wa-ioshtml5/
    this.audio.load();
    this.source = this.audio;
  }
  
  play(cb, err) {
    let self = this;
    cb = cb || this.noop;
    err = err || this.noop;
    try {
      this.audio.addEventListener('ended', function() {
        cb();
      });
      self.audio.play();
    } catch (e) {
      return err(e);
    }
  }
}