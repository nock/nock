var http = require('http');
var https = require('https');
var oldHttpRequest = http.request;
var oldHttpsRequest = https.request;
var inspect = require('util').inspect;
var parse = require('url').parse;
var common = require('./common');

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
  if(options.host.indexOf(':') === -1
    && options.port
    && ((options._https_ && options.port.toString() !== '443')
      || (!options._https_ && options.port.toString() !== '80'))) {
    scope.push(':');
    scope.push(options.port);
  }

  return scope.join('');

}

function getMethod(options) {

  return (options.method || 'GET');

}

var getBodyFromChunks = function(chunks) {

  var mergedBuffer = common.mergeChunks(chunks);

  //  A buffer can be one of three things:
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

  return {
    scope:    getScope(options),
    method:   getMethod(options),
    path:     options.path,
    body:     getBodyFromChunks(bodyChunks),
    status:   res.statusCode,
    response: getBodyFromChunks(dataChunks),
    headers:  res.headers,
    reqheaders:   req.headers
  };

}

function generateRequestAndResponse(req, bodyChunks, options, res, dataChunks) {

  var requestBody = getBodyFromChunks(bodyChunks);
  var responseBody = getBodyFromChunks(dataChunks);

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

function record(rec_options) {

  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if(recordingInProgress) {
    throw new Error('Nock recording already in progress');
  }

  recordingInProgress = true;

  //  Originaly the parameters was a dont_print boolean flag.
  //  To keep the existing code compatible we take that case into account.
  var dont_print = (typeof rec_options === 'boolean' && rec_options)
    || (typeof rec_options === 'object' && rec_options.dont_print);
  var output_objects = typeof rec_options === 'object' && rec_options.output_objects;

  [http, https].forEach(function(module) {
    var overwrittenModuleRequest = module.request;

    module.request = function(options, callback) {

    var bodyChunks = []
      , req, oldWrite, oldEnd;

    req = overwrittenModuleRequest.call(http, options, function(res) {

      if (typeof options === 'string') { options = parse(options); }

      var dataChunks = [];

      res.on('data', function(data) {
        dataChunks.push(data);
      });

      if (module === https) { options._https_ = true; }

      res.once('end', function() {
        var out;
        if(output_objects) {
          out = generateRequestAndResponseObject(req, bodyChunks, options, res, dataChunks);
        } else {
          out = generateRequestAndResponse(req, bodyChunks, options, res, dataChunks);
        }

        outputs.push(out);
        if (! dont_print) { console.log(SEPARATOR + out + SEPARATOR); }
      });

      if (callback) {
        callback.apply(res, arguments);
      }

    });
    oldWrite = req.write;
    req.write = function(data) {
      if ('undefined' !== typeof(data)) {
        if (data) {bodyChunks.push(data); }
        oldWrite.call(req, data);
      }
    };
    return req;
  };

  });
}

function restore() {
  http.request = oldHttpRequest;
  https.request = oldHttpsRequest;
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
