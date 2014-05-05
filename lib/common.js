
var _ = require('lodash');
var assert = require('assert');

/**
 * Normalizes the request options so that it always has `host` property.
 *
 * @param  {Object} options - a parsed options object of the request
 */
var normalizeRequestOptions = function(options) {
  options.proto = options.proto || 'http';
  options.port = options.port || ((options.proto === 'http') ? 80 : 443);
  if (options.host) {
    options.hostname = options.hostname || options.host.split(':')[0];
  }
  options.host = (options.hostname || 'localhost') + ':' + options.port;

  return options;
};

/**
 * Returns true if the data contained in buffer is binary which in this case means
 * that it cannot be reconstructed from its utf8 representation.
 *
 * @param  {Object} buffer - a Buffer object
 */
var isBinaryBuffer = function(buffer) {

  if(!Buffer.isBuffer(buffer)) {
    return false;
  }

  //  Test if the buffer can be reconstructed verbatim from its utf8 encoding.
  var utfEncodedBuffer = buffer.toString('utf8');
  var reconstructedBuffer = new Buffer(utfEncodedBuffer, 'utf8');
  var compareBuffers = function(lhs, rhs) {
    if(lhs.length !== rhs.length) {
      return false;
    }

    for(var i = 0; i < lhs.length; ++i) {
      if(lhs[i] !== rhs[i]) {
        return false;
      }
    }

    return true;
  };

  //  If the buffers are *not* equal then this is a "binary buffer"
  //  meaning that it cannot be faitfully represented in utf8.
  return !compareBuffers(buffer, reconstructedBuffer);

};

/**
 * If the chunks are Buffer objects then it returns a single Buffer object with the data from all the chunks.
 * If the chunks are strings then it returns a single string value with data from all the chunks.
 *
 * @param  {Array} chunks - an array of Buffer objects or strings
 */
var mergeChunks = function(chunks) {

  if(_.isEmpty(chunks)) {
    return new Buffer(0);
  }

  //  We assume that all chunks are Buffer objects if the first is buffer object.
  //  We later check this assumption.
  var areBuffers = Buffer.isBuffer(_.first(chunks));

  if(!areBuffers) {
    //  When the chunks are not buffers we assume that they are strings.
    return chunks.join('');
  }

  //  Merge all the buffers into a single Buffer object.
  var size = 0;
  chunks.forEach(function(chunk) {
    assert(Buffer.isBuffer(chunk));
    size += chunk.length;
  });

  var mergedChunks = new Buffer(size);
  var copyToIndex = 0;
  chunks.forEach(function(chunk) {
    chunk.copy(mergedChunks, copyToIndex);
    copyToIndex += chunk.length;
  });

  return mergedChunks;

};

exports.normalizeRequestOptions = normalizeRequestOptions;
exports.isBinaryBuffer = isBinaryBuffer;
exports.mergeChunks = mergeChunks;
