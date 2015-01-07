'use strict';

var inspect = require('util').inspect;
var parse = require('url').parse;
var common = require('./common');
var intercept = require('./intercept');
var debug = require('debug')('nock.recorder');
var _ = require('lodash');

var SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n';
var recordingInProgress = false;
var outputs = [];

function getScope(options) {

  common.normalizeRequestOptions(options);

  var scope = [];
  if (options._https_) {
    scope.push('https://');
  } else {
    scope.push('http://');
  }

  scope.push(options.host);

  //  If a non-standard port wasn't specified in options.host, include it from options.port.
  if(options.host.indexOf(':') === -1 &&
     options.port &&
     ((options._https_ && options.port.toString() !== '443') ||
       (!options._https_ && options.port.toString() !== '80'))) {
    scope.push(':');
    scope.push(options.port);
  }

  return scope.join('');

}

function getMethod(options) {

  return (options.method || 'GET');

}

var getBodyFromChunks = function(chunks, headers) {

  //  If we have headers and there is content-encoding it means that
  //  the body shouldn't be merged but instead persisted as an array
  //  of hex strings so that the responses can be mocked one by one.
  if(common.isContentEncoded(headers)) {
    return _.map(chunks, function(chunk) {
      if(!Buffer.isBuffer(chunk)) {
        if (typeof chunk === 'string') {
          chunk = new Buffer(chunk);
        } else {
          throw new Error('content-encoded responses must all be binary buffers');
        }
      }

      return chunk.toString('hex');
    });
  }

  var mergedBuffer = common.mergeChunks(chunks);

  //  The merged buffer can be one of three things:
  //    1.  A binary buffer which then has to be recorded as a hex string.
  //    2.  A string buffer which represents a JSON object.
  //    3.  A string buffer which doesn't represent a JSON object.

  if(common.isBinaryBuffer(mergedBuffer)) {
    return mergedBuffer.toString('hex');
  } else {
    var maybeStringifiedJson = mergedBuffer.toString('utf8');
    try {
      return JSON.parse(maybeStringifiedJson);
    } catch(err) {
      return maybeStringifiedJson;
    }
  }

};

function generateRequestAndResponseObject(req, bodyChunks, options, res, dataChunks) {
  options.path = req.path;
  return {
    scope:    getScope(options),
    method:   getMethod(options),
    path:     options.path,
    body:     getBodyFromChunks(bodyChunks),
    status:   res.statusCode,
    response: getBodyFromChunks(dataChunks, res.headers),
    headers:  res.headers,
    reqheaders:   req._headers
  };

}

function generateRequestAndResponse(req, bodyChunks, options, res, dataChunks) {

  var requestBody = getBodyFromChunks(bodyChunks);
  var responseBody = getBodyFromChunks(dataChunks, res.headers);

  var ret = [];
  ret.push('\nnock(\'');
  ret.push(getScope(options));
  ret.push('\')\n');
  ret.push('  .');
  ret.push(getMethod(options).toLowerCase());
  ret.push('(\'');
  ret.push(options.path);
  ret.push("'");
  if (requestBody) {
    ret.push(', ');
    ret.push(JSON.stringify(requestBody));
  }
  ret.push(")\n");
  if (req.headers) {
    for (var k in req.headers) {
      ret.push('  .matchHeader(' + JSON.stringify(k) + ', ' + JSON.stringify(req.headers[k]) + ')\n');
    }
  }

  ret.push('  .reply(');
  ret.push(res.statusCode.toString());
  ret.push(', ');
  ret.push(JSON.stringify(responseBody));
  if (res.headers) {
    ret.push(', ');
    ret.push(inspect(res.headers));
  }
  ret.push(');\n');

  return ret.join('');
}

//  This module variable is used to identify a unique recording ID in order to skip
//  spurious requests that sometimes happen. This problem has been, so far,
//  exclusively detected in nock's unit testing where 'checks if callback is specified'
//  interferes with other tests as its t.end() is invoked without waiting for request
//  to finish (which is the point of the test).
var currentRecordingId = 0;

function record(rec_options) {

  //  Set the new current recording ID and capture its value in this instance of record().
  currentRecordingId = currentRecordingId + 1;
  var thisRecordingId = currentRecordingId;

  debug('start recording', thisRecordingId, JSON.stringify(rec_options));

  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if(recordingInProgress) {
    throw new Error('Nock recording already in progress');
  }

  recordingInProgress = true;

  //  Originaly the parameters was a dont_print boolean flag.
  //  To keep the existing code compatible we take that case into account.
  var optionsIsObject = typeof rec_options === 'object';
  var dont_print = (typeof rec_options === 'boolean' && rec_options) ||
      (optionsIsObject && rec_options.dont_print);
  var output_objects = optionsIsObject && rec_options.output_objects;
  var enable_reqheaders_recording = optionsIsObject && rec_options.enable_reqheaders_recording;
  var logging = (optionsIsObject && rec_options.logging) || console.log;

  debug(thisRecordingId, 'restoring overridden requests before new overrides');
  //  To preserve backward compatibility (starting recording wasn't throwing if nock was already active)
  //  we restore any requests that may have been overridden by other parts of nock (e.g. intercept)
  //  NOTE: This is hacky as hell but it keeps the backward compatibility *and* allows correct
  //    behavior in the face of other modules also overriding ClientRequest.
  common.restoreOverriddenRequests();
  //  We restore ClientRequest as it messes with recording of modules that also override ClientRequest (e.g. xhr2)
  intercept.restoreOverriddenClientRequest();

  //  We override the requests so that we can save information on them before executing.
  common.overrideRequests(function(proto, overriddenRequest, options, callback) {

    var bodyChunks = [];

    // Node 0.11 https.request calls http.request -- don't want to record things
    // twice.
    if (options._recording) {
      return overriddenRequest(options, callback);
    }
    options._recording = true;

    var req = overriddenRequest(options, function(res) {

      debug(thisRecordingId, 'intercepting', proto, 'request to record');

      if (typeof options === 'string') {
        options = parse(options);
      }

      var dataChunks = [];

      res.on('data', function(data) {
        debug(thisRecordingId, 'new', proto, 'data chunk');
        dataChunks.push(data);
      });

      if (proto === 'https') {
        options._https_ = true;
      }

      res.once('end', function() {
        debug(thisRecordingId, proto, 'intercepted request ended');

        var out;
        if(output_objects) {
          out = generateRequestAndResponseObject(req, bodyChunks, options, res, dataChunks);
          if(out.reqheaders) {
            //  We never record user-agent headers as they are worse than useless -
            //  they actually make testing more difficult without providing any benefit (see README)
            common.deleteHeadersField(out.reqheaders, 'user-agent');

            //  Remove request headers completely unless it was explicitly enabled by the user (see README)
            if(!enable_reqheaders_recording) {
              delete out.reqheaders;
            }
          }
        } else {
          out = generateRequestAndResponse(req, bodyChunks, options, res, dataChunks);
        }

        //  Check that the request was made during the current recording.
        //  If it hasn't then skip it. There is no other simple way to handle
        //  this as it depends on the timing of requests and responses. Throwing
        //  will make some recordings/unit tests faily randomly depending on how
        //  fast/slow the response arrived.
        //  If you are seeing this error then you need to make sure that all
        //  the requests made during a single recording session finish before
        //  ending the same recording session.
        if(thisRecordingId !== currentRecordingId) {
          debug('skipping recording of an out-of-order request', out);
          return;
        }

        outputs.push(out);

        if (!dont_print) {
          logging(SEPARATOR + out + SEPARATOR);
        }
      });

      if (callback) {
        callback(res, options, callback);
      }

    });

    var oldWrite = req.write;
    req.write = function(data) {
      if ('undefined' !== typeof(data)) {
        if (data) {
          debug(thisRecordingId, 'new', proto, 'body chunk');
          bodyChunks.push(data);
        }
        oldWrite.call(req, data);
      }
    };

    return req;
  });
}

//  Restores *all* the overridden http/https modules' properties.
function restore() {
  debug(currentRecordingId, 'restoring all the overridden http/https properties');

  common.restoreOverriddenRequests();
  intercept.restoreOverriddenClientRequest();
  recordingInProgress = false;
}

function clear() {
  outputs = [];
}

exports.record = record;
exports.outputs = function() {
  return outputs;
};
exports.restore = restore;
exports.clear = clear;
