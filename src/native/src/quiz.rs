use crate::utils::word_utils;
use chinese_dictionary as dictionary;
use rand::seq::SliceRandom;
use rand::{thread_rng, Rng};
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

impl AnswerKind {
    fn get_random(exclude: AnswerKind) -> Result<Self, String> {
        let mut rng = thread_rng();
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
        options: Vec<String>,
        time_limit: u16,
        word_data: dictionary::WordEntry,
    },
}

static DEFAULT_MULTIPLE_CHOICE_TIME_LIMIT: u16 = 30;

type QuestionAnswerOptions = (Vec<String>, String);
fn get_question_answer_options(
    question_kind: &QuestionKind,
    word: &dictionary::WordEntry,
    list: &[dictionary::WordEntry],
) -> Result<QuestionAnswerOptions, String> {
    let mut rng = thread_rng();
    let mut options = Vec::with_capacity(4);
    let exclude_answer_kind = match question_kind {
        QuestionKind::Pinyin => AnswerKind::Pinyin,
        QuestionKind::English => AnswerKind::English,
        QuestionKind::Characters => AnswerKind::Characters,
    };
    let answer_kind = AnswerKind::get_random(exclude_answer_kind)?;
    let answer = match answer_kind {
        AnswerKind::Pinyin => word.pinyin_marks.to_owned(),
        AnswerKind::English => word
            .english
            .choose(&mut rng)
            .ok_or("Could not choose an english definition answer.")?
            .to_owned(),
        AnswerKind::Characters => word_utils::get_characters(word),
    };

    options.push(answer.clone());
    let mut possible_options: Vec<String> = list
        .iter()
        .filter_map(|w| {
            let is_match = match answer_kind {
                AnswerKind::Pinyin => w.pinyin_marks != answer,
                AnswerKind::English => !w.english.contains(&answer),
                AnswerKind::Characters => word_utils::get_characters(w) != answer,
            };
            if is_match {
                Some(match answer_kind {
                    AnswerKind::Pinyin => w.pinyin_marks.to_owned(),
                    AnswerKind::English => w.english.choose(&mut rng).unwrap().to_owned(),
                    AnswerKind::Characters => word_utils::get_characters(w),
                })
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

    for _ in [0, 1, 2] {
        let index = rng.gen_range(0..possible_options.len());
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
    let mut rng = thread_rng();

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
