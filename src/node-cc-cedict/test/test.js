var assert = require('assert');
var cedict = require('../index');

describe('Search CC-CEDICT', function(){

  describe('Search by Chinese', function(){
    
    it('should search by traditional if provided string is traditional', function(done){
      cedict.searchByChinese('強', function(words){
        assert.equal(words.length, 4);
        done();
      });
    });

    it('should search by simplified if provided string is simplified', function(done){
      cedict.searchByChinese('强', function(words){
        assert.equal(words.length, 7);
        done();
      });
    });

  });
	
	describe("Search by Pinyin", function() {
		
		it("should search by ugly pinyin and return dictionary entry", function(done) {
			cedict.searchByPinyin("qin1 qi5", function(words) {
				assert.equal(words.length, 1);
				done();
			});
		});
		
		it("should search by ugly pinyin and detect dead tones without number and return dictionary entry", function(done) {
			cedict.searchByPinyin("qin1 qi", function(words) {
				assert.equal(words.length, 1);
				done();
			});
		});
		
	});

});