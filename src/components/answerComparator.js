import XLSX from 'xlsx';
import fs, { write } from 'fs';
import { emptyDir } from 'fs-extra';
import { createRequire } from 'module';
import Question from './models/Question.js';

const require = createRequire(import.meta.url);
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL;


const compareUserAnswerToAnswer = async (questionId, userAnswer) => {
  // fetch the question from MongoDB using the questionId
  const question = await Question.findById(questionId);

  if (!question) {
    console.error('Question not found in MongoDB.');
    return 'Error: Question not found.';
  }

  const actualAnswer = question.correctAnswer;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ` + OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt:
        'Compare the my answer of the question to the correct answer . \n\n' +
        'Question: \n' +
        question +
        '\n\n' +
        'My answer: \n' +
        userAnswer +
        '\n\n' +
        'Correct answer: \n' +
        actualAnswer +
        '\n\n' +
        'Return if my answer is correct.' + 
        'If there is no correct answer provided, compare my answer to that you would answer to the question.' + 
        'If the my answer is partially correct, also add where my misunderstanding is.',
      temperature: 0.5,
      max_tokens: 60,
      top_p: 1.0,
      frequency_penalty: 0.8,
      presence_penalty: 0.0,
    }),
  };

  try {
    // send the request to OpenAI
    const response = await fetch(process.env.OPENAI_API_URL, options);
    const json = await response.json();
    const feedback = json.choices[0].text.trim();

    console.log(`Feedback: ${feedback}`);
    return feedback;
  } catch (error) {
    console.error('Error comparing answers:', error);
    return 'Error comparing answers.';
  }
};


const answerComparator = async (interaction, questionId, userAnswer) => {
  const feedback = await compareUserAnswerToAnswer(questionId, userAnswer);

  // find/create user in db
  let user = await User.findOne({ discordId: interaction.user.id });
  if (!user) {
    user = new User({
      discordId: interaction.user.id,
      username: interaction.user.username,
      studyDecks: [],
    });
  }

  // add answer/feedback to user
  user.scores.push({
    deckId: interaction.options.get('deckId').value,  
    questionId: questionId, 
    answer: userAnswer,
    correct: feedback.includes('correct'),
    feedback: feedback,
  });

  await user.save();

  return feedback;
};

export default answerComparator;
