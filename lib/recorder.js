var http = require('http');
var https = require('https');
var oldRequest = http.request;
var oldHttpsRequest = https.request;
var inspect = require('util').inspect;

var SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n';

var outputs = [];

function generateRequestAndResponse(body, options, res, datas) {
  var requestBody = body.map(function(buffer) {
    return buffer.toString('utf8');
  }).join('');

  var responseBody = datas.map(function(buffer) {
    return buffer.toString('utf8');
  }).join('');

  var ret = [];
  ret.push('\nnock(\'');
  if (options._https_) {
    ret.push('https://');
  } else {
    ret.push('http://');
  }
  ret.push(options.host);
  ret.push('\')\n');
  ret.push('  .');
  ret.push((options.method || 'GET').toLowerCase());
  ret.push('(\'');
  ret.push(options.path);
  ret.push("'");
  if (requestBody) {
    ret.push(', ');
    try {
      requestBody = JSON.parse(requestBody)
    } catch(err) {}
    ret.push(JSON.stringify(requestBody));
  }
  ret.push(")\n");

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

function record(dont_print) {
  [http, https].forEach(function(module) {
    var oldRequest = module.request;
    module.request = function(options, callback) {

    var body = []
      , req, oldWrite, oldEnd;

    req = oldRequest.call(http, options, function(res) {
      var datas = [];

      res.on('data', function(data) {
        datas.push(data);
      });

      if (module === https) { options._https_ = true; }

      res.once('end', function() {
        var out = generateRequestAndResponse(body, options, res, datas);
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
        if (data) {body.push(data); }
        oldWrite.call(req, data);
      }
    };
    return req;
  };

  });
}

function restore() {
  http.request = oldRequest;
  https.request = oldHttpsRequest;
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
