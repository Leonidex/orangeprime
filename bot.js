const Discord = require('discord.js');
const auth = require('./auth.json');
const constants = require('./settings/constants.json');
const urban_dict = require('./urban-dictionary');
const commands = require('./settings/commands.json');
const fs = require('fs');
const VoiceHandlerClass = require('./voiceHandler.js');
const tools = require('./tools.js');

var bot;
var voiceHandler;

var commandsQueue;
var commandExecutionIsReady;

// Initialize Discord Bot
function botInit() {
	bot = new Discord.Client();
	voiceHandler = new VoiceHandlerClass();
	initBotCommands();
	bot.login(auth.token).then().catch(console.error);
	bot.on('ready', () => {
		console.log('Bot is ready!');
		bot.user.setGame(null);
	});
}

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
	}, constants.CONFIG.COMMANDS_QUEUE_CHECK_INTERVAL);
}

function executeCommand(message) {
	var authorIsAdmin = isAdmin(message.author);
	var content = message.content.toLowerCase();
	if (message.channel.type == "text") {
		if (content.substring(0, constants._PREFIX.length) == constants._PREFIX) {
			try {
				var args = content.substring(constants._PREFIX.length).split(' ');
				var cmd = args[constants.INDICES.CMD_INDEX];

				args = args.splice(constants.INDICES.ARGS_INDEX);
				//
				// Admin
				//
				if (authorIsAdmin) {
					switch (cmd) {
						case commands.ADMIN_GROUP.RESTART.call:
							bot.destroy();
							botInit();
							break;
						case commands.ADMIN_GROUP.PLAY_TRACK.call:
						case commands.ADMIN_GROUP.PLAY_TRACK.short:
							var channel_num = args[0];
							var msg_text = args[1];
							var channels = message.guild.channels.filter(x => x.type === "voice").array();
							var fileAddress = tools.getFileAddressFromFileName(msg_text);

							if (channel_num >= 0 && channel_num < channels.length) {
								voiceHandler.playFile(channels[channel_num], fileAddress, message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(() => { commandExecutionIsReady = true });
							} else {
								message.channel.send(constants.MESSAGES.INVALID_CHANNEL_NUM_MESSAGE).then(() => { commandExecutionIsReady = true });
							}
							break;
						case commands.ADMIN_GROUP.LEAVE.call:
							var vChannel = botIsInAVoiceChannelOfTheGuild(message.channel.guild);
							if (vChannel) {
								vChannel.connection.disconnect().on("end", (end) => { commandExecutionIsReady = true });
							} else {
								message.channel.send(constants.MESSAGES.NOT_IN_CHANNEL_MESSAGE).then(() => { commandExecutionIsReady = true });
							}
							break;
						case commands.ADMIN_GROUP.LIST_VOICE_CHANNELS.call:
							var botMessage = "";
							var channels = message.guild.channels.filter(x => x.type === "voice").array();
							for (var i = 0; i < channels.length; i++) {
								botMessage += i + ":" + channels[i].name + "\n";
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
							break;
						case commands.ADMIN_GROUP.SAY.call:
							var msg_text = '';
							var channel_num = args[0];
							var channels = message.guild.channels.filter(x => x.type === "voice").array();

							args.slice(1).forEach(element => {
								msg_text += element + ' ';
							});

							if (channel_num >= 0 && channel_num < channels.length) {
								var voiceChannel = channels[channel_num];
								var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
								if (voiceChannel != null) {
									if (botChannel == null || botChannel != voiceChannel) {
										voiceChannel.join().then(connection => {
											this.connection = connection;
											this.stopped = false;
											this.audioIsReady = false;
											bot.user.setGame('Trump: ' + '"' + msg_text + '"');
											connection.playArbitraryInput("async:http://api.jungle.horse/speak?v=trump&vol=7&s=" + encodeURIComponent(msg_text))
												.on("end", end => {
													this.audioIsReady = true;
													voiceChannel.leave();
													bot.user.setGame(null);
													commandExecutionIsReady = true;
												});
										}).catch(err => { console.error(err) });
									}
								}
								break;
							}
					}
				}

				switch (cmd) {
					//
					// Utility
					//
					case commands.UTIL_GROUP.HELP.call:
						botMessage = ''

						for (group in commands) {
							if (group == "ADMIN_GROUP") {
								if (authorIsAdmin) {
									botMessage = addCommandsGroupToString(group, "\n\nAdmin Commands:\n" + botMessage);
									botMessage += "\nPeasants Commands:\n";
								}
							} else {	// Add all commands into the botMessage string.
								botMessage = addCommandsGroupToString(group, botMessage);
								botMessage += "\n";
							}
						}

						message.channel.send(constants.FORMATTING.BOLD + 'The available commands are:' + constants.FORMATTING.BOLD
							+ botMessage + "\n" + constants.FORMATTING.HAIKU + "ini\n" + "[Call me by '" + constants._PREFIX + "command']" + constants.FORMATTING.HAIKU).then(() => { commandExecutionIsReady = true });
						break;
					// Ping
					case commands.UTIL_GROUP.PING.call:
						message.reply('Pong!').then(() => { commandExecutionIsReady = true });
						break;
					// Ching
					case commands.UTIL_GROUP.CHING.call:
						message.reply('Chong!').then(() => { commandExecutionIsReady = true });
						break;

					//	
					// Urban dictionary
					//
					case commands.UD_GROUP.URBAN_DICT.call:
					case commands.UD_GROUP.URBAN_DICT.short:
						botMessage = ''
						term = args[0]
						entry_index = args[1]
						if (!Number.isInteger(entry_index) || entry_index < 0) {
							entry_index = 0
						}
						urban_dict.term(term, function (error, entries, tags, sounds) {
							if (error) {
								botMessage = "Error: " + error.message
							} else {
								botMessage = format_ud(entries[entry_index]);
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
						});
						break;
					case commands.UD_GROUP.URBAN_DICT_RANDOM.call:
					case commands.UD_GROUP.URBAN_DICT_RANDOM.short:
						botMessage = ''
						urban_dict.random(function (error, entry) {
							if (error) {
								botMessage += error.message
							} else {
								botMessage = format_ud(entry);
							}
							message.channel.send(botMessage).then(() => { commandExecutionIsReady = true });
						});
						break;

					//
					// Misc
					//
					case commands.MISC_GROUP.COFFEE.call:
						botMessage = constants.FORMATTING.HAIKU + constants.MESSAGES.COFFEE +
							constants.FORMATTING.HAIKU;
						message.reply(botMessage).then(() => { commandExecutionIsReady = true });;
						break;

					//
					// Audio
					//
					case commands.AUDIO_GROUP.PLAY_TRACK.call:
					case commands.AUDIO_GROUP.PLAY_TRACK.short:
						var fileName = args[0];
						var fileAddress = tools.getFileAddressFromFileName(fileName);
						voiceHandler.playFile(message.member.voiceChannel, fileAddress, message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(() => { commandExecutionIsReady = true });;
						break;
					case commands.AUDIO_GROUP.PLAY_RANDOM.call:
					case commands.AUDIO_GROUP.PLAY_RANDOM.short:
						var items_list = [];
						fs.readdir(constants.FILES.AUDIO_FOLDER_ADDRESS, async function (err, items) {
							if (err) {
								commandExecutionIsReady = true;
								throw err;
							}
							randomIndex = Math.floor(Math.random() * items.length);
							var fileAddress = constants.FILES.AUDIO_FOLDER_ADDRESS + items[randomIndex];
							var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
							await voiceHandler.playFile(message.member.voiceChannel, fileAddress, message, botChannel, bot.user).then(() => { commandExecutionIsReady = true });;
						});
						break;
					case commands.AUDIO_GROUP.PLAY_LIST.call:
					case commands.AUDIO_GROUP.PLAY_LIST.short:
						list_index = 0;	// Advances when the list is too long.
						var items_list = [];
						items_list[list_index] = constants.FORMATTING.BOLD + 'Available audio files:\n\n' + constants.FORMATTING.BOLD;
						var prefix = '';
						var addition = '';

						fs.readdir(constants.FILES.AUDIO_FOLDER_ADDRESS, async function (err, items) {
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

								if ((items_list[list_index] + addition).length > constants.MESSAGES.MAX_MESSAGE_LENGTH) {
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
					case commands.AUDIO_GROUP.PLAY_STOP.call:
						voiceHandler.stop(message).then(() => { commandExecutionIsReady = true });;
						break;
					case commands.AUDIO_GROUP.PLAY_SKIP.call:
						voiceHandler.skip(message, botIsInAVoiceChannelOfTheGuild(message.guild), bot.user).then(() => { commandExecutionIsReady = true });;
						break;
					case commands.AUDIO_GROUP.SAY.call:
						var msg_text = '';
						args.forEach(element => {
							msg_text += element + ' ';
						});

						var voiceChannel = message.member.voiceChannel;
						var botChannel = botIsInAVoiceChannelOfTheGuild(message.guild);
						if (voiceChannel != null) {
							if (botChannel == null || botChannel != voiceChannel) {
								voiceChannel.join().then(connection => {
									this.connection = connection;
									this.stopped = false;
									this.audioIsReady = false;
									bot.user.setGame('Trump: ' + '"' + msg_text + '"');
									connection.playArbitraryInput("async:http://api.jungle.horse/speak?v=trump&vol=7&s=" + encodeURIComponent(msg_text))
										.on("end", end => {
											this.audioIsReady = true;
											voiceChannel.leave();
											bot.user.setGame(null);
											commandExecutionIsReady = true;
										});
								}).catch(err => { console.error(err) });
							}
						}
						break;
					default:
						commandExecutionIsReady = true;
						break;
				}
			} catch (err) {
				message.channel.send(constants.MESSAGES.ERROR_MESSAGE)
				console.log(err);
			}
		}
	}
	commandExecutionIsReady = true;
}

/*
Checks if the given user is the admin who's id is in the settings.
*/
function isAdmin(author) {
	return author.id == constants.IDS.ADMIN_ID;
}

/*
Adds a JSON group object to the given string
*/
function addCommandsGroupToString(cmdGroup, str) {
	str += constants.FORMATTING.HAIKU + "ini\n" + cmdGroup + ":";
	Object.keys(commands[cmdGroup]).forEach(cmdObj => {
		str += '\n' + "[" + commands[cmdGroup][cmdObj].call + "]";
		if (commands[cmdGroup][cmdObj].short) {
			str += '/' + "[" + commands[cmdGroup][cmdObj].short + "]";
		}
		str += ': ' + commands[cmdGroup][cmdObj].description;
	});
	return str + constants.FORMATTING.HAIKU;
}

/*
Checks if the bot is in the given channel.
Returns the voiceChannel object if it is or null if it's not.
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
Checks if the bot is connected to a voice channel in the given guild.
Returns the voiceChannel object if it is or null if it's not.
*/
function botIsInAVoiceChannelOfTheGuild(guild) {
	if (bot.voiceConnections != null) {
		bot.voiceConnections.forEach(vConnection => {
			if (vConnection.channel.guild === guild) {
				return vConnection.channel;
			}
		});
	}
	return null;
}

// Start
botInit();