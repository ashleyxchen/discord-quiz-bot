import { SlashCommandBuilder } from '@discordjs/builders';

const endCommand = new SlashCommandBuilder() 
    .setName('end')
    .setDescription('End blurt session')
    .addSubcommand((subCommand) => {
        return subCommand
            .setName('end')
            .setDescription('End current blurt session')
    })

    // add end session command
        // once session ends, spit back results, and attachment of text analysis vs answer
    // add skip question

    export default endCommand.toJSON()