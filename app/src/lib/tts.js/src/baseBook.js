import Console from './_utils/devtoolConsole';
import BaseSource from './baseSource';

export default class BaseBook extends BaseSource {
  constructor(chapters) {
    super();
    chapters = chapters || [];
    for (let i = 0; i < chapters.length; i++) {
      let chapter = chapters[i];
      this[i] = chapter;
    }
    this.length = chapters.length;
    
    this.onChapterEnded = this.noop;
    this.onChapterStart = this.noop;
  }
  
  play(cb, err) {
    if (this.length == 0) {
      cb();
      return;
    }
    let self = this;
    function _play(i) {
      self.onChapterStart(self[i].source, i);
      Console.log('speaking start: ' + self[i].text);
      if (i == self.length - 1) {
        self[i].play(function() {
          Console.log('speaking end: ' + self[i].text);
          self.onChapterEnded(self[i].source, i);
          cb();
        });
      } else {
        self[i].play(function() {
          Console.log('speaking end: ' + self[i].text);
          self.onChapterEnded(self[i].source, i);
          _play(i + 1);
        });
      }
    }
    _play(0);
  }
}