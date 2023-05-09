import { SlashCommandBuilder } from '@discordjs/builders';

const setDeckCommand = new SlashCommandBuilder()
  .setName('setdeck')
  .setDescription('Create a new deck')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('Set your deck name')
      .setRequired(true)
  )
  .addAttachmentOption((option) => {
    return option
      .setName('attachment')
      .setDescription('Attach a file')
      .setRequired(true);
  })
  .addChannelOption((option) => {
    return option
      .setName('channel')
      .setDescription('Set channel for the deck')
      .setRequired(true);
  })

export default setDeckCommand.toJSON();
