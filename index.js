
var recorder = require('./lib/recorder');
var nocker = require('./lib/nocker');

module.exports = require('./lib/scope');

module.exports.recorder = {
    rec   : recorder.record
  , clear : recorder.clear
  , play  : recorder.outputs
};

module.exports.nocker = {
    start : nocker.start,
    stop  : nocker.stop
};

module.exports.restore = recorder.restore;
