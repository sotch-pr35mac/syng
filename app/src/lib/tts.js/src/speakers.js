import NativeSpeaker from './nativeSpeaker/nativeSpeaker';
import BaiduSpeaker from './baiduSpeaker/baiduSpeaker';

const Speakers = {
  'NativeSpeaker': NativeSpeaker,
  'BaiduSpeaker': BaiduSpeaker
}

export {
  Speakers,
  NativeSpeaker,
  BaiduSpeaker
};