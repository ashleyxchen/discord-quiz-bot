import { Client, GatewayIntentBits, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { config } from 'dotenv';
import setDeckCommand from './commands/setDeck.js';
import runDeckCommand from './commands/runDeck.js';
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
  if (fs.existsSync(`./src/files/${channel}`)) {
    await emptyDir(`./src/files/${channel}`)
      .then(() => {
        console.log(`Successfully deleted previous keyword files in ./src/files/${channel}`);
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
        .pipe(fs.createWriteStream(`./src/files/${channel}/${name}.xlsx`))
        .on('close', () => {
          console.log(`Successfully added to ./src/files/${channel}/${name}.xlsx`);
          resolve();
        });
    });
  } else {
    return new Promise((resolve, reject) => {
      fs.mkdir(`./src/files/${channel}`, (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          request
            .get(url)
            .on('error', (err) => {
              reject(err);
            })
            .pipe(fs.createWriteStream(`./src/files/${channel}/${name}.xlsx`))
            .on('close', () => {
              console.log(`Successfully added to ./src/files/${channel}/${name}.xlsx`);
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

      async function downloadAndExtractKeywords(url, name, channel) {
        await download(url, name, channel);
      }

      downloadAndExtractKeywords(url, name, channel, interaction);

      interaction.reply({
        content: `Your deck "${interaction.options.get('name').value}" is in channel "${
          interaction.options.get('channel').channel
        }."`,
      });
    }

    if (interaction.commandName === 'end') {
      interaction.reply({
        content: `Blurt Session for deck "${interaction.options.get('name').value}" has ended`,
      });
    }
  }
});

let interactionState = '';
let firstFile;

async function getFile(interaction) {
  let channel = interaction.channel.id;

  if (fs.existsSync(`./src/files/${channel}`)) {
    const files = await new Promise((resolve, reject) => {
      fs.readdir(`./src/files/${channel}`, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    }).catch((err) => {
      console.error(err);
      return null;
    });

    firstFile = files[0];

    let workbook = XLSX.readFile(`./src/files/${channel}/${firstFile}`);
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

      try {
        let worksheet = await getFile(interaction);
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        console.log(range);

        // Iterate through questons
        for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
          let question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;

          await interaction.channel.send('Question #' + rowNum + ': ' + question);

          const filterAnswer = (m) => m.content.startsWith('/a');
          const filterEnd = (m) => m.content.startsWith('/end');
          let doBreak = false;

          const userAnswer = await interaction.channel.awaitMessages({
            filter: filterAnswer,
            max: 1,
            time: 300000,
          });

          // endAnswer = interaction.channel.awaitMessages({
          //   filter: filterEnd,
          //   max: 1,
          //   time: 300000,
          // });

          // console.log(endAnswer)

          const endAnswer = interaction.channel.awaitMessages({
            filter: filterEnd,
            max: 1,
            time: 300000,
          });

          // Wait for both promises to resolve
          await Promise.all([userAnswer, endAnswer]).then((results) => {
            const userMessage = results[0].first(); // Get the first (and only) message in userAnswer
            const endMessage = results[1].first(); // Get the first (and only) message in endAnswer

            if (endMessage && endMessage.content.startsWith('/end')) {
              console.log('User ended the quiz.');
              doBreak = true;
            } else {
              console.log('User did not end the quiz.');
              // Do something else here
            }
          });

          if (!userAnswer.size) {
            await interaction.followUp('Time is up! Next question.');
            continue;
          }

          // if (endAnswer != '') {
          //   console.log('broken!!!');
          //   break;
          // }

          if (doBreak == true) {
            interaction.channel.send(`Your blurt session in ${interaction.channel} has ended.`);
            break;
          }

          const answer = userAnswer.first().content.slice(3);

          async function getAnswerAndCompare(interaction, rowNum, answer, firstFile) {
            let worksheet = await getFile(interaction);

            if (worksheet === null) {
              console.log('Error: worksheet is null.');
              return;
            }

            let feedback = await answerComparator(interaction, worksheet, answer, rowNum, firstFile);
            interaction.channel.send('Feedback: ' + feedback);
          }

          await getAnswerAndCompare(interaction, rowNum, answer, firstFile);
        }
      } catch (err) {
        console.log(err);
      }

      interaction.channel.send(`Your blurt session in ${interaction.channel} has finished.`);
    }
  }
});

async function main() {
  const commands = [setDeckCommand, runDeckCommand];

  try {
    console.log('Started refreshing application (/) commands.');
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
