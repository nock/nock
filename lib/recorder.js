var http = require('http');
var oldRequest = http.request;
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
  
  ret = [];
  ret.push('\nnock(\'');
  ret.push(options.host);
  ret.push('\')\n');
  ret.push('  .');
  ret.push((options.method || 'GET').toLowerCase());
  ret.push('(\'');
  ret.push(options.path);
  ret.push("'");
  if (requestBody) {
    ret.push(JSON.stringify(requestBody));
  }
  ret.push(")\n");
  
  ret.push('  .reply(')
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
  http.request = function(options, callback) {
    var body = []
      , req, oldWrite, oldEnd;

    req = oldRequest.call(http, options, function(res) {
      var datas = [];
      
      res.on('data', function(data) {
        datas.push(data);
      });

      res.once('end', function() {
        var out = generateRequestAndResponse(body, options, res, datas);
        outputs.push(out);
        if (! dont_print) { console.log(SEPARATOR + out + SEPARATOR); }
      });

      callback.apply(res, arguments);

    });
    oldWrite = req.write;
    req.write = function(data) {
      if ('undefined' !== typeof(data)) {
        if (data) {body.push(data); }
        oldWrite.call(req, data);
      }
    };
    oldEnd = req.end;
    req.end = function(data) {
      if ('undefined' !== typeof(data)) {
        req.write(data);
      }
      oldEnd.apply(req, arguments);
    };
    return req;
  };
}

function restore() {
  http.request = oldRequest;
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