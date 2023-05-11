import XLSX from 'xlsx';
import fs, { write } from 'fs';
import { emptyDir } from 'fs-extra';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL;

// ISSUE: file not being defined properly.
// Scope of firstFile needs to be redefined

const answerComparator = async (interaction, worksheet, userAnswer, keywords, rowNum, firstFile) => {
  const channel = interaction.channel.id;
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  var matchedKeywords = [];
  var grade = [];

  async function saveAnswerComparison(firstFile, channel, worksheet, matchedKeywords, keywords) {
    let matchedKeywordsCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })] || {};
    let percentageMatchedCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] || {};
    const arrMatchedKeywords = matchedKeywords.toLowerCase().split(', ');
    const arrKeywords = keywords.toLowerCase().split(', ');

    matchedKeywordsCell.v = matchedKeywords; // repetitive

    percentageMatchedCell.v = (arrMatchedKeywords.length / arrKeywords.length) * 100;
    worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })] = matchedKeywordsCell;
    worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] = percentageMatchedCell;

    console.log('matchedKeywordsCell value: ' + worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })].v + '\n\n');
    console.log('percentageMatchedCell value: ' + worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })].v + '\n\n');

    // add to workbook
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, worksheet, 'Sheet1');
    await emptyDir(`./src/keywordFiles/${channel}`)
      .then(() => {
        console.log(
          `Successfully deleted previous keyword files in ./src/keywordFiles/${channel}. Importing xlsx with the keywords`
        );
      })
      .catch((err) => {
        console.error(err);
      });

    XLSX.writeFile(newWb, `./src/keywordFiles/${channel}/${firstFile}`);
    console.log(`Successfully updated ${firstFile} with the matched keywords`);
  }

  async function compareUserAnswerToKeywords(keywords, userAnswer) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ` + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt:
          'Determine if the list of keywords ' +
          keywords +
          'are in the following text: \n\n' +
          userAnswer +
          '\n\n' +
          'Return the keywords that are in that text. Make the first letter of every keyword uppercase and separate with commas.',
        temperature: 0.5,
        max_tokens: 60,
        top_p: 1.0,
        frequency_penalty: 0.8,
        presence_penalty: 0.0,
      }),
    };

    // extract keywords and make new arr
    try {
      const response = await fetch(OPENAI_API_URL, options);
      const json = await response.json();

      const data = json.choices[0].text.trim();
      console.log(data);
      console.log(json.choices[0].text.trim());
      matchedKeywords = json.choices[0].text.trim();
    } catch (error) {
      console.error(error);
    }
    //   const arrKeywords = keywords.toLowerCase().split(', ');
    //   const arrUserAnswer = userAnswer.toLowerCase().split(' ');

    //   for (let i in arrKeywords) {
    //     if (arrUserAnswer.includes(arrKeywords[i])) {
    //       arrMatchedWords.push(arrKeywords[i]);
    //       console.log(arrMatchedWords);
    //     } // else add to unmatched words array?
    //   }
    // const arrMatchedKeywords = matchedKeywords.toLowerCase().split(', ');
    // matchedKeywords = arrMatchedKeywords.toString();
    console.log('matched keywords are: ' + matchedKeywords);
    return matchedKeywords;
  }

  async function writeAnswerComparison(firstFile, channel, worksheet, grade) {
    let feedbackCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] || {};
    feedbackCell.v = grade;

    worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })] = feedbackCell;
    console.log('feedbackCell value: ' + worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })].v + '\n\n');




    // add to workbook
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, worksheet, 'Sheet1');
    await emptyDir(`./src/keywordFiles/${channel}`)
      .then(() => {
        console.log(
          `Successfully deleted previous keyword files in ./src/keywordFiles/${channel}. Importing xlsx with the keywords`
        );
      })
      .catch((err) => {
        console.error(err);
      });

    XLSX.writeFile(newWb, `./src/keywordFiles/${channel}/${firstFile}`);
    console.log(`Successfully updated ${firstFile} with the matched keywords`);
  }

  async function compareUserAnswerToAnswer(worksheet, userAnswer, rowNum) {
    let question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;
    let actualAnswer = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })].v;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ` + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt:
          'Compare the my answer of the question to the actual answer . \n\n' +
          'Question: \n' +
          question +
          '\n\n' +
          'My answer: \n' +
          userAnswer +
          '\n\n' +
          'Actual answer: \n' +
          actualAnswer +
          '\n\n' +
          'Return if my answer is correct. If the my answer is partially correct, also add where my misunderstanding is.',
        temperature: 0.5,
        max_tokens: 60,
        top_p: 1.0,
        frequency_penalty: 0.8,
        presence_penalty: 0.0,
      }),
    };

    // extract keywords and make new arr
    try {
      const response = await fetch(OPENAI_API_URL, options);
      const json = await response.json();

      const data = json.choices[0].text.trim();
      console.log(data);
      console.log(json.choices[0].text.trim());
      grade = json.choices[0].text.trim();
    } catch (error) {
      console.error(error);
    }
    //   const arrKeywords = keywords.toLowerCase().split(', ');
    //   const arrUserAnswer = userAnswer.toLowerCase().split(' ');

    //   for (let i in arrKeywords) {
    //     if (arrUserAnswer.includes(arrKeywords[i])) {
    //       arrMatchedWords.push(arrKeywords[i]);
    //       console.log(arrMatchedWords);
    //     } // else add to unmatched words array?
    //   }
    // const arrMatchedKeywords = matchedKeywords.toLowerCase().split(', ');
    // matchedKeywords = arrMatchedKeywords.toString();
    console.log('the grade is: ' + grade);
    return grade;
  }
//   let matchedKeywordsFinal = await compareUserAnswerToKeywords(keywords, userAnswer);
//   await saveAnswerComparison(firstFile, channel, worksheet, matchedKeywordsFinal, keywords);
  let finalGrade = await compareUserAnswerToAnswer(worksheet, userAnswer, rowNum)
  await interaction.channel.send('Feedback: ' + finalGrade) // feedback sending too late 
  writeAnswerComparison(firstFile, channel, worksheet, grade)
  console.log(`Final grade for Question #${rowNum + 1}: ${finalGrade}`)
};

export default answerComparator;
