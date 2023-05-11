import XLSX from 'xlsx';
import fs, { write } from 'fs';
import { emptyDir } from 'fs-extra';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL;

const answerComparator = async (interaction, worksheet, userAnswer, rowNum, firstFile) => {
  const channel = interaction.channel.id;
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  var feedback = [];

  
  async function saveAnswerComparison(firstFile, channel, worksheet, grade) {
    let feedbackCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] || {};
    feedbackCell.v = grade;

    worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] = feedbackCell;
    console.log('feedbackCell value: ' + worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })].v + '\n\n');

    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, worksheet, 'Sheet1');
    await emptyDir(`./src/files/${channel}`)
      .then(() => {
        console.log(
          `Successfully deleted previous keyword files in ./src/files/${channel}. Importing xlsx with the keywords`
        );
      })
      .catch((err) => {
        console.error(err);
      });

    XLSX.writeFile(newWb, `./src/files/${channel}/${firstFile}`);
    console.log(`Successfully updated ${firstFile} with the matched keywords`);
  }

  async function compareUserAnswerToAnswer(worksheet, userAnswer, rowNum) {
    let question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;
    let answerCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })];
    let actualAnswer = answerCell && answerCell.v ? answerCell.v : '';

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
      const response = await fetch(OPENAI_API_URL, options);
      const json = await response.json();
      const data = json.choices[0].text.trim();
      console.log(data);
      console.log(json.choices[0].text.trim());
      feedback = json.choices[0].text.trim();
    } catch (error) {
      console.error(error);
    }

    return feedback;
  }
  let finalFeedback = await compareUserAnswerToAnswer(worksheet, userAnswer, rowNum)
  saveAnswerComparison(firstFile, channel, worksheet, finalFeedback)
  console.log(`Feedback for Question #${rowNum + 1}: ${finalFeedback}`)
  return finalFeedback
};

export default answerComparator;
