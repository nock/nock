var RequestOverrider = require('./request_overrider'),
    mixin            = require('./mixin'),
    path             = require('path'),
    url              = require('url'),
    inherits         = require('util').inherits,
    EventEmitter     = require('events').EventEmitter,
    http             = require('http'),
    parse            = require('url').parse,
    ClientRequest    = http.ClientRequest;


var allInterceptors = {};

function isOn() {
  return process.env.NOCK_OFF !== 'true';
}

function add(key, interceptor, scope) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  interceptor.__nock_scope = scope;
  allInterceptors[key].push(interceptor);
}

function remove(interceptor) {
  if (interceptor.__nock_scope.shouldPersist()) return;

  var key          = interceptor._key.split(' '),
      u            = url.parse(key[1]),
      hostKey      = u.protocol + '//' + u.host,
      interceptors = allInterceptors[hostKey],
      interceptor,
      thisInterceptor;

  if (interceptors) {
    for(var i = 0; i < interceptors.length; i++) {
      thisInterceptor = interceptors[i];
      if (thisInterceptor._key === interceptor._key) {
        interceptors.splice(i, 1);
        break;
      }
    }

  }
}

function removeAll() {
  allInterceptors = {};
}

function interceptorsFor(options) {
  var basePath;

  options.proto = options.proto || 'http';
  options.port = options.port || ((options.proto === 'http') ? 80 : 443);
  options.hostname = options.hostname || options.host.split(':')[0];
  options.host = options.hostname + ':' + options.port;
  
  basePath = options.proto + '://' + options.host;

  return allInterceptors[basePath] || [];
}


function activate() {
  // ----- Extending http.ClientRequest

  function OverridenClientRequest(options, cb) {
    var interceptors = interceptorsFor(options);

    if (interceptors.length) {
      var overrider = RequestOverrider(this, options, interceptors, remove, cb);
      for(var propName in overrider) {
        if (overrider.hasOwnProperty(propName)) {
          this[propName] = overrider[propName];
        }
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
            
        if (typeof options === 'string') { options = parse(options); }
        options.proto = proto;
        interceptors = interceptorsFor(options);

        if (isOn() && interceptors.length) {

          var matches = false,
              allowUnmocked = false;

          interceptors.forEach(function(interceptor) {
            if (! allowUnmocked && interceptor.options.allowUnmocked) { allowUnmocked = true; }
            if (interceptor.matchIndependentOfBody(options)) { matches = true; }
          });

          if (! matches && allowUnmocked) {
            return oldRequest.apply(module, arguments);
          }

          req = new OverridenClientRequest(options);

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
}

activate();

module.exports = add;
module.exports.removeAll = removeAll;
module.exports.isOn = isOn;
module.exports.activate = activate;
