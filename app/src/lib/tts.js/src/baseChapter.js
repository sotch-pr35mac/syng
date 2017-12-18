import BaseSource from './baseSource';

export default class BaseChapter extends BaseSource {
  constructor(msg) {
    super();
    this.text = msg;
  }
}