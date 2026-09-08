use crate::utils::word_utils;
use chinese_dictionary as dictionary;
use rand::prelude::IndexedRandom;
use rand::seq::SliceRandom;
use rand::{rng, Rng};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Deserialize, Serialize, Clone, Copy)]
pub enum QuestionKind {
    Pinyin,
    English,
    Characters,
}

#[derive(Debug, Clone, PartialEq, Eq, Copy)]
enum AnswerKind {
    Pinyin,
    English,
    Characters,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct CharacterOption {
    simplified: String,
    traditional: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct QuestionOption {
    value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    characters: Option<CharacterOption>,
}

impl AnswerKind {
    fn get_random(exclude: AnswerKind) -> Result<Self, String> {
        let mut rng = rng();
        let options = match exclude {
            AnswerKind::Pinyin => vec![AnswerKind::English, AnswerKind::Characters],
            AnswerKind::English => vec![AnswerKind::Pinyin, AnswerKind::Characters],
            AnswerKind::Characters => vec![AnswerKind::Pinyin, AnswerKind::English],
        };
        Ok(*options
            .choose(&mut rng)
            .ok_or("Could not choose a random answer type.".to_string())?)
    }
}

#[derive(Deserialize, Serialize, Clone)]
pub enum Question {
    MultipleChoice {
        kind: QuestionKind,
        question: String,
        answer: String,
        options: Vec<QuestionOption>,
        time_limit: u16,
        word_data: dictionary::WordEntry,
    },
}

static DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT: u16 = 30;

type QuestionAnswerOptions = (Vec<QuestionOption>, String);

fn build_question_option(
    answer_kind: AnswerKind,
    word: &dictionary::WordEntry,
    rng: &mut impl Rng,
) -> Result<QuestionOption, String> {
    let (value, characters) = match answer_kind {
        AnswerKind::Pinyin => (word.pinyin_marks.to_owned(), None),
        AnswerKind::English => (
            word.english
                .choose(rng)
                .ok_or("Could not choose an english definition answer.")?
                .to_owned(),
            None,
        ),
        AnswerKind::Characters => (
            word_utils::get_characters(word),
            Some(CharacterOption {
                simplified: word.simplified.to_owned(),
                traditional: word.traditional.to_owned(),
            }),
        ),
    };

    Ok(QuestionOption { value, characters })
}

fn get_question_answer_options(
    question_kind: &QuestionKind,
    word: &dictionary::WordEntry,
    list: &[dictionary::WordEntry],
) -> Result<QuestionAnswerOptions, String> {
    let mut rng = rng();
    let mut options = Vec::with_capacity(4);
    let exclude_answer_kind = match question_kind {
        QuestionKind::Pinyin => AnswerKind::Pinyin,
        QuestionKind::English => AnswerKind::English,
        QuestionKind::Characters => AnswerKind::Characters,
    };
    let answer_kind = AnswerKind::get_random(exclude_answer_kind)?;
    let answer_option = build_question_option(answer_kind, word, &mut rng)?;
    let answer = answer_option.value.to_owned();

    options.push(answer_option);
    let mut possible_options: Vec<QuestionOption> = list
        .iter()
        .filter_map(|w| {
            let is_match = match answer_kind {
                AnswerKind::Pinyin => w.pinyin_marks != answer,
                AnswerKind::English => !w.english.contains(&answer),
                AnswerKind::Characters => word_utils::get_characters(w) != answer,
            };
            if is_match {
                build_question_option(answer_kind, w, &mut rng).ok()
            } else {
                None
            }
        })
        .collect();

    if possible_options.len() < 3 {
        return Err(
            "Not enough words in the list to generate quiz options. Need at least 4 words."
                .to_string(),
        );
    }

    for _ in 0..3 {
        let index = rng.random_range(0..possible_options.len());
        options.push(possible_options.swap_remove(index));
    }

    options.shuffle(&mut rng);

    Ok((options, answer))
}

impl Question {
    fn get_answer(&self) -> &String {
        match self {
            Question::MultipleChoice { answer, .. } => answer,
        }
    }

    fn new_multiple_choice(
        kind: QuestionKind,
        word: &dictionary::WordEntry,
        list: &[dictionary::WordEntry],
    ) -> Result<Vec<Self>, String> {
        match &kind {
            QuestionKind::English => Ok(word
                .english
                .iter()
                .map(|english| {
                    let question = english.to_owned();
                    let (options, answer) = get_question_answer_options(&kind, word, list)?;

                    Ok(Question::MultipleChoice {
                        time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
                        kind,
                        question,
                        answer,
                        options,
                        word_data: word.clone(),
                    })
                })
                .collect::<Result<Vec<Self>, String>>()?),
            QuestionKind::Characters => {
                let question = word_utils::get_characters(word);
                let (options, answer) = get_question_answer_options(&kind, word, list)?;

                Ok(vec![Question::MultipleChoice {
                    time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
                    kind,
                    question,
                    answer,
                    options,
                    word_data: word.clone(),
                }])
            }
            QuestionKind::Pinyin => {
                let question = word.pinyin_marks.to_owned();
                let (options, answer) = get_question_answer_options(&kind, word, list)?;

                Ok(vec![Question::MultipleChoice {
                    time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
                    kind,
                    question,
                    answer,
                    options,
                    word_data: word.clone(),
                }])
            }
        }
    }
}

#[derive(Deserialize, Serialize, Clone)]
pub struct Answer {
    answered_in: u16,
    response: String,
    correct: bool,
    question: Question,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct QuestionCard {
    question: Question,
    completed: usize,
    pending: usize,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ScoreCard {
    score: u8,
    correct: usize,
    total: usize,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AnswerCard {
    response: String,
    answered_in: u16,
}

pub trait QuizActions: Send + Sync {
    // Get the next question
    fn next(&self) -> Result<QuestionCard, String>;

    // Get the final score
    fn score(&self) -> Result<ScoreCard, String>;

    // Respond to the question with an answer
    fn answer(&mut self, response: AnswerCard) -> Result<Answer, String>;

    // Get the incorrect questions
    fn get_incorrect(&self) -> Result<Vec<Answer>, String>;
}

pub fn generate_questions(
    list: &[dictionary::WordEntry],
    kinds: &[QuestionKind],
) -> Result<Vec<Question>, String> {
    let mut rng = rng();

    let mut questions: Vec<Question> = list
        .iter()
        .flat_map(|word| {
            kinds
                .iter()
                .flat_map(|kind| Question::new_multiple_choice(*kind, word, list))
                .flatten() // Flatten the nested Vec<Result<Vec<Question>, String>> into a single Vec<Question>
                .collect::<Vec<Question>>() // Collect the flattened questions into a Vec<Question>
        })
        .collect();

    questions.shuffle(&mut rng);
    Ok(questions)
}

pub struct SimpleQuiz {
    pending: Vec<Question>,
    completed: Vec<Answer>,
}

impl SimpleQuiz {
    fn new(config: &QuizConfig) -> Result<Self, String> {
        let questions = generate_questions(&config.words, &config.question_kinds)?;
        Ok(Self {
            completed: Vec::with_capacity(questions.len()),
            pending: questions,
        })
    }
}

impl QuizActions for SimpleQuiz {
    fn next(&self) -> Result<QuestionCard, String> {
        Ok(QuestionCard {
            completed: self.completed.len(),
            pending: self.pending.len(),
            question: self
                .pending
                .last()
                .ok_or("No more pending questions")?
                .to_owned(),
        })
    }

    fn score(&self) -> Result<ScoreCard, String> {
        let total = self.pending.len() + self.completed.len();
        let incorrect = self.pending.len() + self.completed.iter().filter(|a| !a.correct).count();
        let correct = total - incorrect;
        let percentage = ((correct as f64 / total as f64) * 100.0).round() as u8;
        Ok(ScoreCard {
            score: percentage,
            correct,
            total,
        })
    }

    fn answer(&mut self, response: AnswerCard) -> Result<Answer, String> {
        let question = self
            .pending
            .pop()
            .ok_or("No more pending questions to answer.")?
            .to_owned();
        let answer = Answer {
            answered_in: response.answered_in,
            correct: &response.response == question.get_answer(),
            response: response.response,
            question,
        };
        self.completed.push(answer.clone());
        Ok(answer)
    }

    fn get_incorrect(&self) -> Result<Vec<Answer>, String> {
        Ok(self
            .completed
            .iter()
            .filter(|a| !a.correct)
            .map(|a| a.to_owned())
            .collect())
    }
}

#[derive(Serialize, Deserialize)]
pub enum QuizKind {
    Simple,
}

#[derive(Serialize, Deserialize)]
pub struct QuizConfig {
    words: Vec<dictionary::WordEntry>,
    kind: QuizKind,
    question_kinds: Vec<QuestionKind>,
}

pub struct Quiz {
    state: Box<dyn QuizActions>,
    #[allow(dead_code)]
    config: QuizConfig,
}

impl Quiz {
    fn new(config: QuizConfig) -> Result<Self, String> {
        Ok(Quiz {
            state: Box::new(match config.kind {
                QuizKind::Simple => SimpleQuiz::new(&config)?,
            }),
            config,
        })
    }

    fn next_question(&self) -> Result<QuestionCard, String> {
        self.state.next()
    }

    fn answer_question(&mut self, answer: AnswerCard) -> Result<Answer, String> {
        self.state.answer(answer)
    }

    fn get_score(&self) -> Result<ScoreCard, String> {
        self.state.score()
    }

    fn get_incorrect(&self) -> Result<Vec<Answer>, String> {
        self.state.get_incorrect()
    }
}

pub struct QuizState(Mutex<Option<Quiz>>);

impl Default for QuizState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[tauri::command]
pub fn start_quiz(state: tauri::State<QuizState>, config: QuizConfig) -> Result<(), String> {
    let mut quiz = state.0.lock().map_err(|err| err.to_string())?;
    *quiz = Some(Quiz::new(config)?);
    Ok(())
}

#[tauri::command]
pub fn get_next_question(state: tauri::State<QuizState>) -> Result<QuestionCard, String> {
    let quiz = state.0.lock().map_err(|err| err.to_string())?;
    quiz.as_ref().ok_or("No quiz in progress")?.next_question()
}

#[tauri::command]
pub fn answer_question(
    state: tauri::State<QuizState>,
    response: AnswerCard,
) -> Result<Answer, String> {
    let mut quiz = state.0.lock().map_err(|err| err.to_string())?;
    quiz.as_mut()
        .ok_or("No quiz in progress")?
        .answer_question(response)
}

#[tauri::command]
pub fn score_quiz(state: tauri::State<QuizState>) -> Result<ScoreCard, String> {
    let quiz = state.0.lock().map_err(|err| err.to_string())?;
    quiz.as_ref().ok_or("No quiz in progress")?.get_score()
}

#[tauri::command]
pub fn get_incorrect_questions(state: tauri::State<QuizState>) -> Result<Vec<Answer>, String> {
    let quiz = state.0.lock().map_err(|err| err.to_string())?;
    quiz.as_ref().ok_or("No quiz in progress")?.get_incorrect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(simplified: &str, traditional: &str) -> dictionary::WordEntry {
        serde_json::from_value(serde_json::json!({
            "traditional": traditional,
            "simplified": simplified,
            "pinyin_marks": "shí yàn",
            "pinyin_numbers": "shi2 yan4",
            "english": ["experiment"],
            "tone_marks": [2, 4],
            "hash": 1,
            "measure_words": [],
            "hsk": {
                "hsk_2015": ["One"],
                "proficiency_standard_2021": [],
                "hsk_exam_syllabus_2025": []
            },
            "word_id": 1,
        }))
        .expect("test dictionary entry should deserialize")
    }

    #[test]
    fn character_options_include_both_character_forms() {
        let mut rng = rng();
        let option =
            build_question_option(AnswerKind::Characters, &word("实验", "實驗"), &mut rng).unwrap();

        assert_eq!(option.value, "实验 (實驗)");
        assert_eq!(
            option.characters,
            Some(CharacterOption {
                simplified: "实验".to_string(),
                traditional: "實驗".to_string(),
            })
        );
    }

    #[test]
    fn non_character_options_do_not_include_character_metadata() {
        let mut rng = rng();
        let option =
            build_question_option(AnswerKind::Pinyin, &word("实验", "實驗"), &mut rng).unwrap();

        assert_eq!(option.value, "shí yàn");
        assert_eq!(option.characters, None);
    }

    #[test]
    fn grading_uses_the_canonical_option_value() {
        let word = word("实验", "實驗");
        let question = Question::MultipleChoice {
            kind: QuestionKind::English,
            question: "experiment".to_string(),
            answer: "实验 (實驗)".to_string(),
            options: vec![QuestionOption {
                value: "实验 (實驗)".to_string(),
                characters: Some(CharacterOption {
                    simplified: "实验".to_string(),
                    traditional: "實驗".to_string(),
                }),
            }],
            time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
            word_data: word,
        };
        let mut quiz = SimpleQuiz {
            pending: vec![question],
            completed: vec![],
        };

        let answer = quiz
            .answer(AnswerCard {
                answered_in: 1,
                response: "实验 (實驗)".to_string(),
            })
            .unwrap();

        assert!(answer.correct);
    }
}
