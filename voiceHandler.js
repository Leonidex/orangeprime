const CONSTANTS = require('./settings/constants.json');
const STRINGS = require('./settings/strings.json');
const tools = require('./tools.js');

class VoiceHandler {

    constructor() {
        this.audioIsReady = true;
        this.playQueue = [];
        this.connection;
        this.dispatcher;
        this.stopped;

        this.disconnectionDelayTimer = this.newDelayTimer();
    }

    /*
    * Object for handling the disconnection timeout,
    * used for handling the delay from the last played media
    */
   newDelayTimer() {
       return {
            delayTimer: null,
            restartSearchTimer: (voiceChannel) => {
                clearTimeout(this.disconnectionDelayTimer.delayTimer);
                this.disconnectionDelayTimer.delayTimer = setTimeout(() => {
                    voiceChannel.leave();
                }, CONSTANTS.CONFIG.DISCONNECTION_DELAY);
            },
            clearSearchTimer: () => {
                clearTimeout(this.disconnectionDelayTimer.delayTimer);
            }
        }
    }

    async stop(message) {
        if (this.stopped) {
            await message.channel.send(CONSTANTS.MESSAGES.PLAYBACK_ALREADY_STOPPED_MESSAGE);
        } else {
            this.stopped = true;
            this.playQueue = []
            if (this.dispatcher != null) {
                this.dispatcher.end();
                this.dispatcher = null;
            }
        }
    }

    async skip(message, botChannel, botUser) {
        if (this.dispatcher != null) {
            this.dispatcher.end();
            this.dispatcher = null;
            if (this.playQueue.length > 0) {
                await this.playFile(message.member.voice.channel, this.popFromQueue(), message, botChannel, botUser);
            } else {
                this.stopped = true;
            }
        } else {
            await message.channel.send(CONSTANTS.MESSAGES.NOTHING_TO_BE_PLAYED_MESSAGE);
        }
    }

    /*
    * Plays a file by a given address and the message object.
    */
   async playFile(voiceChannel, fileAddress, message, botChannel, botUser) {
        if (this.audioIsReady) {
            await tools.checkIfFile(fileAddress, async (err, isFile) => {
                if (err) throw err;
                if (isFile) {
                    await playFileHelper(voiceChannel, fileAddress, message, botChannel, botUser);
                } else {
                    var _fileAddress = fileAddress.substring(0, fileAddress.indexOf(CONSTANTS.FILES.AUDIO_SUFFIX));
                    _fileAddress = _fileAddress + "1" + CONSTANTS.FILES.AUDIO_SUFFIX;
                    var _fileName = tools.getFileNameFromFileAddress(_fileAddress);
                    tools.checkIfFile(_fileAddress, async (_err, _isFile) => {
                        if (_isFile) {
                            message.channel.send(CONSTANTS.MESSAGES.CORRECT_SPELLING_MESSAGE + _fileName + ")");
                            await playFileHelper(voiceChannel, _fileAddress, message, botChannel, botUser);
                        } else {
                            message.channel.send("What are these lies?? There is no such file!");
                        }
                    });
                }
            });
        } else {
            this.addToQueue(fileAddress);
            message.channel.send(CONSTANTS.MESSAGES.TRACK_QUEUED_MESSAGE + (this.playQueue.length));//Please wait a bit, my monkeys are tired.");
        }

        var playFileHelper = async (voiceChannel, fileAddress, message, botChannel, botUser) => {
            if (voiceChannel != null) {
                this.stopped = false;
                this.audioIsReady = false;
                botUser.setActivity(tools.getFileNameFromFileAddress(fileAddress));
                if (botChannel == null || botChannel != voiceChannel) {
                    await this.joinVoiceChannel(voiceChannel);
                }
                this.dispatcher = await this.connection.play(fileAddress);
                this.dispatcher.setVolume(CONSTANTS.CONFIG.PLAY_VOLUME);
                this.dispatcher.on("finish", async () => {
                    this.audioIsReady = true;
                    if (this.playQueue.length > 0) {
                        this.playFile(voiceChannel, this.popFromQueue(), message, botChannel, botUser);
                    } else {
                        if (voiceChannel) {
                            this.disconnectionDelayTimer.restartSearchTimer(voiceChannel);
                        }
                        this.dispatcher = null;
                        botUser.setActivity(null);
                    }
                });
            }
        }
    }

    /*
    * Plays an audio stream using the text to speech api
    */
    async say(voiceChannel, message, botChannel, botUser) {
        if (voiceChannel != null) {
            this.stopped = false;
            this.audioIsReady = false;
            botUser.setActivity(STRINGS.SAY.ACTIVITY_PREFIX + message + STRINGS.SAY.ACTIVITY_SUFFIX);
            if (botChannel == null || botChannel != voiceChannel) {
                await this.joinVoiceChannel(voiceChannel);
            }
            this.dispatcher = await this.connection.play(STRINGS.SAY.API_CALL_PREFIX
                    + STRINGS.SAY.VOLUME
                    + STRINGS.SAY.API_CALL_SUFFIX
                    + encodeURIComponent(message));
            
            this.dispatcher.setVolume(CONSTANTS.CONFIG.PLAY_VOLUME);
            this.dispatcher.on("finish", end => {
                this.audioIsReady = true;
                this.disconnectionDelayTimer.restartSearchTimer(voiceChannel);
                botUser.setActivity(null);
            });
        }
    }

    /* 
    * Adds a file's address to the play queue.
    */
    addToQueue(fileAddress) {
        this.playQueue[this.playQueue.length] = fileAddress;
    }

    /* 
    * Removes the first in file's address from the play queue,
    * and orders the queue.
    */
    popFromQueue() {
        var fileAddress = this.playQueue[0]
        for (var i = 0; i < this.playQueue.length; i++) {
            this.playQueue[i] = this.playQueue[i + 1];
        }

        this.playQueue.splice(this.playQueue.length - 1)
        return fileAddress;
    }
    
    /*
    * Async function for joining a voice channel.
    * Joins a given voice channel and settings the voiceHandler connection as the new one.
    * Also adds an on speaking listener to the audioListener object.
    */
    async joinVoiceChannel(voiceChannel) {
        await voiceChannel.join().then(async connection => {
            this.connection = connection;
        }).catch(err => { console.error(err) });
    }
}
module.exports = VoiceHandler;