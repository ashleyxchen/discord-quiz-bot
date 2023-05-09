import { SlashCommandBuilder } from '@discordjs/builders';

const orderCommand = new SlashCommandBuilder()
    .setName('setdeck')
    .setDescription('Create a new deck')
    .addStringOption((option) =>
      option.setName('name').setDescription('Add your deck name')
    )
    .addStringOption((option) => 
    option.setName('drink').setDescription('Select your fav drink').addChoices(
        {
          name: 'coke',
          value: 'coke'
        },
        {
          name: 'sprite',
          value: 'sprite'
        }
      )
    )
    // .addAttachmentOption((option) => {
    //     option
    //         .setName('attachment')
    //         .setDescription('Attach a file')
    //         .setRequired(true);
    //     })

    export default orderCommand.toJSON();