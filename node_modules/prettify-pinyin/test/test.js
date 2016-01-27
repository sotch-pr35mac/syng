var assert = require('assert');
var pinyin = require('../index');

// selected spelling rules check from MIT
// http://web.mit.edu/jinzhang/www/pinyin/spellingrules/

describe('Prettify Pinyin', function(){

  describe('(1) Syllables with one vowel letter:', function(){
    
    it('The tone mark is always on the vowel letter.', function(){
      assert.equal(pinyin.prettify('lv4'), 'lǜ');
      assert.equal(pinyin.prettify('zhi1'), 'zhī');
      assert.equal(pinyin.prettify('shan1'), 'shān');
      assert.equal(pinyin.prettify('ting1'), 'tīng');
    });

  });

  describe('(2) Syllables with two or three vowel letters:', function(){

    it('(i) If the first vowel letter is a medial, namely, "i", "u", or "ü", the tone mark is on the vowel letter immediately following the medial.', function(){
      assert.equal(pinyin.prettify('jiao1'), 'jiāo');
      assert.equal(pinyin.prettify('lve4'), 'lüè');
      assert.equal(pinyin.prettify('jiu3'), 'jiǔ');
      assert.equal(pinyin.prettify('gui4'), 'guì');
    }); 

    it('(ii) If the first vowel letter is not a medial, the tone mark is always on the first vowel letter.', function(){
      assert.equal(pinyin.prettify('hai3'), 'hǎi');
      assert.equal(pinyin.prettify('zhao3'), 'zhǎo');
      assert.equal(pinyin.prettify('shou3'), 'shǒu');
      assert.equal(pinyin.prettify('gei3'), 'gěi');
    });  

  });

});