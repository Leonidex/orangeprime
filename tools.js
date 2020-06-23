const CONSTANTS = require('./settings/constants.json');
const fs = require('fs');

const getFileNameFromFileAddress = (fileAddress) => {
    return fileAddress.substring(fileAddress.lastIndexOf("/") + 1, fileAddress.indexOf(CONSTANTS.FILES.AUDIO_SUFFIX));
}

const getFileAddressFromFileName = (fileName) => {
    return CONSTANTS.FILES.AUDIO_FOLDER_ADDRESS + fileName + CONSTANTS.FILES.AUDIO_SUFFIX;
}

const checkIfFile = (file, cb) => {
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

module.exports = { getFileNameFromFileAddress, getFileAddressFromFileName, checkIfFile };