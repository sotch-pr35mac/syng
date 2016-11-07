/*
* @File		:: test-bookmarks-rewrite.js
* @Author	:: Preston Stosur-Bassett
* @Description	:: This file handles all the logic for creating and displaying generated tests
* @Created	:: Nov 5, 2016
*/

'use strict';

// Required Dependencies
var ipc = require('electron').ipcRenderer; // For communication with the main process
var tingo = require('tingodb')(); // Mong-style database
var path = require('path');
var dialog = require('electron').remote.dialog;
var logger = require('../src/log/debug.js');

// Turn Debugging On
logger.turnDebugOff();

// Global Variables
const FIRST_TIME_SCORE = 5; // The score for answer in the first time slot
const SECOND_TIME_SCORE = 3; // The score for answering in the second time slot
const THIRD_TIME_SCORE = 1; // The score for answering just before time runs out (the thrid time slot)
const CORRECT_ANS_SCORE = 10; // The score to award for getting the correct answer
var questions = []; // An array of all the questions generated in order
var shuffledQuestions = []; // An array of all the questions generated in random order
var numOfPinyinQ = 0; // The number of pinyin questions
var numOfDefQ = 0; // The number of definition questions
var numOfCharQ = 0; // The number of character questions
var numOfPinyinQC = 0; // The number of pinyin questions answered correctly
var numOfDefQC = 0; // The number of definition questions answered correctly
var numOfCharQC = 0; // The number of character questions answered correctly
var iterator = 0; // The iterator for the questions being displayed
var testProgress = 0; // The value of the progress bar for the progression through the question
var currentTimerWidth = 100; // The width of the timer bar
var numOfAnsC = 0; // Number of total anwers correct
var numOfAnsI = 0; // Number of total answers answered incorrectly
var numOfAnsU = 0; // Number of total answers answered with 'I dont know'
var answerTimes = []; // A set of the times it took to answer the questions
var pinyinTimes = []; // A set of time it took to answer pinyin questions
var defTimes = []; // A set of times it took to answer definition questions
var charTimes = []; // A set of times it took to answer character questions
var timerInterval;
var timerTimeout;
var grandScore = 0;

// Generate score for the test session
function tallyScore(time) {
	grandScore += CORRECT_ANS_SCORE;

	if(time >= 25) {
		grandScore += FIRST_TIME_SCORE;
	}
	else if(time < 25 && time >= 20) {
		grandScore += SECOND_TIME_SCORE;
	}
	else if(time < 20 && time >= 10) {
		grandScore += THIRD_TIME_SCORE;
	}
}

// Determine random integer from an interval and exclude a given index
function randomIntWException(min, max, exception) {
	var b = 0;
	var num;
	while(b == 0) {
		num = Math.floor(Math.random() * (max - min) + min);
		logger.debug("num: "+num+"... exception: "+exception);
		if(num != exception) {
			b = 1;
			break;
		}
	}

	return num;
}

// Determine random integer from an interval
function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

// Shuffle the contetns of an array
function shuffler(array) {
	var j, x, i;
	for(i = array.length; i; i--) {
		j = Math.floor(Math.random() * i);
		x = array[i - 1];
		array[i - 1] = array[j];
		array[j] = x;
	}

	return array;
}

// Handle what happens once the page has loaded here
$(document).ready(function() {
	// Grab all the words in the bookmarks
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
			if(bookmarks.length < 4) {
				dialog.showErrorBox("Too Few Bookmarks", "There must be at least 4 words saved to your bookmarks to generate a test.");
				ipc.send("close-test-window");
			}
			else {
				// The object with all the generator functions to generate answers
				var generateAnswers = {
					pinyin: function(word, currentLocation) {
						var ansList = []; // The list of answers

						// Add the correct answers
						ansList.push(word.pronunciation);

						// Add the other three incorrect answer from the bookmarks
						for(var i = 0; i < 3; i++) {
							var num = randomIntWException(0, bookmarks.length - 1, currentLocation);
							if(bookmarks[num].pronunciation == word.pronuciation) {
								logger.debug("There is going to be a duplicate in the answers...");
								logger.debug("Bookmark index: "+num+"... Current location: "+currentLocation);
							}
							ansList.push(bookmarks[num].pronunciation);
						}

						// Shuffle the list of answers
						var correctAns = word.pronunciation;
						var shuffledAnsList = shuffler(ansList);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnsList.length; i++) {
							if(shuffledAnsList[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Return the shuffled list of answers and the correct answer index
						let ansObj =  {
							list: shuffledAnsList,
							correctIndex: correctIndex
						};

						return ansObj;
 					},
					definition: function(word, currentLocation) {
						var ansList = []; // The list of answers
						word.defArray = word.definitions.split(",");

						// Determine random index from the defintions of this word to pose as an answer
						var defIndex = randomInt(0, word.defArray.length - 1);
						ansList.push(word.defArray[defIndex]);

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							var num = randomIntWException(0, bookmarks.length - 1, currentLocation);
							bookmarks[num].defArray = bookmarks[num].definitions.split(",");
							if(bookmarks[num].defArray[defIndex] == word.defArray[defIndex]) {
								logger.debug("There is going to be a duplicate in the answers...");
								logger.debug("Bookmark index: "+num+".... Current Location: "+currentLocation);
							}
							let incorrectDefIndex = randomInt(0, bookmarks[num].defArray.length - 1);
							ansList.push(bookmarks[num].defArray[incorrectDefIndex]);
						}

						// Shuffle the list of answers
						var correctAns = word.defArray[defIndex];
						var shuffledAnsList = shuffler(ansList);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnsList.length; i++) {
							if(shuffledAnsList[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Return the shuffled list of answers and the correct answer index
						let ansObj = {
							list: shuffledAnsList,
							correctIndex: correctIndex
						};

						return ansObj;
					},
					character: function(word, currentLocation) {
						var ansList = []; // The list of answers

						// Add the correct character to the list of answers
						ansList.push(word.simplified+" ("+word.traditional+")");

						// Add the other three incorrect answers from the bookmarks dataset
						for(var i = 0; i < 3; i++) {
							var num = randomIntWException(0, bookmarks.length, currentLocation);
							if(bookmarks[num].traditional == word.traditional) {
								logger.debug("There is going to be a duplicate in the answers...");
								logger.debug("Bookmarks index: "+num+"... Current location: "+currentLocation);
							}
							ansList.push(bookmarks[num].simplified+" ("+bookmarks[num].traditional+")");
						}

						// Shuffle the list of answers
						var correctAns = word.simplified+" ("+word.traditional+")";
						var shuffledAnsList = shuffler(ansList);

						// Determine the index of the correct answer
						var correctIndex;
						for(var i = 0; i < shuffledAnsList.length; i++) {
							if(shuffledAnsList[i] == correctAns) {
								correctIndex = i;
								break;
							}
						}

						// Return the shuffled list of answers and the correct answer index
						let ansObj = {
							list: shuffledAnsList,
							correctIndex: correctIndex
						};

						return ansObj;
					}
				};

				// The object with all the generator functions to generate questions
				var generateQuestion = {
					character: function(word, currentLocation) {
						var ansObj; // The object that will hold information returned from the generation of answers functions

						// Give it a 50 / 50 chance on whether or not asking what it sounds like (pinyin) or what it mean (definition)
						// 0 for pinyin and 1 for definition
						var ansType = Math.floor(Math.random() * 2);

						if(ansType == 0) {
							// The answer type will be pinyin
							ansObj = generateAnswers.pinyin(word, currentLocation);
						}
						else if(ansType == 1) {
							// The answer type will be definition
							ansObj = generateAnswers.definition(word, currentLocation);
						}

						// Generate the question itself
						let question = word.simplified+" ("+word.traditional+")";

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: ansObj.list,
							correctAnswer: ansObj.correctIndex,
							question: question,
							questionType: "character"
						};

						numOfCharQ++;

						logger.debug("Here comes the question object");
						logger.debug(questionObj);

						return questionObj;
					},
					pinyin: function(word, currentLocation) {
						var ansObj; // The object that will hold inforation returned from the generated answers

						// Give it a 50 / 50 chance on whether or not asking what it means or what the character is
						// 0 for character, 1 for definition
						var ansType = Math.floor(Math.random() * 2);

						if(ansType == 0) {
							// The answer type will be characters
							ansObj = generateAnswers.character(word, currentLocation);
						}
						else if(ansType == 1){
							// The answer type will be definitions
							ansObj = generateAnswers.definition(word, currentLocation);
						}

						// Generate the question itself
						let question = word.pronunciation;

						// Generate the question object and return it to the calling function
						let questionObj = {
							answers: ansObj.list,
							correctAnswer: ansObj.correctIndex,
							question: question,
							questionType: "pinyin"
						};

						numOfPinyinQ++;

						logger.debug("Here comes the question object");
						logger.debug(questionObj);

						return questionObj;
					},
					definition: function(word, currentLocation) {
						var allDefQs = []; // An array containing all the definition question objects created from one word
						word.defArray = word.definitions.split(",");
						for(var h = 0; h < word.defArray.length; h++) {
							var ansObj; // The object that will hold information returned from the generated answers

							// Give it a 50 / 50 chance on whether or not asking what it means or what the character is
							// 0 for character, 1 for pinyin
							var ansType = Math.floor(Math.random() * 2);

							if(ansType == 0) {
								// The answer type will be characters
								ansObj = generateAnswers.character(word, currentLocation);
							}
							else if(ansType == 1) {
								// The answer type will be pinyin
								ansObj = generateAnswers.pinyin(word, currentLocation);
							}

							// Generate the question itself
							let question = word.defArray[h];

							let questionObj = {
								answers: ansObj.list,
								correctAnswer: ansObj.correctIndex,
								question: question,
								questionType: "definition"
							};

							numOfDefQ++;

							allDefQs.push(questionObj);
						}

						return allDefQs;
					}
				};

				for(var i = 0; i < bookmarks.length; i++) {
					questions.push(generateQuestion.character(bookmarks[i], i));
					questions.push(generateQuestion.pinyin(bookmarks[i], i));
					var defQuestions = generateQuestion.definition(bookmarks[i], i);
					for(var x = 0; x < defQuestions.length; x++) {
						questions.push(defQuestions[x]);
					}

					logger.debug("!!! BEGIN QUESTIONS !!!");
					logger.debug(questions);
					logger.debug("!!! END QUESTIONS !!!");

					shuffledQuestions = shuffler(questions);

					logger.debug("!!! BEGIN SHUFFLEDQUESTIONS !!!");
					logger.debug(shuffledQuestions);
					logger.debug("!!! END SHUFFLEDQUESTION !!!");
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

	// Collect Data About Answer
	var currentTime = parseInt($("#timer-progress").width());
	answerTimes.push(currentTime);

	numOfAnsC++;

	tallyScore(currentTime);

	var questionType = $("#questionType").html();
	if(questionType == "definition") {
		numOfDefQC++;
		defTimes.push(currentTime);
	}
	else if(questionType == "pinyin") {
		numOfPinyinQC++;
		pinyinTimes.push(currentTime);
	}
	else if(questionType == "character") {
		numOfCharQC++;
		charTimes.push(currentTime);
	}

	// Hide Questions
	$("#questionCard").hide();
	$("#timer-progress").hide();
	$("#iDunnoButton").hide();

	$("#correctCard").show();

	// Display answer
	display.answer();

	// Show Answers
	setTimeout(function() {
		$("#correctCard").hide();
		$("#answerCard").show();
		$("#continueButton").show();
	}, 500);
}

// Function to handle what happens when the incorrect answer is clicked
function incorrectAnswer() {
	// Cancel Timer
	cancelTimer();

	numOfAnsI++;

	// Hide Questions
	$("#questionCard").hide();
	$("#timer-progress").hide();
	$("#iDunnoButton").hide();

	$("#incorrectCard").show();

	//Display Answer
	display.answer();

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

// Handle the display of questions and answers to the DOM
var display = {
	questions: function(question) {
		logger.debug(question);
		var questionHtml = "";
		for(var i = 0; i < question.answers.length; i++) {
			if(i == question.correctAnswer) {
				questionHtml += "<a href='#' class='ans-btn' onclick='correctAnswer()' id='correctAnswer'>"+question.answers[i]+"</a>";
			}
			else {
				questionHtml += "<a href'#' class='ans-btn' onclick='incorrectAnswer()'>"+question.answers[i]+"</a>";
			}
		}

		$("#questionsList").html(questionHtml);
		$("#questionSec").html(question.question);
		$("#questionType").html(question.questionType);
	},
	answer: function() {
		let q = $("#questionSec").html();
		let a =  $("#correctAnswer").html();

		$("#ansQuestionSec").html(q);
		$("#answerSec").html(a);
	},
	score: function() {
		$("#continueButton").hide();
		$("#answerCard").hide();
		$("#scoreInfo").html("Syng Score: "+grandScore);
		var scorePercent = Math.round(((numOfAnsC / questions.length) * 100) * 100) / 100;
		$("#scorePercent").html("Percent: "+scorePercent+"%");
		$("#scoreCard").show();
		$("#exitButton").show();
	}
};


// The Toolbar button actions
$("#iDunnoButton").click(function() {
	// Cancel Timer
	cancelTimer();

	numOfAnsU++;

	// Hide Questions
	$("#questionCard").hide();
	$("#timer-progress").hide();
	$("#iDunnoButton").hide();

	$("#iDunnoCard").show();

	//Display Answer
	display.answer();

	// Show Answer
	setTimeout(function() {
		$("#iDunnoCard").hide();
		$("#answerCard").show();
		$("#continueButton").show();
	}, 500);
});
$("#continueButton").click(function() {
	$("#answerCard").hide();
	processNext();
});
$("#exitButton").click(function() {
	ipc.send("close-test-window");
});

// Process the next question
function processNext() {
	// Check to see if the test is over
	if($("#test-progress").val() < 100) {
		// Display the questions
		display.questions(shuffledQuestions[iterator]);
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
	else {
		// The test is over, display the score
		// TODO: Display analytics
		display.score();
	}
}
