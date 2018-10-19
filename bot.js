const Discord = require('discord.js');
const auth = require('./auth.json');
const settings = require('./settings.json');
const urban_dict = require('./urban-dictionary');
const fs = require('fs')
//const orange_formatter = require('./formatter.js');

HAIKU = '```'
BOLD = '**'

CMD_INDEX = 0
ARGS_INDEX = 1


var commands = {

	ADMIN_GROUP: {
		// Text Channel Commands
		RESTART: {call: 'restart', description: 'Restart the bot.'},
	},

	UTIL_GROUP: {
		HELP: {call: 'help', description: 'Get the list of available commands.'},

		// Text Channel Commands
		PING: {call: 'ping', description: 'Ping!'},
	},

	UD_GROUP: {
		// Urban Dictionary
		URBAN_DICT: {call: 'urban', short: 'ud', description: 'Urban Dictionary search.'},
		URBAN_DICT_RANDOM: {call: 'urbanr', short: 'udr', description: 'Urban Dictionary random article.'},
	},

	MISC_GROUP: {
		// Coffee!
		COFFEE: {call: 'coffee', description: "One hot beverage coming up."},
	},

	AUDIO_GROUP: {
		//Audio
		PLAY_TRACK: {call: 'play', short: 'pl', description: "Plays an audio track."},
		PLAY_RANDOM: {call: 'playrandom', short:'plr', description: "Random tracks, random tracks everywhere."},
		PLAY_LIST: {call: 'playlist', short: 'pll', description: "Lists available audio tracks."},
		PLAY_SKIP: {call: 'skip', description: "Skippity skip."},
		PLAY_STOP: {call: 'stop', description: "Stop. Hammer time."}
	}
};

ERROR_MESSAGE = 'Oops, something went wrong.';
JOIN_CHANNEL_ERROR_MESSAGE = 'Seems like I cannot join the channel :(';

AUDIO_FOLDER_ADDRESS = "./audio/";
AUDIO_SUFFIX = ".mp3";

var voice_handler = [];

MAX_MESSAGE_LENGTH = 2000;

// Initialize Discord Bot
const bot = new Discord.Client();
var audioIsReady;
var playQueue;

bot.on('ready', () => {
	console.log('Bot is ready!')
	audioIsReady = true;
	playQueue = [];
});

bot.on('message', message => {
	// Are they even talking to me?
	content = message.content.toLowerCase();
	if (content.substring(0, settings.prefix.length) == settings.prefix) {
		try {
			var args = content.substring(settings.prefix.length).split(' ');
			var cmd = args[CMD_INDEX];

			args = args.splice(ARGS_INDEX);

			switch(cmd) {
				//
				// Admin
				//
				case commands.ADMIN_GROUP.RESTART.call:
					// No implementation yet
				break;

				//
				// Utility
				//
				case commands.UTIL_GROUP.HELP.call:
				    botMessage = ''

					for (group in commands) {
						if (group == "ADMIN_GROUP") {	// Skip the admin commands.
							continue;
						} else {	// Add all commands into the botMessage string.
					    	Object.keys(commands[group]).forEach(cmdObj => {
						    	botMessage += '\n' + "[" + commands[group][cmdObj].call + "]";
						    	if (commands[group][cmdObj].short) {
						    		botMessage += '/' + "[" + commands[group][cmdObj].short + "]";
						    	}
						    	botMessage += ': ' + commands[group][cmdObj].description;
						    });

						    botMessage +="\n";
						}
				    }
				    
					message.channel.send(BOLD + 'The available commands are:' + BOLD
						 + "\n" + HAIKU + "ini\n" + botMessage
						 + "\n" + "[Call me by '"+ settings.prefix + "command']" + HAIKU);
					break;
				// Ping
				case commands.UTIL_GROUP.PING.call:
				    message.reply('Pong!');
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
				    urban_dict.term(term, function(error, entries, tags, sounds) {
				        if (error) {
				            botMessage = "Error: " + error.message
				        } else {
				            botMessage = format_ud(entries[entry_index]);
				        }
				        message.channel.send(botMessage);
				    })
					break;
				case commands.UD_GROUP.URBAN_DICT_RANDOM.call:
				case commands.UD_GROUP.URBAN_DICT_RANDOM.short:
				    botMessage = ''
				    urban_dict.random(function(error, entry) {
				        if (error) {
				            botMessage += error.message
				        } else {
				            botMessage = format_ud(entry);
				        }
				        message.channel.send(botMessage);
				    })
					break;

				//
				// Misc
				//
				case commands.MISC_GROUP.COFFEE.call:
					botMessage = HAIKU +
						'\n' + '                        (' +
						'\n' + '                          )     (' +
						'\n' + '                   ___...(-------)-....___' +
						'\n' + '               .-..       )    (          ..-.' +
						'\n' + '         .-.``.|-._             )         _.-|' +
						'\n' + '        |  .--.|   `..---...........---..`   |' +
						'\n' + '       |  |    |                             |' +
						'\n' + '       |  |    |                             |' +
						'\n' + '        |  |   |                             |' +
						'\n' + '         `| `| |                             |' +
						'\n' + '           `| `|                             |' +
						'\n' + '           _| ||                             |' +
						'\n' + '          (__|  |                           |' +
						'\n' + '       _..---..` |                         |`..---.._' +
						'\n' + '    .-.           |                       |          .-.' +
						'\n' + '   :               `-.__             __.-.              :' +
						'\n' + '   :                  ) ..---...---.. (                 :' +
						'\n' + '    .._               `.--...___...--.`              _..' +
						'\n' + '      |..--..__                              __..--..|' +
						'\n' + '       .._     ...----.....______.....----...     _..' +
						'\n' + '          `..--..,,_____            _____,,..--..`' +
						'\n' + '                        `...----...' +
						HAIKU;
			        message.reply(botMessage);
			        break;

		        //
		        // Audio
		        //
		        case commands.AUDIO_GROUP.PLAY_TRACK.call:
		        case commands.AUDIO_GROUP.PLAY_TRACK.short:
		        	var fileName = args[0];
		        	var fileAddress = AUDIO_FOLDER_ADDRESS + fileName + AUDIO_SUFFIX;
	        		playFile(fileAddress, message);
		        	break;
        		case commands.AUDIO_GROUP.PLAY_RANDOM.call:
        		case commands.AUDIO_GROUP.PLAY_RANDOM.short:
        			var items_list = [];
	        		fs.readdir(AUDIO_FOLDER_ADDRESS, function(err, items) {
	        			randomIndex = Math.floor(Math.random() * items.length);
		        		var fileAddress = AUDIO_FOLDER_ADDRESS + items[randomIndex];
	        			playFile(fileAddress, message);
	        		});
	        		break;
	        	case commands.AUDIO_GROUP.PLAY_LIST.call:
	        	case commands.AUDIO_GROUP.PLAY_LIST.short:
	        		list_index = 0;	// Advances when the list is too long.
	        		var items_list = [];
	        		items_list[list_index] = BOLD + 'Available audio files:\n\n' + BOLD;
	        		var prefix = '';
	        		var addition = '';

	        		fs.readdir(AUDIO_FOLDER_ADDRESS, function(err, items) {
	        			for (var i=0; i<items.length; i++) {
	        				var fileName = items[i].substring(0, items[i].lastIndexOf('.'));
	        				if (prefix.toUpperCase() == items[i][0].toUpperCase()) {
	        					addition = ", " + fileName;
	        				} else {
	        					prefix = items[i][0];
	        					addition = ".\n\n" + items[i][0].toUpperCase() + ": \n" + fileName;
	        				}

	        				if ((items_list[list_index] + addition).length > MAX_MESSAGE_LENGTH) {
	        					list_index++;
	        					items_list[list_index] = '';
	        				}

	        				items_list[list_index] += addition;
	        			}
	        			items_list[list_index] += "."

	        			for (i=0; i<=list_index; i++) {
        					//console.log(items_list[i]);
	        				message.channel.send(items_list[i]);
	        			}
	        		});
	        		break;
	        	case commands.AUDIO_GROUP.PLAY_STOP.call:
	        		if (stopped) {
	        			message.channel.send("Playback is already stopped.");
	        		} else {
	        			stopped = true;
	        			playQueue = []
		        		if (voice_handler.dispatcher != null) {
		        			voice_handler.dispatcher.end();
	        				voice_handler.dispatcher = null;
		        		}
	        		}
	        		break;
	        	case commands.AUDIO_GROUP.PLAY_SKIP.call:
	        		if (voice_handler.dispatcher != null) {
	        			voice_handler.dispatcher.end();
	        			voice_handler.dispatcher = null;
	        			if (playQueue.length > 0) {
	        				playFile(popFromQueue(), message);
	        			} else {
	        				stopped = true;
	        			}
	        		} else {
	        			message.channel.send("There is nothing being played.");
	        		}
	        		break;
			}
		} catch (err) {
			message.channel.send(ERROR_MESSAGE)
			console.log(err);
		}
	}
});

/*
Plays a file by a given address and the message object.
*/
function playFile(fileAddress, message) {
	if (audioIsReady) {
		var voiceChannel = message.member.voiceChannel;
		//console.log("PlayFile FileAddress = " + fileAddress);
		checkIfFile(fileAddress, function(err, isFile) {
			if (isFile) {
    			playFileHelper(voiceChannel, fileAddress);
    		} else {
    			var _fileAddress = fileAddress.substring(0, fileAddress.indexOf(AUDIO_SUFFIX));
    			_fileAddress = _fileAddress + "1" + AUDIO_SUFFIX;
    			var _fileName = _fileAddress.substring(_fileAddress.lastIndexOf("/")+1, fileAddress.indexOf(AUDIO_SUFFIX));
    			message.channel.send("(Actually... The correct spelling is " + _fileName + "1" + ")");
				checkIfFile(_fileAddress, function(_err, _isFile) {
					if (_isFile) {
		    			playFileHelper(voiceChannel, _fileAddress);
		    		} else {
						//console.log("Is NOT file: " + fileAddress);
		    			message.channel.send("What are these lies?? There is no such file!");
	    			}
    			});
    		}
    	});
	} else {
		addToQueue(fileAddress);
		message.channel.send("Track queued, position in queue: " + (playQueue.length));//Please wait a bit, my monkeys are tired.");
	}
}

function playFileHelper(voiceChannel, fileAddress) {
	if (bot.channel == null) {
		voiceChannel.join().then(connection => {
			voice_handler.connection = connection;
			stopped = false;
			audioIsReady = false;
			const dispatcher = connection.playFile(fileAddress);
			voice_handler.dispatcher = dispatcher;
			dispatcher.on("end", end => {
				audioIsReady = true;
				//console.log("playQueue.length = " + playQueue.length);
    			if (playQueue.length > 0) {
    				playFile(popFromQueue(), message);
				} else {
    				voiceChannel.leave();
					voice_handler.dispatcher = null;
				}
			});
		}).catch(err => {
			message.channel.send(JOIN_CHANNEL_ERROR_MESSAGE);
			console.log(err)
		});
	} else {
		stopped = false;
		audioIsReady = false;
		if (voice_handler.connection == null) {
			voice_handler.connection = bot.channel;
		}
		const dispatcher = voice_handler.connection.playFile(fileAddress);
		voice_handler.dispatcher = dispatcher;
		dispatcher.on("end", end => {
			if (playQueue.length > 0) {
				playFile(popFromQueue(), message);
			} else {
				audioIsReady = true;
				voiceChannel.leave();
				voice_handler.dispatcher = null;
			}
		});
	}
}

/* 
Adds a file's address to the play queue.
 */
function addToQueue(fileAddress) {
	playQueue[playQueue.length] = fileAddress;		        		
}

/* 
Removes the first in file's address from the play queue,
and orders the queue.
 */
function popFromQueue() {
	fileAddress = playQueue[0]
	//console.log("File Address = " + fileAddress);
	for (i=0; i<playQueue.length; i++) {
		playQueue[i] = playQueue[i+1];
	}

	playQueue.splice(playQueue.length - 1)
	return fileAddress;
}

function checkIfFile(file, cb) {
  fs.stat(file, function fsStat(err, stats) {
    if (err) {
      if (err.code === 'ENOENT') {
        return cb(null, false);
      } else {
        return cb(err);
      }
    }
    return cb(null, stats.isFile());
  });
}

// Shouldn't be here!
function format_ud(entry) {
	message = '\n**Term:**\n' + entry.word + '\n\n'
    message += '**Definition:**\n' + entry.definition + '\n\n'
    message += '**Example:**\n' + entry.example
    return message
}

bot.login(auth.token)