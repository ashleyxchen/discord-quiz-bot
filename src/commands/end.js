import { SlashCommandBuilder } from '@discordjs/builders';

const endCommand = new SlashCommandBuilder() 
    .setName('end')
    .setDescription('End blurt session')
    .addSubcommand((subCommand) => {
        return subCommand
            .setName('end')
            .setDescription('End current blurt session')
    })

    export default endCommand.toJSON()