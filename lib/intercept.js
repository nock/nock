var RequestOverrider = require('./request_overrider'),
    path             = require('path'),
    url              = require('url'),
    inherits         = require('util').inherits,
    EventEmitter     = require('events').EventEmitter,
    http             = require('http'),
    ClientRequest    = http.ClientRequest;

var allInterceptors = {};

function add(key, interceptor) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  allInterceptors[key].push(interceptor);
}

function remove(interceptor) {
  var key          = interceptor._key.split(' '),
      u            = url.parse(key[1]),
      hostKey      = u.protocol + '//' + u.host,
      interceptors = allInterceptors[hostKey],
      interceptor,
      thisInterceptor;

  for(var i = 0; i < interceptors.length; i++) {
    thisInterceptor = interceptors[i];
    if (thisInterceptor._key === interceptor._key) {
      interceptors.splice(i, 1);
      break;
    }
  }
  //if (! interceptors) { delete allInterceptors[hostKey]; }
}

function removeAll() {
  allInterceptors = {};
}

function interceptorsFor(options) {
  var basePath;

  if (!options.host) {
    options.host = options.hostname;
    if (options.port)
      options.host += ":" + options.port;
  }
  options.proto = options.proto || 'http';

  basePath =  options.proto + '://' + options.host;

  return allInterceptors[basePath] || [];
}

// ----- Extending http.ClientRequest

function OverridenClientRequest(options, defaultPort) {
  var interceptors = interceptorsFor(options);

  if (interceptors.length) {
    var overrider = RequestOverrider(this, options, interceptors, remove);
    for(var propName in overrider) {
      this[propName] = overrider[propName];
    }
  } else {
    ClientRequest.apply(this, arguments);
  }
  
}
inherits(OverridenClientRequest, ClientRequest);

http.ClientRequest = OverridenClientRequest;

// ----- Overriding http.request and https.request:

[ 'http', 'https'].forEach(
  function(proto) {

    var moduleName = proto, // 1 to 1 match of protocol and module is fortunate :)
        module = require(moduleName),
        oldRequest = module.request;
        
    module.request = function(options, callback) {

      var interceptors,
          req,
          res;
          
      options.proto = proto;
      interceptors = interceptorsFor(options);

      if (interceptors.length) {

        var matches = false,
            allowUnmocked = false;

        interceptors.forEach(function(interceptor) {
          if (! allowUnmocked && interceptor.options.allowUnmocked) { allowUnmocked = true; }
          if (interceptor.matchIndependentOfBody(options)) { matches = true; }
        });

        if (! matches && allowUnmocked) {
          return oldRequest.apply(module, arguments);
        }

        req = new EventEmitter();
        res = RequestOverrider(req, options, interceptors, remove);
        if (callback) {
          res.on('response', callback);
        }
        return req;
      } else {
        return oldRequest.apply(module, arguments);
      }

    };
  }
);


module.exports = add;
module.exports.removeAll = removeAll;