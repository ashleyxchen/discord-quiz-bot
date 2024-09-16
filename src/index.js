import { Client, GatewayIntentBits, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import { config } from 'dotenv';
import setDeckCommand from './commands/setDeck.js';
import runDeckCommand from './commands/runDeck.js';
import answerComparator from './components/answerComparator.js';
import XLSX from 'xlsx';
import Deck from './models/Deck.js';
import Question from './models/Question.js';
import User from './models/User.js';

config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;

// start client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

// start db
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

client.on('ready', () => {
  console.log(`${client.user.tag} has logged in`);
});

async function downloadAndSaveDeck(url, name, channelId, userId) {
  // download the file
  const response = await fetch(url);
  const buffer = await response.buffer();

  // parse the XLSX file
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Sheet1'];
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  const questions = [];
  for (let rowNum = range.s.r + 1; rowNum <= range.e.r; rowNum++) {
    const question = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })].v;
    const correctAnswer = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })].v;

    const newQuestion = new Question({
      question: question,
      correctAnswer: correctAnswer,
    });
    await newQuestion.save();

    questions.push(newQuestion._id); // Store question IDs
  }

  const newDeck = new Deck({
    name: name,
    channelId: channelId,
    questions: questions,
  });
  await newDeck.save();

  let user = await User.findOne({ discordId: userId });
  if (!user) {
    user = new User({
      discordId: userId,
      username: interaction.user.username,
      studyDecks: [],
    });
  }
  user.studyDecks.push(newDeck._id);
  await user.save();

  console.log(`Successfully saved deck "${name}" to MongoDB for channel ${channelId}`);
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'setdeck') {
    const channelId = interaction.options.get('channel').value;
    const name = interaction.options.get('name').value;
    const url = interaction.options.getAttachment('attachment').url;
    const userId = interaction.user.id;

    await downloadAndSaveDeck(url, name, channelId, userId);

    interaction.reply(
      `Your deck "${name}" is saved in MongoDB for channel "${interaction.options.get('channel').channel}".`
    );
  }
});

async function getDeckFromDB(channelId, userId) {
  if (userId) {
    const user = await User.findOne({ discordId: userId }).populate('studyDecks');
    if (user && user.studyDecks.length > 0) {
      return user.studyDecks;
    }
  }

  const deck = await Deck.findOne({ channelId: channelId }).populate('questions');
  if (!deck) {
    console.log('No deck found in MongoDB for channel:', channelId);
    return null;
  }
  return deck;
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.commandName === 'rundeck') {
    interaction.reply(`The blurt session for ${interaction.channel} will begin`);

    const deck = await getDeckFromDB(interaction.channel.id, interaction.user.id);
    if (!deck) {
      interaction.reply(`No deck found for this channel or user.`);
      return;
    }

    const questions = deck.questions;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i].question;
      const questionId = questions[i]._id;

      await interaction.channel.send(`Question #${i + 1}: ${question}`);

      const filterAnswer = (m) => m.content.startsWith('/a');
      let doBreak = false;

      const userAnswer = await interaction.channel.awaitMessages({
        filter: filterAnswer,
        max: 1,
        time: 300000,
      });

      if (!userAnswer.size) {
        await interaction.followUp('Time is up! Next question.');
        continue;
      }

      const answer = userAnswer.first().content.slice(3);

      // call answerComparator with the questionId and save feedback
      const feedback = await answerComparator(interaction, questionId, answer);

      interaction.channel.send(`Feedback for your answer: ${feedback}`);
    }

    interaction.channel.send(`Your blurt session in ${interaction.channel} has finished.`);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'end' && interaction.options.getSubcommand() === 'session') {
    await interaction.reply({
      content: 'Blurt session has ended. Your results are saved in the inputted sheet',
    });
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
