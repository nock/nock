var http = require('http');
var https = require('https');
var oldRequest = http.request;
var oldHttpsRequest = https.request;
var inspect = require('util').inspect;

var SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n';

var outputs = [];

function getScope(options) {

  var scope = [];
  if (options._https_) {
    scope.push('https://');
  } else {
    scope.push('http://');
  }
  scope.push(options.host);
  if(options.port) {
    scope.push(':');
    scope.push(options.port);
  }

  return scope.join('');

}

function getMethod(options) {

  return (options.method || 'GET');

}

function getRequestBody(body) {

  var joinedBody = body.map(function(buffer) {
    return buffer.toString('utf8');
  }).join('');

  try {
    return JSON.parse(joinedBody);
  } catch(err) {
    return joinedBody;
  }

}

function getResponseBody(body) {

  return body.map(function(buffer) {
    return buffer.toString('utf8');
  }).join('');

}

function generateRequestAndResponseObject(body, options, res, datas) {

  return {
    scope:    getScope(options),
    port:     options.port,
    method:   getMethod(options),
    path:     options.path,
    body:     getRequestBody(body),
    reply:    res.statusCode.toString(),
    response: getResponseBody(datas),
    headers:  res.headers ? inspect(res.headers) : undefined
  };

}

function generateRequestAndResponse(body, options, res, datas) {

  var requestBody = getRequestBody(body);
  var responseBody = getResponseBody(datas);

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

function record(options) {

  //  Originaly the parameters was a dont_print boolean flag.
  //  To keep the existing code compatible we take that case into account.
  var dont_print = (typeof options === 'boolean' && options)
    || (typeof options === 'object' && options.dont_print);
  var output_objects = typeof options === 'object' && options.output_objects;

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
        var out = !output_objects ?
          generateRequestAndResponse(body, options, res, datas) :
          generateRequestAndResponseObject(body, options, res, datas);

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
