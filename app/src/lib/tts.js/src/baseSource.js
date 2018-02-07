export default class BaseSource {
  noop() {}
  play() { throw new Error('Not yet implemented'); };
  pause() { throw new Error('Not yet implemented'); };
}