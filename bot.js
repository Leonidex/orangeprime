const Discord = require('discord.js');

const AUTH = require('./auth.json');
const CONSTANTS = require('./settings/constants.json');
const STRINGS = require('./settings/strings.json');
const URBAN_DICT = require('./urban-dictionary');
const COMMANDS = require('./settings/commands.json');
const FORMATTER = require('./formatter.js');

const fs = require('fs');
const VoiceHandlerClass = require('./voiceHandler.js');
const RolesHandlerClass = require('./rolesHandler.js');
const tools = require('./tools.js');
const newAudioList = require('./audio/new/listmp3.json');

var bot;
var voiceHandler;

var commandsQueue;
var commandExecutionIsReady;

/*
* Initialize the discord bot
* Main initialization function
*/
function initBot() {
	bot = new Discord.Client();
    voiceHandler = new VoiceHandlerClass();
    rolesHandler = new RolesHandlerClass(bot.guilds);

	initBotCommands();
	bot.login(AUTH.token).then().catch(console.error);
	bot.on('ready', () => {
		console.log(STRINGS.GENERAL.READY_MESSAGE);
        bot.user.setActivity(null);
        
        rolesHandler.init();
    });
    
    bot.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
        let user1 = rolesHandler.getActiveUser(oldVoiceState.member.user.id);
        let user2 = rolesHandler.getActiveUser(newVoiceState.member.user.id);

        if (!user1 || !user2) {
            let time = new Date().getTime();
            if (!user1) {
                rolesHandler.setActiveUser(oldVoiceState.member.user.id, time);
            }
            if (!user2) {
                rolesHandler.setActiveUser(newVoiceState.member.user.id, time);
            }

            await rolesHandler.writeActiveUsersLog();
        }
    });
}

/*
* Initialize the commands queue
*/
function initBotCommands() {
	commandsQueue = [];
	commandExecutionIsReady = true;

	bot.on('message', message => {
		commandsQueue.push(message);
	});

	setInterval(() => {
		if (commandsQueue.length > 0 && commandExecutionIsReady) {
			commandExecutionIsReady = false;
			executeCommand(commandsQueue.pop());
		}
	}, CONSTANTS.CONFIG.COMMANDS_QUEUE_CHECK_INTERVAL);
}

/*
* Execute a command, breaks down a message object to the command arguments and executes it accordingly
*/
function executeCommand(message) {
	var authorIsAdmin = isAdmin(message.author);
	var content = message.content.toLowerCase();
	if (message.channel.type == "text") {
		if (content.substring(0, CONSTANTS._PREFIX.length) == CONSTANTS._PREFIX) {
			try {
				var args = content.substring(CONSTANTS._PREFIX.length).split(' ');
				var cmd = args[CONSTANTS.INDICES.CMD_INDEX];

				args = args.splice(CONSTANTS.INDICES.ARGS_INDEX);
				//
				// Admin commands
				//
				if (authorIsAdmin) {
					switch (cmd) {
						case COMMANDS.ADMIN_GROUP.RESTART.call:
							bot.destroy();
							initBot();
							break;
						case COMMANDS.ADMIN_GROUP.PLAY_TRACK.call:
						case COMMANDS.ADMIN_GROUP.PLAY_TRACK.short:
							var channel_num = args[0];
							var msg_text = args[1];
							var channels = message.guild.channels.cache.filter(x => x.type === "voice").array();
							var fileAddress = tools.getFileAddressFromFileName(msg_text);

							if (channel_num >= 0 && channel_num < channels.length) {
								voiceHandler.playFile(channels[channel_num], fileAddress, message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(() => { commandExecutionIsReady = true });
							} else {
								message.channel.send(CONSTANTS.MESSAGES.INVALID_CHANNEL_NUM_MESSAGE).then(() => { commandExecutionIsReady = true });
							}
							break;
						case COMMANDS.ADMIN_GROUP.LEAVE.call:
							var vChannel = botIsInAVoiceChannelOfTheGuild(message.channel.guild);
							if (vChannel) {
								vChannel.connection.disconnect().on("finish", (end) => { commandExecutionIsReady = true });
							} else {
								message.channel.send(CONSTANTS.MESSAGES.NOT_IN_CHANNEL_MESSAGE).then(() => { commandExecutionIsReady = true });
							}
							break;
						case COMMANDS.ADMIN_GROUP.LIST_VOICE_CHANNELS.call:
							var botMessage = "";
							var channels = message.guild.channels.cache.filter(x => x.type === "voice").array();
							for (var i = 0; i < channels.length; i++) {
								botMessage += i + ":" + channels[i].name + "\n";
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
							break;
						case COMMANDS.ADMIN_GROUP.SAY.call:
							var msg_text = '';
							var channel_num = args[0];
							var channels = message.guild.channels.cache.filter(x => x.type === "voice").array();

							args.slice(1).forEach(element => {
								msg_text += element + ' ';
							});

							if (channel_num >= 0 && channel_num < channels.length) {
								var voiceChannel = channels[channel_num];
								var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
								voiceHandler.say(voiceChannel, msg_text, botChannel, bot.user).then(() => { commandExecutionIsReady = true });;
							}
							break;
						case COMMANDS.ADMIN_GROUP.TEST.call:
							message.channel.send(STRINGS.GENERAL.TEST_MESSAGE);
							break;
					}
				}

				switch (cmd) {
					//
					// Utility commands
					//
					case COMMANDS.UTIL_GROUP.HELP.call:
						botMessage = ''

						for (group in COMMANDS) {
							if (group == "ADMIN_GROUP") {
								if (authorIsAdmin) {
									botMessage = addCommandsGroupToString(group, STRINGS.COMMANDS.ADMIN_COMMANDS + botMessage);
									botMessage += STRINGS.COMMANDS.NORMAL_COMMANDS;
								}
							} else {	// Add all commands into the botMessage string.
								botMessage = addCommandsGroupToString(group, botMessage);
								botMessage += "\n";
							}
						}

						message.channel.send(CONSTANTS.FORMATTING.BOLD + STRINGS.COMMANDS.AVAILABLE_COMMANDS + CONSTANTS.FORMATTING.BOLD
							+ botMessage + "\n" + CONSTANTS.FORMATTING.HAIKU + "ini\n" + "[Call me by '" + CONSTANTS._PREFIX + "command']" + CONSTANTS.FORMATTING.HAIKU).then(() => { commandExecutionIsReady = true });
						break;
					// Ping
					case COMMANDS.UTIL_GROUP.PING.call:
						message.reply('Pong!').then(() => { commandExecutionIsReady = true });
						break;
					// Ching
					case COMMANDS.UTIL_GROUP.CHING.call:
						message.reply('Chong!').then(() => { commandExecutionIsReady = true });
						break;

					//	
					// Urban dictionary commands
					//
					case COMMANDS.UD_GROUP.URBAN_DICT.call:
					case COMMANDS.UD_GROUP.URBAN_DICT.short:
						var botMessage = '';
						var term = args[0];
						var entry_index = parseInt(args[1]);
						if (!entry_index || entry_index < 0) {
							entry_index = 0;
						}
						URBAN_DICT.term(term, function (error, entries, tags, sounds) {
							if (error) {
								botMessage = "Error: " + error.message;
							} else {
								botMessage = FORMATTER.format_ud(entries[entry_index]);
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
						});
						break;
					case COMMANDS.UD_GROUP.URBAN_DICT_RANDOM.call:
					case COMMANDS.UD_GROUP.URBAN_DICT_RANDOM.short:
						var botMessage = '';
						URBAN_DICT.random(function (error, entry) {
							if (error) {
								botMessage += error.message;
							} else {
								botMessage = FORMATTER.format_ud(entry);
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
						});
						break;

					//
					// Misc commands
					//
					case COMMANDS.MISC_GROUP.COFFEE.call:
						botMessage = CONSTANTS.FORMATTING.HAIKU + CONSTANTS.MESSAGES.COFFEE +
							CONSTANTS.FORMATTING.HAIKU;
						message.reply(botMessage).then(() => { commandExecutionIsReady = true });;
						break;

					//
					// Audio commands
					//
					case COMMANDS.AUDIO_GROUP.PLAY_TRACK.call:
					case COMMANDS.AUDIO_GROUP.PLAY_TRACK.short:
						var fileName = args[0];
						var fileAddress = tools.getFileAddressFromFileName(fileName);
						voiceHandler.playFile(message.member.voice.channel, fileAddress, message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(async () => { commandExecutionIsReady = true });;
						break;
					case COMMANDS.AUDIO_GROUP.PLAY_RANDOM.call:
					case COMMANDS.AUDIO_GROUP.PLAY_RANDOM.short:
						var items_list = [];
						fs.readdir(CONSTANTS.FILES.AUDIO_FOLDER_ADDRESS, async function (err, items) {
							if (err) {
								commandExecutionIsReady = true;
								throw err;
							}
							randomIndex = Math.floor(Math.random() * items.length);
							var fileAddress = CONSTANTS.FILES.AUDIO_FOLDER_ADDRESS + items[randomIndex];
							var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
							await voiceHandler.playFile(message.member.voice.channel, fileAddress, message, botChannel, bot.user).then(async () => { commandExecutionIsReady = true; });;
						});
						break;
					case COMMANDS.AUDIO_GROUP.PLAY_LIST.call:
					case COMMANDS.AUDIO_GROUP.PLAY_LIST.short:
						list_index = 0;	// Advances when the list is too long.
						var items_list = [];
						items_list[list_index] = CONSTANTS.FORMATTING.BOLD + 'Available audio files:\n\n' + CONSTANTS.FORMATTING.BOLD;
						var prefix = '';
						var addition = '';

						fs.readdir(CONSTANTS.FILES.AUDIO_FOLDER_ADDRESS, async function (err, items) {
							if (err) {
								commandExecutionIsReady = true;
								throw err;
							}
							for (var i = 0; i < items.length; i++) {
								var fileName = items[i].substring(0, items[i].lastIndexOf('.'));
								if (prefix.toUpperCase() == items[i][0].toUpperCase()) {
									addition = ", " + fileName;
								} else {
									prefix = items[i][0];
									addition = ".\n\n" + items[i][0].toUpperCase() + ": \n" + fileName;
								}

								if ((items_list[list_index] + addition).length > CONSTANTS.MESSAGES.MAX_MESSAGE_LENGTH) {
									list_index++;
									items_list[list_index] = '';
								}

								items_list[list_index] += addition;
							}
							items_list[list_index] += "."

							for (i = 0; i <= list_index; i++) {
								await message.channel.send(items_list[i]).then(() => { commandExecutionIsReady = true });
							}
						});
						break;
					case COMMANDS.AUDIO_GROUP.LIST_NEW.call:
					case COMMANDS.AUDIO_GROUP.LIST_NEW.short:
						new_list_index = 0;	// Advances when the list is too long.
						var new_items_list = [];
						new_items_list[new_list_index] = CONSTANTS.FORMATTING.BOLD + 'New audio files:\n\n' + CONSTANTS.FORMATTING.BOLD;
						var prefix = '';
						var addition = '';

						var newAudioArray = newAudioList.list_array;
						newAudioArray.sort((a,b) => {
							return a.toLowerCase()>b.toLowerCase()? 1: -1;
						});

						for (var i = 0; i < newAudioArray.length; i++) {
							var fileName = newAudioArray[i];
							if (prefix.toUpperCase() == newAudioArray[i][0].toUpperCase()) {
								addition = ", " + fileName;
							} else {
								prefix = newAudioArray[i][0];
								addition = ".\n\n" + newAudioArray[i][0].toUpperCase() + ": \n" + fileName;
							}

							if ((new_items_list[new_list_index] + addition).length > CONSTANTS.MESSAGES.MAX_MESSAGE_LENGTH) {
								new_list_index++;
								new_items_list[new_list_index] = '';
							}

							new_items_list[new_list_index] += addition;
						}
						new_items_list[new_list_index] += "."

						for (i = 0; i <= new_list_index; i++) {
							message.channel.send(new_items_list[i]).then(() => { commandExecutionIsReady = true });
						}
						break;
					case COMMANDS.AUDIO_GROUP.PLAY_STOP.call:
						voiceHandler.stop(message).then(() => { commandExecutionIsReady = true });;
						break;
					case COMMANDS.AUDIO_GROUP.PLAY_SKIP.call:
						voiceHandler.skip(message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(() => { commandExecutionIsReady = true });;
						break;
					case COMMANDS.AUDIO_GROUP.SAY.call:
						var msg_text = '';
						args.forEach(element => {
							msg_text += element + ' ';
						});
						
						var voiceChannel = message.member.voice.channel;
						var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
						voiceHandler.say(voiceChannel, msg_text, botChannel, bot.user).then(() => { commandExecutionIsReady = true });;
						
						break;
					default:
						commandExecutionIsReady = true;
						break;
				}
			} catch (err) {
				message.channel.send(CONSTANTS.MESSAGES.ERROR_MESSAGE)
				console.log(err);
			}
		}
	}
	commandExecutionIsReady = true;
}

/*
* Checks if the given user is the admin who's id is in the settings.
*/
function isAdmin(author) {
	return author.id == CONSTANTS.IDS.ADMIN_ID;
}

/*
* Adds a JSON group object to the given string
*/
function addCommandsGroupToString(cmdGroup, str) {
	str += CONSTANTS.FORMATTING.HAIKU + "ini\n" + cmdGroup + ":";
	Object.keys(COMMANDS[cmdGroup]).forEach(cmdObj => {
		str += '\n' + "[" + COMMANDS[cmdGroup][cmdObj].call + "]";
		if (COMMANDS[cmdGroup][cmdObj].short) {
			str += '/' + "[" + COMMANDS[cmdGroup][cmdObj].short + "]";
		}
		str += ': ' + COMMANDS[cmdGroup][cmdObj].description;
	});
	return str + CONSTANTS.FORMATTING.HAIKU;
}

/*
* Checks if the bot is in the given channel.
* Returns the voiceChannel object if it is or null if it's not.
*/
function botIsInTheVoiceChannel(voiceChannel) {
	if (bot.voiceConnections != null) {
		bot.voiceConnections.forEach(vConnection => {
			if (vConnection.channel.guild === voiceChannel) {
				return vConnection.channel;
			}
		});
	}
	return null;
}

/*
* Checks if the bot is connected to a voice channel in the given guild.
* Returns the voiceChannel object if it is or null if it's not.
*/
function botIsInAVoiceChannelOfTheGuild(guild) {
	if (bot.voice.connections != null) {
		bot.voice.connections.forEach(vConnection => {
			if (vConnection.channel.guild === guild) {
				return vConnection.channel;
			}
		});
	}
	return null;
}

// Start
initBot();