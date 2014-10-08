
var scope = require('./scope');
var recorder = require('./recorder');
var recordingFilename = undefined;
var debug = require('debug')('nock.nocker');
var _ = require('lodash');
var fs = require('fs');

var NOCKER_IS_RECORDING = process.env.NOCK_RECORDING;

function start(filename, options) {
  if (NOCKER_IS_RECORDING) {
    if (recordingFilename) {
      throw new Error('Nock recording is already in progress for file', recordingFilename);
    }

    debug('recording nock requests to', filename);
    recorder.restore();
    recorder.clear();

    //  We clone the options to not change callers state.
    var clonedOptions = _.clone(options && options.recording_options) || {};
    clonedOptions.dont_print = true;
    clonedOptions.output_objects = true;

    recordingFilename = filename;
    recorder.record(clonedOptions);

    return null;
  } else {
    debug('reading nock requests from', filename);

    var defs = scope.loadDefs(filename);

    if (!defs) {
      throw new Error('There are no nock definitions in file', filename);
    }

    if (options && options.preprocessor) {
      options.preprocessor(defs);
    }

    nocks = scope.define(defs);

    if (options && options.postprocessor) {
      options.postprocessor(nocks);
    }

    if (!scope.isActive()) {
      scope.activate();
    }

    return nocks;
  }
}

function stop(nocks) {
  if (NOCKER_IS_RECORDING) {
    debug('stopped recording nock requests');

    //  Stop recording requests
    recorder.restore();

    //  Format output JSON for easier reading
    recordedNocksJson = (JSON.stringify(recorder.outputs())).replace(/{"scope"/g, '\n\r{"scope"');
    if (!recordingFilename) {
      console.log(recordedNocksJson);
    } else {
      fs.writeFileSync(recordingFilename, recordedNocksJson);
    }

    //  Clear the recorder requests
    recorder.clear();
    recordingFilename = undefined;
  } else {
    debug('stopped tracking nock requests');
    _.each(nocks, function(nock) {
      nock.done();
    });
  }
}

exports.start = start;
exports.stop = stop;
