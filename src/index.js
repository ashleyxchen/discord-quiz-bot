import { Client, GatewayIntentBits, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { config } from 'dotenv';
import setDeckCommand from './commands/setDeck.js';
import runDeckCommand from './commands/runDeck.js';
import keywordExtractor from './components/keywordExtractor.js';
import answerComparator from './components/answerComparator.js';
import request from 'request';
import fs from 'fs';
import { emptyDir } from 'fs-extra';
import XLSX from 'xlsx';

config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', () => {
  console.log(`${client.user.tag} has logged in`);
});

// TODO: condense download function
async function download(url, name, channel) {
  if (fs.existsSync(`./src/keywordFiles/${channel}`)) {
    await emptyDir(`./src/keywordFiles/${channel}`)
      .then(() => {
        console.log(`Successfully deleted previous keyword files in ./src/keywordFiles/${channel}`);
      })
      .catch((err) => {
        console.error(err);
      });

    return new Promise((resolve, reject) => {
      request
        .get(url)
        .on('error', (err) => {
          reject(err);
        })
        .pipe(fs.createWriteStream(`./src/keywordFiles/${channel}/${name}_keywordFile.xlsx`))
        .on('close', () => {
          console.log(`Successfully added to ./src/keywordFiles/${channel}/${name}_keywordFile.xlsx`);
          resolve();
        });
    });
  } else {
    return new Promise((resolve, reject) => {
      fs.mkdir(`./src/keywordFiles/${channel}`, (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          request
            .get(url)
            .on('error', (err) => {
              reject(err);
            })
            .pipe(fs.createWriteStream(`./src/keywordFiles/${channel}/${name}_keywordFile.xlsx`))
            .on('close', () => {
              console.log(`Successfully added to ./src/keywordFiles/${channel}/${name}_keywordFile.xlsx`);
              resolve();
            });
        }
      });
    });
  }
}

client.on('interactionCreate', (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setdeck') {
      console.log('Creating new deck command');
      let channel = interaction.options.get('channel').value;
      let name = interaction.options.get('name').value;
      let url = interaction.options.getAttachment('attachment').url;

      console.log('the attachment url is ' + interaction.options.getAttachment('attachment').url);

      async function downloadAndExtractKeywords(url, name, channel, interaction) {
        await download(url, name, channel);
        await keywordExtractor(`./src/keywordFiles/${channel}/${name}_keywordFile.xlsx`, interaction);
      }

      downloadAndExtractKeywords(url, name, channel, interaction);

      interaction.reply({
        content: `Your deck "${interaction.options.get('name').value}" is in channel "${
          interaction.options.get('channel').channel
        }."`,
      });
    }

    // if (interaction.commandName === 'rundeck') {
    // async function askQuestion(message, question, keywords) {
    //   await message.channel.send('Question #' + rowNum + ': ' + question);
    //   try {
    //     const response = await message.channel.awaitMessages({
    //       filter,
    //       max: 1,
    //       time: 30000,
    //       errors: ['time'],
    //     });
    //     // run comparator
    //     answerComparator(response.first().content, keywords);
    //   } catch {
    //     await message.channel.send("Time's up");
    //   }
    // }
    // // iterate through questions
    // }
    // run subcommands

    // start the blurt session
    // set boolean to true sessionActive

    // interaction.reply({
    //   content: 'Blurt Session for deck' +  interaction.options.get('name').value + ' will begin now.'
    // });

    // loop questions and intake answers

    if (interaction.commandName === 'end') {
      // add condition statement to check is session is Active
      interaction.reply({
        content: `Blurt Session for deck "${interaction.options.get('name').value}" has ended`,
        // print results here too
      });
    }
  }
});

let interactionState = '';
let firstFile;

async function getFile(interaction) {
  let channel = interaction.channel.id;

  if (fs.existsSync(`./src/keywordFiles/${channel}`)) {
    const files = await new Promise((resolve, reject) => {
      fs.readdir(`./src/keywordFiles/${channel}`, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    }).catch((err) => {
      console.error(err);
      return null;
    });

    firstFile = files[0];
    console.log('This is the first file: ' + firstFile);

    let workbook = XLSX.readFile(`./src/keywordFiles/${channel}/${firstFile}`);
    let worksheet = workbook.Sheets['Sheet1'];
    return worksheet;
  } else {
    console.log('File not found.');
    return null;
  }
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'rundeck') {
      interaction.reply(`The blurt session for ${interaction.channel} will begin`);
      interactionState = 'awaitingAnswer';

      // 1) get file contents
      try {
        let worksheet = await getFile(interaction);

        // await getFile(interaction, workbook, worksheet);
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        console.log(range);

        // 2) iterate through questons

        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;
          console.log(question);

          let keywords = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })].v;
          console.log('worksheet in index: ' + worksheet);

          // await askQuestion(interaction, message, question, keywords, rowNum);
          await interaction.channel.send('Question #' + rowNum + ': ' + question);
          const filter = (m) => m.content.startsWith('/a');
          const userAnswer = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 300000, // 5 minutes for answer
          });

          if (!userAnswer.size) {
            await interaction.followUp('Time is up! Next question.');
            break;
          }

          const answer = userAnswer.first().content.slice(3);
          await interaction.followUp(`You answered: ${answer}`);

          console.log('first file prior to calling answer comparator: ' + firstFile);

          // TO DO: need to mock logic like keyword extractor with download() & downloadAndExtractKeywords
          async function getAndCompareKeywords(interaction, rowNum, keywords, answer, firstFile) {
            let worksheet = await getFile(interaction);

            if (worksheet === null) {
              console.log('Error: worksheet is null.');
              return;
            }

            await answerComparator(interaction, worksheet, answer, keywords, rowNum, firstFile);
            
          }

          getAndCompareKeywords(interaction, rowNum, keywords, answer, firstFile);
        }
      } catch (err) {
        console.log(err);
      }

      interaction.channel.send(`Your blurt session in ${interaction.channel} has ended.`);
    }
  }
});

async function main() {
  const commands = [setDeckCommand, runDeckCommand];

  try {
    console.log('Started refreshing application (/) commands.');
    // Routes.applicationGuildCommand()
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    client.login(TOKEN);
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

main();

// client.on('messageCreate', (message) => {
//   console.log('this is the message content' + message.content);
//   if (message.attachments.first()) {
//     console.log(message.attachments.first().url);
//     download(message.attachments.first().url);
//   }
// });

// client.on('messageCreate', async (message) => {
//   let rowNum;
//   console.log(message.content);
//   if (message.content.startsWith('/rundeck')) {
//     console.log(message.content);
//     console.log(message.channel.id);
//     if (fs.existsSync(`./src/keywordFiles/${message.channel.id}`)) {
//       let firstFile;

//       // get file
//       fs.readdir(`./src/keywordFiles/${message.channel.id}`, (err, files) => {
//         if (err) {
//           console.log(err);
//         } else {
//           firstFile = files[0];
//           console.log(firstFile);
//         }
//       });

//       // xlsx set up
//       const workbook = XLSX.readFile(firstFile); // let off here. firstFile undfined.
//       const worksheet = workbook.Sheets['Sheet1'];
//       const range = XLSX.utils.decode_range(worksheet['!ref']); //grabs number of rows and col in sheet
//       console.log(range);

//       // iterate through questions
//       for (rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
//         let question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;
//         let keywords = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })].v;

//         await askQuestion(message, question, keywords);
//       }
//     }
//   }

// async function askQuestion(interaction, question, rowNum) {
//   await interaction.channel.send('Question #' + rowNum + ': ' + question);

//   // try {
//   //   const response = await message.channel.awaitMessages({
//   //     filter,
//   //     max: 1,
//   //     time: 30000,
//   //     errors: ['time'],
//   //   });

//   //   // run comparator
//   //   answerComparator(response.first().content, keywords);
//   // } catch {
//   //   await message.channel.send("Time's up");
//   // }
// }

// get file
// fs.readdir(
//   `./src/keywordFiles/${interaction.channel.id}`,
//   (err, files) => {
//     if (err) {
//       console.log(err);
//     } else {
//       firstFile = files[0];
//       console.log('This is the first file from fs: ' + firstFile);
//     }
//   }
// );
// console.log('This is the first file: ' + firstFile);

// 3) end session
// const filter2 = (m) => m.content.startsWith('/end');
// if (interaction.content.startsWith('/end')) {
//   rowNum = range.e.r + 1; // end blurt session
//   interaction.channel.send(
//     `Blurt session for deck in channel ${interaction.channel} has ended. `
//   );
// }

// const answer = interaction.message.content.substring(2);

// async function askQuestion(interaction, question, rowNum) {
//   await interaction.channel.send('Question #' + rowNum + ': ' + question);

//   try {
//     const response = await message.channel.awaitMessages({
//       filter,
//       max: 1,
//       time: 30000,
//       errors: ['time'],
//     });

//     // run comparator
//     answerComparator(response.first().content, keywords);
//   } catch {
//     await message.channel.send("Time's up");
//   }
// }
