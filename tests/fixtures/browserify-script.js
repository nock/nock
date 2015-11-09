var http = require('http');
var nock = require('../../');

document.getElementById('content').innerHTML = 'boop';

//
//
// var assert = require('assert');

// nock.disableNetConnect();
// nock('http://browserifyland.com').get('/beep').reply('boop');

// http.get('http://browserifyland.com/beep', function(res) {
//   res.setEncoding('utf8');
//   var body = '';
//   res
//     .on('data', function(d) {
//       body += d;
//     })
//     .once('end', function() {
//       document.findElementById('content').innerHTML = body;
//     });
// });