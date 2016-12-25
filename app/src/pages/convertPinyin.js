/*
* @File         :: convertPinyin.js
* @Author       :: Preston Stosur-Bassett http://stosur.info
* @Created      :: April 25, 2016
* @Description  :: This file handles the conversion of pinyin with tone numbers to prettified pinyin
*/
var prettifier = require('prettify-pinyin'); // Prettify the pinyin default (letter + numbers)

$(document).ready(function() {
  $("#convert-pinyin").click(function() {
    var uglyPinyin = $("#ugly-pinyin").val();

    // Take out puncuation
    uglyPinyin = uglyPinyin.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    uglyPinyin = uglyPinyin.replace(/\s{2,}/g," ");

    var prettyPinyin = prettifier.prettify(uglyPinyin);
    $("#pretty-pinyin").val(prettyPinyin);
  });
});
