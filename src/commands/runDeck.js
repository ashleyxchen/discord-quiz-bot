import { SlashCommandBuilder } from '@discordjs/builders';

const runDeckCommand = new SlashCommandBuilder() 
    .setName('rundeck')
    .setDescription('Start blurt session')

export default runDeckCommand.toJSON();
 
