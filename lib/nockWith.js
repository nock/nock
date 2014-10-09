'use strict';

var nock = require('../.');
var fs = require('fs');
var format = require('util').format;
var mkdirp = require('mkdirp');
var path = require('path');
var expect = require('chai').expect;

NockWith.fixtures = null;
NockWith.assert = false;

/**
 * nock the current function with the fixture given
 *
 * @param {string} fixtureName - the name of the fixture, e.x. 'foo.json'
 * @param {object} options - [optional], extra options for nock with, e.x. { assert: true }
 * @param {function} nockedFn - the callback function to be executed with the given fixture being loaded,
 *                              the function will be called with { scopes: loaded_nocks || [] } set as this
 *
 *
 * List of options:
 *
 * @param {boolean} assert      - temporarily overrides NockWith.assert for this test
 * @param {boolean} record      - if true force recording regardless of file existance
 * @param {boolean} define      - if false don't use nock.load instead use nock.loadDefs for this.scopes
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


  restore();

  var fixture = path.join(NockWith.fixtures, fixtureName)
    , shouldAssert = extractOption(options, 'assert', NockWith.assert)
    , shouldRecord = extractOption(options, 'record', !fs.existsSync(fixture))
    , loadType = extractOption(options, 'define', true) ? nock.load : nock.loadDefs
    , nocked = loadScopes(fixture, loadType, shouldRecord);


  var nockDone = function () {
    if(shouldRecord) {
      writeFixture(fixture);
    }

    if(shouldAssert) {
      assertScopes(nocked.scopes, fixture);
    }

  };

  nockedFn.call(nocked, nockDone);
}

function extractOption (options, option, defaultOption) {
  return options.hasOwnProperty(option) ?
          options[option] :
          defaultOption;

}

function restore () {
  nock.restore();
  nock.recorder.clear();
  nock.cleanAll();
  nock.activate();
  nock.disableNetConnect();
}


function loadScopes (fixture, load, shouldRecord) {

  if(shouldRecord) {
    startRecording();

    return { scopes: [] };
  }

  return { scopes: load(fixture) };
}



function startRecording () {
  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });
}



function writeFixture (fixture) {
  var outputs = JSON.stringify(nock.recorder.play(), null, 4);

  mkdirp.sync(path.dirname(fixture));
  fs.writeFileSync(fixture, outputs);
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
