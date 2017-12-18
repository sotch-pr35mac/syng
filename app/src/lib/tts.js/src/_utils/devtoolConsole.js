export default class Console {
  static log(msg) {
    if (window.devtools.open) {
      console.log('[TTS.js] ' + msg);
    }
  }
}