/*
*	@File				:: test-bookmarks.js
*	@Author			:: Preston Stosur-Bassett [preston@stosur.info](http://stosur.info)
*	@Description	::	This file handles all the logic for creating and displaying generated tests
*	@Created			:: July 31st, 2016
*/

// Required Dependencies
var ipc = require('electron').ipcRenderer; // For communication with the Main Process
var tingo = require("tingodb")(); // Mongo-style database
var path = require('path');
var dialog = require('electron').remote.dialog;
var _ = require('underscore');

// Global Variables
const FIRST_TIME_SCORE = 5;
const SECOND_TIME_SCORE = 3;
const THIRD_TIME_SCORE = 1;
const CORRECT_ANS_SCORE = 10;
var questions = [];
var shuffledQuestions = [];
var numOfPinyinQuestions = 0;
var numOfDefQuestions = 0;
var numOfCharQuestions = 0;
var numOfPinyinQuestionsCorrect = 0;
var numOfDefQuestionsCorrect = 0;
var numOfCharQuestionsCorrect = 0;
var iterator = 0;
var testProgress = 0;
var currentTimerWidth = 100;
var numOfCorrectAns = 0;
var numOfIncorrectAns = 0;
var numOfIDunnos = 0;
var answerTimes = [];
var pinyinTimes = [];
var defTimes = [];
var charTimes = [];
var timerInterval;
var timerTimeout;

// Generate the score for the test session
function generateScore(ans, time) {
	let score = 0;
	if(ans == "correct") {
		score += CORRECT_ANS_SCORE;

		if(time >= 25) {
			score += FIRST_TIME_SCORE;
		}
		else if(time < 25 && time >= 20) {
			score += SECOND_TIME_SCORE;
		}
		else if(time < 20 && time >= 10) {
			score += THIRD_TIME_SCORE;
		}
	}

	return score;
}

// Determine random intenger from an interval and exclude a given index
function randomInt(min, max, exception) {
	var b = 0;
	var num;
	while(b == 0) {
		num = Math.floor(Math.random() *  (max - min + 1) + min);
		if(num != exception) {
			b = 1;
			break;
		}
	}

	return num;
}

// Determine random integer from an interval
function randomInt(min, max) {
	return num = Math.floor(Math.random() * (max - min + 1) + min);
}

// Handle what happens once the page has loaded here
$(document).ready(function() {
	// Grab all the words in bookmarks
	var db = new tingo.Db(path.join(__dirname, "../src/db/syng"), {});
	var bookmarksDb = db.collection("bookmarks");

	bookmarksDb.find().toArray(function(err, bookmarks) {
		if(err || bookmarks == undefined || bookmarks == null) {
			console.log("There was an error getting all the saved bookmarks.");
			console.log(err);
			dialog.showErrorBox("Error Getting Bookmarks", "There was an error getting the saved bookmarks. Error: "+err);
		}
		else {
			// If there are less than 4 bookmarks the program will be unable to generate a test
			// Alert the user that they will need more than 4 bookmarks
			if(bookmarks.length < 4) {
				dialog.showErrorBox("Too Few Bookmarks", "There must be at least 4 words saved to your bookmarks to generate a test.");
				ipc.send("close-test-window");
			}
			else {
				// Function to handle generattng questions based on the character of a word
				function generateCharacterQuestion(word, currentLocation) {
					var characterAnswers = []; // List of answers that will be displayed with the question

					// Give it a 50 / 50 chance on whether or not asking what it sounds like (pinyin) or what it means (definition)
					// 0 for pinyin and 1 for definition
					var ansType = Math.floor(Math.random() * 2);

					// The answer type will be pinyin
					if(ansType == 0) {
						// Add the correct pinyin to the list of answers
						characterAnswers.push(word.pronunciation);

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							var num = randomInt(0, bookmarks.length - 1, currentLocation);
							characterAnswers.push(bookmarks[num].pronunciation);
						}

						// Shuffle the list of answers
						var correctAns = word.pronunciation;
						var shuffledAnswers = _.shuffle(characterAnswers);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnswers.length; i++) {
							if(shuffledAnswers[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Generate the question itself
						let question = word.simplified+" ("+word.traditional+")";

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: shuffledAnswers,
							correctAnswer: correctIndex,
							question: question,
							questionType: "character"
						};

						numOfCharQuestions++;

						return questionObj;
					}
					else {
						// The anwer type will be a definition
						// Determine random index from the definitions of this word to pose as an answer
						var defIndex = randomInt(0, word.definitions.length - 1);
						characterAnswers.push(word.definitions[defIndex]);

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							let num = randomInt(0, bookmarks.length - 1, currentLocation);
							let incorrectDefIndex = randomInt(0, bookmarks[num].definitions.length - 1);
							characterAnswers.push(bookmarks[num].definitions[incorrectDefIndex]);
						}

						// Shuffle the list of answers
						var correctAns = word.definitions[defIndex];
						var shuffledAnswers = _.shuffle(characterAnswers);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnswers.length; i++) {
							if(shuffledAnswers[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Generate the question itself
						let question = word.simplified+" ("+word.traditional+")";

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: shuffledAnswers,
							correctAnswer: correctIndex,
							question: question,
							questionType: "character"
						};

						numOfCharQuestions++;

						return questionObj;
					}
				}

				// Function to handle generating questions based on the pinyin of a word
				function generatePinyinQuestion(word, currentLocation) {
					var pinyinAnswers = []; // List of ansswers that will be displayed with the question

					// Give it a 50 / 50 chance on whether or not asking what it means or asking what the character is
					// 0 for character, 1 for deinition
					var ansType = Math.floor(Math.random() * 2);

					if(ansType == 0) {
						// The answer will be character
						// Add the correct character to the list of answers
						pinyinAnswers.push(word.simplified+" ("+word.traditional+")");

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							var num = randomInt(0, bookmarks.length - 1, currentLocation);
							pinyinAnswers.push(bookmarks[num].simplified+" ("+bookmarks[num].traditional+")");
						}

						// Shuffle the list of answers
						var correctAns = word.simplified+" ("+word.traditional+")";
						var shuffledAnswers = _.shuffle(pinyinAnswers);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnswers.length; i++) {
							if(shuffledAnswers[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Generate the question itself
						let question = word.pronunciation;

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: shuffledAnswers,
							correctAnswer: correctIndex,
							question: question,
							quesetionType: "pinyin"
						};

						numOfPinyinQuestions++;

						return questionObj;
					}
					else {
						// The answer will be definitions
						// Determine random index from the definitions of this word to pose as an answer
						var defIndex = randomInt(0, word.definitions.length - 1);
						pinyinAnswers.push(word.definitions[defIndex]);

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							let num = randomInt(0, bookmarks.length - 1, currentLocation);
							let incorrectDefIndex = randomInt(0, bookmarks[num].definitions.length - 1);
							pinyinAnswers.push(bookmarks[num].definitions[incorrectDefIndex]);
						}

						// Shuffle the list of answers
						var correctAns = word.definitions[defIndex];
						var shuffledAnswers = _.shuffle(pinyinAnswers);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnswers.length; i++) {
							if(shuffledAnswers[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Generate the question itself
						let question = word.simplified+" ("+word.traditional+")";

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: shuffledAnswers,
							correctAnswer: correctIndex,
							question: question,
							questionType: "pinyin"
						};

						numOfPinyinQuestions++;

						return questionObj;
					}
				}

				// Function to handle generating questions based on the definitions of a word
				function generateDefQuestions(word, currentLocation) {
					var totalQuestionObj = [];
					for(var h = 0; h < word.definitions.length; h++) {
						var defAnswers = []; // List of answers that will be displayed to the user with the question

						// Give it a 50 / 50 chance on whether or not asking what it sounds like (pinyin) or what it looks like (character)
						// 0 for pinyin and 1 for character
						var ansType = Math.floor(Math.random() * 2);

						// The answerr type will be pinyin
						if(ansType == 0) {
							// Add the correct pinyin to the list of answers
							defAnswers.push(word.pronunciation);

							// Add the other three incorrect answers from the bookmarks dataset
							for(var i = 0; i < 3; i++) {
								var num = randomInt(0, bookmarks.length - 1, currentLocation);
								defAnswers.push(bookmarks[num].pronunciation);
							}

							// Shuffle the list of answers
							var correctAns = word.pronunciation;
							var shuffledAnswers = _.shuffle(defAnswers);

							// Determine the index of the correct answer
							var correctIndex;
							for(var i = 0; i < shuffledAnswers.length; i++) {
								if(shuffledAnswers[i] == correctAns) {
									correctIndex = i;
									break;
								}
							}

							// Generate the question itself
							let question = word.definitions[h];

							// Generate the question object
							let questionObj = {
								answers: shuffledAnswers,
								correctAnswer: correctIndex,
								question: question,
								questionType: "definition"
							};

							numOfDefQuestions++;

							totalQuestionObj.push(questionObj);
						}
						else {
							// The answers given will be character
							// Add the correct character to the list of answers
							defAnswers.push(word.simplified+" ("+word.traditional+")");

							/// Add the other three incorrect answers from the bookmarks dataset
							for(var i = 0; i < 3; i++) {
								var num = randomInt(0, bookmarks.length - 1, currentLocation);
								defAnswers.push(bookmarks[num].simplified+" ("+bookmarks[num].traditional+")");
							}

							// Shuffle the list of answers
							var correctAns = word.simplified+" ("+word.traditional+")";
							var shuffledAnswers = _.shuffle(defAnswers);

							// Determine the index of the correct answer
							var correctIndex;
							for(var i = 0; i < shuffledAnswers.length; i++) {
								if(shuffledAnswers[i] == correctAns) {
									correctIndex = i;
									break;
								}
							}

							// Generate the question itself
							let question = word.definitions[h];

							// Generate the question object
							let questionObj = {
								answers: shuffledAnswers,
								correctAnswer: correctIndex,
								question: question,
								questionType: "definition"
							};

							numOfDefQuestions++;

							totalQuestionObj.push(questionObj);
						}
					}

					return totalQuestionObj;
				}
				for(var i = 0; i < bookmarks.length; i++) {
					questions.push(generateCharacterQuestion(bookmarks[i], i));
					questions.push(generatePinyinQuestion(bookmarks[i], i));
					var defQuestions = generateDefQuestions(bookmarks[i], i);
					for(var x = 0; x < defQuestions.length; x++) {
						questions.push(defQuestions[x]);
					}

					shuffledQuestions = _.shuffle(questions);
				}

				processNext();
			}
		}
	});
});

// Function to handle what happens when the correct answer is clicked
function correctAnswer() {
	// Cancel Timer
	cancelTimer();

	// Collect Data About answer
	var currentTime = parseInt($("#timer-progress").width());
	answerTimes.push(currentTime);

	numOfCorrectAns++;

	var questionType = $("#questionType").html();
	if(questionType == "definition") {
		numOfDefQuestionsCorrect++;
		defTimes.push(currentTime);
	}
	else if(questionType == "pinyin") {
		numOfPinyinQuestionsCorrect++;
		pinyinTimes.push(currentTime);
	}
	else if(questionType == "character") {
		numOfCharQuestionsCorrect++;
		charTimes.push(currentTime);
	}

	// Hide Questions
	$("#questionCard").hide();
	$("#timer-progress").hide();
	$("#iDunnoButton").hide();

	$("#correctCard").show();

	// Display Answer
	displayAnswer();

	// Show Answer
	setTimeout(function() {
		$("#correctCard").hide();
		$("#answerCard").show();
		$("#continueButton").show();
	}, 500);
}

// Function to handle what happens when the incorrect answerr is clicked
function incorrectAnswer() {
	// Cancel Timer
	cancelTimer();

	// Hide Questions
	$("#questionCard").hide();
	$("#timer-progress").hide();
	$("#iDunnoButton").hide();

	$("#incorrectCard").show();

	//Display Answer
	displayAnswer();

	// Show Answer
	setTimeout(function() {
		$("#incorrectCard").hide();
		$("#answerCard").show();
		$("#continueButton").show();
	}, 500);
}

// OnClick Listerners, Event Handlers, and DOM Element Helper Functions
// Set the Width of the Timer Progress Bar, which counts down from seconds
function setTimerProgress(progress) {
	$("#timer-progress").attr("value", progress);
}

// Helper function to set the timer to start counting down from 30 seconds
function setTimer() {
	setTimerProgress(100);
	timerInterval = setInterval(function() {
		let currentTimerProgress = $("#timer-progress").attr("value");
		let newTimerProgress = (parseInt(currentTimerProgress) - 3.3);

		setTimerProgress(newTimerProgress);
	}, 1000);

	timerTimeout = setTimeout(function() {
		incorrectAnswer();
		clearInterval(timerInterval);
	}, 27000);
}

// Helper function to stop the timer when an answer has been clicked
function cancelTimer() {
	clearTimeout(timerTimeout);
	clearInterval(timerInterval);
}

// Set the value of the overall test progressbar
function setProgressValue(progress) {
	$("#test-progress").attr("value", progress);
}

// Process the next question
function processNext() {
	// Display the questions
	displayQuestion(shuffledQuestions[iterator]);
	$("#continueButton").hide();
	$("#iDunnoButton").show();
	$("#questionCard").show();

	//Increment iterator
	iterator++;

	// Increment the progressbar
	testProgress = (iterator / shuffledQuestions.length) * 100;
	setProgressValue(testProgress);

	$("#timer-progress").show();
	setTimer();
}

// The Toolbar button actions
$("#iDunnoButton").click(function() {
	// TODO: Write this
});
$("#continueButton").click(function() {
	$("#answerCard").hide();
	processNext();
});

// Display the question using html
function displayQuestion(question) {
	var questionHtml = "";
	for(var i = 0; i < question.answers.length; i++) {
		if(i == question.correctAnswer) {
			questionHtml += "<a href='#' class='ans-btn' onclick='correctAnswer()' id='correctAnswer'>"+question.answers[i]+"</a>";
		}
		else {
			questionHtml += "<a href='#' class='ans-btn' onclick='incorrectAnswer()'>"+question.answers[i]+"</a>";
		}
	}

	$("#questionsList").html(questionHtml);
	$("#questionSec").html(question.question);
	$("#questionType").html(question.questionType);
}

function displayAnswer() {
	let q = $("#questionSec").html();
	let a = $("#correctAnswer").html();

	$("#ansQuestionSec").html(q);
	$("#answerSec").html(a);
}
