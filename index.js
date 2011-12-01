var recorder = require('./lib/recorder')
module.exports = require('./lib/scope');

module.exports.recorder = {
    rec  : recorder.record
  , clear   : recorder.clear
  , play : recorder.outputs
};
module.exports.restore = recorder.restore;