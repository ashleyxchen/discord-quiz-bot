import { SlashCommandBuilder } from '@discordjs/builders';

const answerCommand = new SlashCommandBuilder()
  .setName('a')
  .setDescription('Your answer')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('Set your deck name')
      .setRequired(true)
  )

// const attachment = interaction.options.get('attachment').value;

export default setDeckCommand.toJSON();
