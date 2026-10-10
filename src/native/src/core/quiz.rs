use crate::utils::word_utils;
use chinese_dictionary as dictionary;
use rand::prelude::IndexedRandom;
use rand::seq::SliceRandom;
use rand::{rng, Rng, RngExt};
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
    fn get_random_order(exclude: AnswerKind) -> [Self; 2] {
        let mut options = match exclude {
            AnswerKind::Pinyin => [AnswerKind::English, AnswerKind::Characters],
            AnswerKind::English => [AnswerKind::Pinyin, AnswerKind::Characters],
            AnswerKind::Characters => [AnswerKind::Pinyin, AnswerKind::English],
        };
        options.shuffle(&mut rng());
        options
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
        lexical_unit: dictionary::LexicalUnit,
    },
}

static DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT: u16 = 30;
type QuestionAnswerOptions = (Vec<QuestionOption>, String);

fn definition_glosses(unit: &dictionary::LexicalUnit) -> Vec<&str> {
    unit.english
        .iter()
        .map(|definition| definition.gloss.value.as_str())
        .collect()
}

fn build_question_option(
    answer_kind: AnswerKind,
    unit: &dictionary::LexicalUnit,
    random: &mut impl Rng,
) -> Result<QuestionOption, String> {
    let (value, characters) = match answer_kind {
        AnswerKind::Pinyin => (unit.pinyin.marks.clone(), None),
        AnswerKind::English => (
            definition_glosses(unit)
                .choose(random)
                .ok_or_else(|| "Could not choose an English definition answer.".to_string())?
                .to_string(),
            None,
        ),
        AnswerKind::Characters => (
            word_utils::get_characters(unit),
            Some(CharacterOption {
                simplified: unit.simplified.clone(),
                traditional: unit.traditional.clone(),
            }),
        ),
    };
    Ok(QuestionOption { value, characters })
}

fn get_question_answer_options(
    question_kind: &QuestionKind,
    unit: &dictionary::LexicalUnit,
    units: &[dictionary::LexicalUnit],
) -> Result<QuestionAnswerOptions, String> {
    let answer_kinds = AnswerKind::get_random_order(match question_kind {
        QuestionKind::Pinyin => AnswerKind::Pinyin,
        QuestionKind::English => AnswerKind::English,
        QuestionKind::Characters => AnswerKind::Characters,
    });
    for answer_kind in answer_kinds {
        if let Ok(options) = build_question_answer_options(answer_kind, unit, units) {
            return Ok(options);
        }
    }
    Err("Not enough distinct answers in the list to generate quiz options.".to_string())
}

fn build_question_answer_options(
    answer_kind: AnswerKind,
    unit: &dictionary::LexicalUnit,
    units: &[dictionary::LexicalUnit],
) -> Result<QuestionAnswerOptions, String> {
    let mut random = rng();
    let answer_option = build_question_option(answer_kind, unit, &mut random)?;
    let answer = answer_option.value.clone();
    let mut options = vec![answer_option];
    let mut possible_options = units
        .iter()
        .filter(|candidate| match answer_kind {
            AnswerKind::Pinyin => candidate.pinyin.marks != answer,
            AnswerKind::English => !definition_glosses(candidate).contains(&answer.as_str()),
            AnswerKind::Characters => word_utils::get_characters(candidate) != answer,
        })
        .filter_map(|candidate| build_question_option(answer_kind, candidate, &mut random).ok())
        .collect::<Vec<_>>();
    if possible_options.len() < 3 {
        return Err(
            "Not enough words in the list to generate quiz options. Need at least 4 words."
                .to_string(),
        );
    }
    for _ in 0..3 {
        let index = random.random_range(0..possible_options.len());
        options.push(possible_options.swap_remove(index));
    }
    options.shuffle(&mut random);
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
        unit: &dictionary::LexicalUnit,
        units: &[dictionary::LexicalUnit],
    ) -> Result<Vec<Self>, String> {
        match kind {
            QuestionKind::English => definition_glosses(unit)
                .into_iter()
                .map(|gloss| {
                    let (options, answer) = get_question_answer_options(&kind, unit, units)?;
                    Ok(Question::MultipleChoice {
                        time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
                        kind,
                        question: gloss.to_string(),
                        answer,
                        options,
                        lexical_unit: unit.clone(),
                    })
                })
                .collect(),
            QuestionKind::Characters | QuestionKind::Pinyin => {
                let question = match kind {
                    QuestionKind::Characters => word_utils::get_characters(unit),
                    QuestionKind::Pinyin => unit.pinyin.marks.clone(),
                    QuestionKind::English => unreachable!(),
                };
                let (options, answer) = get_question_answer_options(&kind, unit, units)?;
                Ok(vec![Question::MultipleChoice {
                    time_limit: DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT,
                    kind,
                    question,
                    answer,
                    options,
                    lexical_unit: unit.clone(),
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
    answered_in: u16,
    response: String,
}

pub trait QuizActions: Send + Sync {
    fn next(&self) -> Result<QuestionCard, String>;
    fn score(&self) -> Result<ScoreCard, String>;
    fn answer(&mut self, response: AnswerCard) -> Result<Answer, String>;
    fn get_incorrect(&self) -> Result<Vec<Answer>, String>;
}

pub fn generate_questions(
    units: &[dictionary::LexicalUnit],
    kinds: &[QuestionKind],
) -> Result<Vec<Question>, String> {
    let mut questions = Vec::new();
    for unit in units {
        for kind in kinds {
            if let Ok(unit_questions) = Question::new_multiple_choice(*kind, unit, units) {
                questions.extend(unit_questions);
            }
        }
    }
    if questions.is_empty() {
        return Err(
            "Not enough distinct answers in the list to generate quiz questions.".to_string(),
        );
    }
    questions.shuffle(&mut rng());
    Ok(questions)
}

pub struct SimpleQuiz {
    pending: Vec<Question>,
    completed: Vec<Answer>,
}
impl SimpleQuiz {
    fn new(units: &[dictionary::LexicalUnit], kinds: &[QuestionKind]) -> Result<Self, String> {
        let questions = generate_questions(units, kinds)?;
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
                .ok_or_else(|| "No more pending questions".to_string())?
                .clone(),
        })
    }
    fn score(&self) -> Result<ScoreCard, String> {
        let total = self.pending.len() + self.completed.len();
        if total == 0 {
            return Err("Quiz has no questions.".to_string());
        }
        let incorrect = self.pending.len()
            + self
                .completed
                .iter()
                .filter(|answer| !answer.correct)
                .count();
        let correct = total - incorrect;
        Ok(ScoreCard {
            score: ((correct as f64 / total as f64) * 100.0).round() as u8,
            correct,
            total,
        })
    }
    fn answer(&mut self, response: AnswerCard) -> Result<Answer, String> {
        let question = self
            .pending
            .pop()
            .ok_or_else(|| "No more pending questions to answer.".to_string())?;
        let answer = Answer {
            answered_in: response.answered_in,
            correct: response.response == *question.get_answer(),
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
            .filter(|answer| !answer.correct)
            .cloned()
            .collect())
    }
}

#[derive(Serialize, Deserialize)]
pub enum QuizKind {
    Simple,
}
#[derive(Serialize, Deserialize)]
pub struct QuizConfig {
    lexical_ids: Vec<String>,
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
        let units = config
            .lexical_ids
            .iter()
            .map(|id| {
                dictionary::query_by_id_str(id)
                    .map(dictionary::LexicalUnitRef::to_owned)
                    .ok_or_else(|| format!("Could not resolve lexical ID {id}."))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let state: Box<dyn QuizActions> = match config.kind {
            QuizKind::Simple => Box::new(SimpleQuiz::new(&units, &config.question_kinds)?),
        };
        Ok(Self { state, config })
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
    *state.0.lock().map_err(|error| error.to_string())? = Some(Quiz::new(config)?);
    Ok(())
}
#[tauri::command]
pub fn get_next_question(state: tauri::State<QuizState>) -> Result<QuestionCard, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .ok_or_else(|| "No quiz in progress".to_string())?
        .next_question()
}
#[tauri::command]
pub fn answer_question(
    state: tauri::State<QuizState>,
    response: AnswerCard,
) -> Result<Answer, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .as_mut()
        .ok_or_else(|| "No quiz in progress".to_string())?
        .answer_question(response)
}
#[tauri::command]
pub fn score_quiz(state: tauri::State<QuizState>) -> Result<ScoreCard, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .ok_or_else(|| "No quiz in progress".to_string())?
        .get_score()
}
#[tauri::command]
pub fn get_incorrect_questions(state: tauri::State<QuizState>) -> Result<Vec<Answer>, String> {
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .ok_or_else(|| "No quiz in progress".to_string())?
        .get_incorrect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn unit() -> dictionary::LexicalUnit {
        dictionary::query_by_chinese("实验")
            .into_iter()
            .next()
            .unwrap()
            .to_owned()
    }
    #[test]
    fn character_options_include_both_character_forms() {
        let mut random = rng();
        let option = build_question_option(AnswerKind::Characters, &unit(), &mut random).unwrap();
        assert_eq!(option.value, "实验 (實驗)");
        assert!(option.characters.is_some());
    }

    fn homophone_units() -> Vec<dictionary::LexicalUnit> {
        ["他", "她", "我", "你"]
            .into_iter()
            .map(|characters| {
                dictionary::query_by_chinese(characters)
                    .into_iter()
                    .next()
                    .unwrap()
                    .to_owned()
            })
            .collect()
    }

    #[test]
    fn homophones_fall_back_to_english_answers() {
        let units = homophone_units();
        assert!(build_question_answer_options(AnswerKind::Pinyin, &units[0], &units).is_err());
        for _ in 0..100 {
            let questions = generate_questions(&units, &[QuestionKind::Characters]).unwrap();
            assert_eq!(questions.len(), units.len());
            for question in questions {
                let Question::MultipleChoice {
                    answer, options, ..
                } = question;
                assert_eq!(options.len(), 4);
                assert_eq!(
                    options
                        .iter()
                        .filter(|option| option.value == answer)
                        .count(),
                    1
                );
            }
        }
    }

    #[test]
    fn unconstructable_questions_do_not_discard_usable_questions() {
        let mut units = homophone_units();
        for unit in &mut units {
            unit.simplified = "同".to_string();
            unit.traditional = "同".to_string();
            unit.pinyin.marks = "tóng".to_string();
        }
        let questions =
            generate_questions(&units, &[QuestionKind::English, QuestionKind::Characters]).unwrap();
        assert_eq!(questions.len(), units.len());
        assert!(questions.iter().all(|question| matches!(
            question,
            Question::MultipleChoice {
                kind: QuestionKind::Characters,
                ..
            }
        )));
        assert!(generate_questions(&units, &[QuestionKind::English]).is_err());
    }

    #[test]
    fn invalid_lexical_id_is_rejected() {
        let config = QuizConfig {
            lexical_ids: vec!["not-an-id".to_string()],
            kind: QuizKind::Simple,
            question_kinds: vec![QuestionKind::Pinyin],
        };
        assert!(Quiz::new(config).is_err());
    }
}
