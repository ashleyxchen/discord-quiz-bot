import XLSX from 'xlsx';
import fs from 'fs';
import { emptyDir } from 'fs-extra';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL;

const keywordExtractor = async (file, interaction) => {
  const channel = interaction.options.get('channel').value;
  const name = interaction.options.get('name').value;
  const workbook = XLSX.readFile(file);

  const worksheet = workbook.Sheets['Sheet1'];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  console.log(range);
  var keywords = [];

  for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
    console.log('rowNum: ' + rowNum);

    let answerCell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })];
    let keywordsCell =
      worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })] || {};

    let answer = '';
    let colKeywords = '';

    if (answerCell && answerCell.v) {
      answer = answerCell.v;
    }


    // openai api
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ` + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt:
          'Extract keywords from this text. Make the first letter of every word uppercase and separate with commas:\n\n' +
          answer +
          '',
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
      keywords = json.choices[0].text.trim();
    } catch (error) {
      console.error(error);
    }
      
    colKeywords = keywords; // repetitive??
    keywordsCell.v = colKeywords;

    worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })] = keywordsCell;
  }

  // export new file with keywords col filled
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

  XLSX.writeFile(
    newWb,
    `./src/files/${channel}/${name}.xlsx`
  );
  console.log(
    `Successfully updated ./src/files/${channel}/${name}.xlsx with the keywords`
  );

};

export default keywordExtractor;
