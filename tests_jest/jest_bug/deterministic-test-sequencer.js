'use strict'

const TestSequencer = require('@jest/test-sequencer').default;

class DeterministicSequencer extends TestSequencer {
  sort(tests) {
    return tests.sort((testA, testB) => testA.path.localeCompare(testB.path))
  }
}

module.exports = DeterministicSequencer;
