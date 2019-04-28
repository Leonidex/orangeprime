const constants = require('./settings/constants.json');
const tools = require('./tools.js');

class VoiceHandler {


    constructor() {
        this.audioIsReady = true;
        this.playQueue = [];
        this.connection;
        this.dispatcher;
        this.stopped;
    }

    async stop(message) {
        if (this.stopped) {
            await message.channel.send(constants.MESSAGES.PLAYBACK_ALREADY_STOPPED_MESSAGE);
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
                await this.playFile(message.member.voiceChannel, this.popFromQueue(), message, botChannel, botUser);
            } else {
                this.stopped = true;
            }
        } else {
            await message.channel.send(constants.MESSAGES.NOTHING_TO_BE_PLAYED_MESSAGE);
        }
    }

    /*
    Plays a file by a given address and the message object.
    */
    async playFile(voiceChannel, fileAddress, message, botChannel, botUser) {
        if (this.audioIsReady) {
            await tools.checkIfFile(fileAddress, async (err, isFile) => {
                if (err) throw err;
                if (isFile) {
                    await playFileHelper(voiceChannel, fileAddress, message, botChannel, botUser);
                } else {
                    var _fileAddress = fileAddress.substring(0, fileAddress.indexOf(constants.FILES.AUDIO_SUFFIX));
                    _fileAddress = _fileAddress + "1" + constants.FILES.AUDIO_SUFFIX;
                    var _fileName = tools.getFileNameFromFileAddress(_fileAddress);
                    tools.checkIfFile(_fileAddress, async (_err, _isFile) => {
                        if (_isFile) {
                            message.channel.send(constants.MESSAGES.CORRECT_SPELLING_MESSAGE + _fileName + ")");
                            await playFileHelper(voiceChannel, _fileAddress, message, botChannel, botUser);
                        } else {
                            message.channel.send("What are these lies?? There is no such file!");
                        }
                    });
                }
            });
        } else {
            this.addToQueue(fileAddress);
            message.channel.send(constants.MESSAGES.TRACK_QUEUED_MESSAGE + (this.playQueue.length));//Please wait a bit, my monkeys are tired.");
        }


        var playFileHelper = async (voiceChannel, fileAddress, message, botChannel, botUser) => {
            if (voiceChannel != null) {
                if (botChannel == null || botChannel != voiceChannel) {
                    await voiceChannel.join().then(async connection => {
                        this.connection = connection;
                        this.stopped = false;
                        this.audioIsReady = false;
                        const dispatcher = await this.connection.playFile(fileAddress);
                        botUser.setGame(tools.getFileNameFromFileAddress(fileAddress));
                        this.dispatcher = dispatcher;
                        this.dispatcher.on("end", end => {
                            this.audioIsReady = true;
                            if (this.playQueue.length > 0) {
                                this.playFile(voiceChannel, this.popFromQueue(), message, botChannel, botUser);
                            } else {
                                if (voiceChannel.connection) {
                                    voiceChannel.leave();
                                }
                                this.dispatcher = null;
                                botUser.setGame(null);
                            }
                        });
                    }).catch(err => {
                        console.log(err);
                    });
                } else {
                    this.stopped = false;
                    this.audioIsReady = false;
                    if (this.connection == null) {
                        this.connection = botChannel;
                    }
                    const dispatcher = this.connection.playFile(fileAddress);
                    this.dispatcher = dispatcher;
                    this.dispatcher.on("end", end => {
                        if (this.playQueue.length > 0) {
                            this.playFile(voiceChannel, this.popFromQueue(), message, botChannel, botUser);
                        } else {
                            this.audioIsReady = true;
                            if (voiceChannel.connection) {
                                voiceChannel.leave();
                            }
                            this.dispatcher = null;
                        }
                    });
                }
            }
        }
    }

    /* 
    Adds a file's address to the play queue.
     */
    addToQueue(fileAddress) {
        this.playQueue[this.playQueue.length] = fileAddress;
    }

    /* 
    Removes the first in file's address from the play queue,
    and orders the queue.
     */
    popFromQueue() {
        var fileAddress = this.playQueue[0]
        for (var i = 0; i < this.playQueue.length; i++) {
            this.playQueue[i] = this.playQueue[i + 1];
        }

        this.playQueue.splice(this.playQueue.length - 1)
        return fileAddress;
    }
}
module.exports = VoiceHandler;