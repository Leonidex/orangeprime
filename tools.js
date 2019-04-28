const constants = require('./settings/constants.json');
const fs = require('fs');

const getFileNameFromFileAddress = (fileAddress) => {
    return fileAddress.substring(fileAddress.lastIndexOf("/") + 1, fileAddress.indexOf(constants.FILES.AUDIO_SUFFIX));
}

const getFileAddressFromFileName = (fileName) => {
    return constants.FILES.AUDIO_FOLDER_ADDRESS + fileName + constants.FILES.AUDIO_SUFFIX;
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