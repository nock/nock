'use strict';

var nock = require('./scope');
var recorder = require('./recorder');

var fs = require('fs');
var format = require('util').format;
var mkdirp = require('mkdirp');
var path = require('path');
var expect = require('chai').expect;




var Modes = {

  wild: wild, //all requests go out to the internet, dont replay anything, doesnt record anything

  dryrun: dryrun, //use recorded nocks, allow http calls, doesnt record anything, useful for writing new tests

  record: record, //use recorded nocks, record new nocks (default)

  lockdown: lockdown, //use recorded nocks, disables all http calls even when not nocked, doesnt record

};




var _mode = null;



NockWith.setMode = function(mode) {
  if( !Modes.hasOwnProperty(mode) ) {
    throw new Error ('some usage error');
  }

  _mode = Modes[mode]();
};




NockWith.fixtures = null;
NockWith.setMode(process.env.NOCK_WITH_MODE || 'wild');




/**
 * nock the current function with the fixture given
 *
 * @param {string}   fixtureName  - the name of the fixture, e.x. 'foo.json'
 * @param {object}   options      - [optional], extra options for nock with, e.x. { assert: true }
 * @param {function} nockedFn     - the callback function to be executed with the given fixture being loaded,
 *                                  the function will be called with { scopes: loaded_nocks || [] } set as this
 *
 *
 * List of options:
 *
 * @param {function} before       - a preprocessing function, gets called before nock.define
 * @param {function} after        - a postprocessing function, gets called after nock.define
 *
 */
function NockWith (fixtureName, options, nockedFn) {
  if(!NockWith.fixtures) {
    throw new Error(  'NockWith requires nockWith.fixtures to be set\n' +
                      'Ex:\n' +
                      '\trequire(nock).nockWith.fixtures = \'/path/to/fixures/\'');
  }

  if( arguments.length === 2 ) {
    nockedFn = options;
    options = {};
  }


  var fixture = path.join(NockWith.fixtures, fixtureName)
    , context = _mode.before(fixture, options);


  var nockDone = function () {
    _mode.after(fixture, options, context);
  };

  nockedFn.call(context, nockDone);
}




/*******************************************************************************
*                                    Modes                                     *
*******************************************************************************/




function wild () {
  function setup () {
    recorder.restore();
    nock.activate();
  }

  setup();

  return {

    before: function () {
      setup();
      return load(); //don't load anything but get correct context
    },

    after: function () {
      //nothing to do
    }
  };
}




function dryrun() {
  function setup () {
    recorder.restore();
    nock.cleanAll();
    nock.activate();
  }

  setup();

  return {
    before: function (fixture, options) {
      setup();

      var contexts = load(fixture, options);

      nock.enableNetConnect();
      return contexts;
    },

    after: function () {
      //nothing to do
    }
  };
}




function record () {
  function setup () {
    recorder.restore();
    recorder.clear();
    nock.cleanAll();
    nock.activate();
    nock.disableNetConnect();
  }

  setup();

  return {
    before: function (fixture, options) {
      setup();

      var context = load(fixture, options);

      if( !context.isLoaded ) {
        recorder.record({
          dont_print: true,
          output_objects: true
        });

        context.isRecording = true;
      }

      return context;
    },


    after: function (fixture, options, context) {
      if( context.isRecording ) {
        var outputs = JSON.stringify(recorder.outputs(), null, 4);

        mkdirp.sync(path.dirname(fixture));
        fs.writeFileSync(fixture, outputs);
      }
    }
  };
}




function lockdown () {
  function setup () {
    recorder.restore();
    recorder.clear();
    nock.cleanAll();
    nock.activate();
    nock.disableNetConnect();
  }

  setup();

  return {
    before: function (fixture, options) {
      return load(fixture, options);
    },


    after: function () {
      //nothing to do
    }

  };

}




function load (fixture, options) {
  var context = { scopes : [] };

  if( fixture && fixtureExists(fixture) ) {
    var scopes = nock.loadDefs(fixture);
    applyHook(scopes, options.before);

    scopes = nock.define(scopes);
    applyHook(scopes, options.after);

    context.scopes = scopes;
    context.isLoaded = true;
  }


  return context;
}




function applyHook(scopes, fn) {
  if( !fn ) {
    return;
  }

  if( typeof fn !== 'function' ) {
    throw new Error ('processing hooks must be a function');
  }

  scopes.forEach(fn);
}




function fixtureExists(fixture) {
  return fs.existsSync(fixture);
}




function assertScopes (scopes, fixture) {
  scopes.forEach(function (scope) {
    expect( scope.isDone() )
    .to.be.equal(
      true,
      format('%j was not used, consider removing %s to rerecord fixture', scope.pendingMocks(), fixture)
    );
  });
}



module.exports = exports = NockWith;
