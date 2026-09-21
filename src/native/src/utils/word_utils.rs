use chinese_dictionary as dictionary;

pub fn get_characters(word: &dictionary::LexicalUnit) -> String {
    if word.simplified == word.traditional {
        word.traditional.to_owned()
    } else {
        format!("{} ({})", word.simplified, word.traditional)
    }
}
