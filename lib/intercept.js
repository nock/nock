/**
 * @module nock/intercepts
 */

var RequestOverrider = require('./request_overrider'),
    common           = require('./common'),
    url              = require('url'),
    inherits         = require('util').inherits,
    http             = require('http'),
    parse            = require('url').parse,
    _                = require('lodash'),
    debug            = require('debug')('nock.intercept');

/**
 * @name NetConnectNotAllowedError
 * @private
 * @desc Error trying to make a connection when disabled external access.
 * @class
 * @example
 * nock.disableNetConnect();
 * http.get('http://zombo.com');
 * // throw NetConnectNotAllowedError
 */
function NetConnectNotAllowedError(host) {
  Error.call(this);

  this.name    = 'NetConnectNotAllowedError';
  this.message = 'Nock: Not allow net connect for "' + host + '"';

  Error.captureStackTrace(this, this.constructor);
}

inherits(NetConnectNotAllowedError, Error);

var allInterceptors = {},
    allowNetConnect = /.*/;

/**
 * Enabled real request.
 * @public
 * @param {String|RegExp} matcher=RegExp.new('.*') Expression to match
 * @example
 * // Enables all real requests
 * nock.enableNetConnect();
 * @example
 * // Enables real requests for url that matches google
 * nock.enableNetConnect('google');
 * @example
 * // Enables real requests for url that matches google and amazon
 * nock.enableNetConnect(/(google|amazon)/);
 */
function enableNetConnect(matcher) {
  if (typeof matcher === 'string') {
    allowNetConnect = new RegExp(matcher);
  } else if (typeof matcher === 'object' && typeof matcher.test === 'function') {
    allowNetConnect = matcher;
  } else {
    allowNetConnect = /.*/;
  }
}

function isEnabledForNetConnect(options) {
  common.normalizeRequestOptions(options);

  return allowNetConnect && allowNetConnect.test(options.host);
}

/**
 * Disable all real requests.
 * @public
 * @param {String|RegExp} matcher=RegExp.new('.*') Expression to match
 * @example
 * nock.disableNetConnect();
*/
function disableNetConnect() {
  allowNetConnect = false;
}

function isOn() {
  return !isOff();
}

function isOff() {
  return process.env.NOCK_OFF === 'true';
}

function add(key, interceptor, scope, scopeOptions) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  interceptor.__nock_scope = scope;
  
  //  We need scope's key and scope options for scope filtering function (if defined)
  interceptor.__nock_scopeKey = key;
  interceptor.__nock_scopeOptions = scopeOptions;
  
  allInterceptors[key].push(interceptor);
}

function remove(interceptor) {

  if (interceptor.__nock_scope.shouldPersist()) {
    return;
  }

  if (interceptor.counter > 1) {
    interceptor.counter -= 1;
    return;
  }

  var key          = interceptor._key.split(' '),
      u            = url.parse(key[1]),
      hostKey      = u.protocol + '//' + u.host,
      interceptors = allInterceptors[hostKey],
      thisInterceptor;

  if (interceptors) {
    for(var i = 0; i < interceptors.length; i++) {
      thisInterceptor = interceptors[i];
      if (thisInterceptor === interceptor) {
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

  common.normalizeRequestOptions(options);

  basePath = options.proto + '://' + options.host;

  debug('filtering interceptors for basepath', basePath);

  //  First try to use filteringScope if any of the interceptors has it defined.
  var matchingInterceptor;
  _.each(allInterceptors, function(interceptor, key) {
    _.each(interceptor, function(scope) {
      var filteringScope = scope.__nock_scopeOptions.filteringScope;

      //  If scope filtering function is defined and returns a truthy value
      //  then we have to treat this as a match.
      if(filteringScope && filteringScope(basePath)) {
        debug('found matching scope interceptor');

        //  Keep the filtered scope (its key) to signal the rest of the module
        //  that this wasn't an exact but filtered match.
        scope.__nock_filteredScope = scope.__nock_scopeKey;
        matchingInterceptor = interceptor;
        //  Break out of _.each for scopes.
        return false;
      }
    });

    //  Returning falsy value here (which will happen if we have found our matching interceptor)
    //  will break out of _.each for all interceptors.
    return !matchingInterceptor;
  });

  if(matchingInterceptor) {
    return matchingInterceptor;
  }

  return allInterceptors[basePath] || [];
}

//  Variable where we keep the ClientRequest we have overridden
//  (which might or might not be node's original http.ClientRequest)
var originalClientRequest;

function overrideClientRequest() {
  debug('Overriding ClientRequest');

  if(originalClientRequest) {
    throw new Error('Nock already overrode http.ClientRequest');
  }

  // ----- Extending http.ClientRequest

  //  Define the overriding client request that nock uses internally.
  function OverriddenClientRequest(options, cb) {

    //  Filter the interceptors per request options.
    var interceptors = interceptorsFor(options);

    if (interceptors.length) {
      debug('using', interceptors.length, 'interceptors');

      //  Use filtered interceptors to intercept requests.
      var overrider = RequestOverrider(this, options, interceptors, remove, cb);
      for(var propName in overrider) {
        if (overrider.hasOwnProperty(propName)) {
          this[propName] = overrider[propName];
        }
      }
    } else {
      debug('falling back to original ClientRequest');

      //  Fallback to original ClientRequest if nock is off or the net connection is enabled.
      if(isOff() || isEnabledForNetConnect(options)) {
        originalClientRequest.apply(this, arguments);
      } else {
        throw new NetConnectNotAllowedError(options.host);
      }
    }
  }
  inherits(OverriddenClientRequest, http.ClientRequest);

  //  Override the http module's request but keep the original so that we can use it and later restore it.
  //  NOTE: We only override http.ClientRequest as https module also uses it.
  originalClientRequest = http.ClientRequest;
  http.ClientRequest = OverriddenClientRequest;

  debug('ClientRequest overridden');
}

function restoreOverriddenClientRequest() {
  debug('restoring overriden ClientRequest');

  //  Restore the ClientRequest we have overridden.
  if(!originalClientRequest) {
    debug('- ClientRequest was not overridden');
  } else {
    http.ClientRequest = originalClientRequest;
    originalClientRequest = undefined;

    debug('- ClientRequest restored');
  }
}

function isActive() {

  //  If ClientRequest has been overwritten by Nock then originalClientRequest is not undefined.
  //  This means that Nock has been activated.
  return !_.isUndefined(originalClientRequest);

}

function activate() {

  if(originalClientRequest) {
    throw new Error('Nock already active');
  }

  overrideClientRequest();

  // ----- Overriding http.request and https.request:

  common.overrideRequests(function(proto, overriddenRequest, options, callback) {

    //  NOTE: overriddenRequest is already bound to its module.

    var interceptors,
        req,
        res;

    if (typeof options === 'string') {
      options = parse(options);
    }
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
        return overriddenRequest(options, callback);
      }

      //  NOTE: Since we already overrode the http.ClientRequest we are in fact constructing
      //    our own OverriddenClientRequest.
      req = new http.ClientRequest(options);

      res = RequestOverrider(req, options, interceptors, remove);
      if (callback) {
        res.on('response', callback);
      }
      return req;
    } else {
      if (isOff() || isEnabledForNetConnect(options)) {
        return overriddenRequest(options, callback);
      } else {
        throw new NetConnectNotAllowedError(options.host);
      }
    }
  });

}

activate();

module.exports = add;
module.exports.removeAll = removeAll;
module.exports.isOn = isOn;
module.exports.activate = activate;
module.exports.isActive = isActive;
module.exports.enableNetConnect = enableNetConnect;
module.exports.disableNetConnect = disableNetConnect;
module.exports.overrideClientRequest = overrideClientRequest;
module.exports.restoreOverriddenClientRequest = restoreOverriddenClientRequest;
