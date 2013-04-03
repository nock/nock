var nock    = require('../.')
var http    = require('http');
var https   = require('https');
var util    = require('util');
var events  = require('events');
var test    = require('tap').test;
var mikealRequest = require('request');

test("get gets mocked", function(t) {
  var dataCalled = false
  
  var scope = nock('http://www.google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      host: "www.google.com"
    , path: '/'
    , port: 80
  }, function(res) {
    
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(dataCalled);
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
    });
    
  });
  
  req.end();
});

test("not mocked should work in http", function(t) {
  var dataCalled = false;
  
  var req = http.request({
      host: "www.amazon.com"
    , path: '/'
    , port: 80
  }, function(res) {
    
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      var doneFails = false;
      
      t.ok(dataCalled);
      try {
        scope.done();
      } catch(err) {
        doneFails = true;
      }
      t.ok(doneFails);
      t.end();
    });
    
    res.on('data', function(data) {
      dataCalled = true;
    });
    
  });
  
  req.on('error', function(err) {
    if (err.code !== 'ECONNREFUSED') {
      throw err;
    }
    t.end();
  });
    
  req.end();
});

test("post", function(t) {
  var dataCalled = false;
  
  var scope = nock('http://www.google.com')
     .post('/form')
     .reply(201, "OK!");

   var req = http.request({
       host: "www.google.com"
     , method: 'POST'
     , path: '/form'
     , port: 80
   }, function(res) {

     t.equal(res.statusCode, 201);
     res.on('end', function() {
       t.ok(dataCalled);
       scope.done();
       t.end();
     });
     res.on('data', function(data) {
       dataCalled = true;
       t.ok(data instanceof Buffer, "data should be buffer");
       t.equal(data.toString(), "OK!", "response should match");
     });

   });

   req.end();
});



test("post with empty response body", function(t) {
  var scope = nock('http://www.google.com')
     .post('/form')
     .reply(200);

   var req = http.request({
       host: "www.google.com"
     , method: 'POST'
     , path: '/form'
     , port: 80
   }, function(res) {

     t.equal(res.statusCode, 200);
     res.on('end', function() {
       scope.done();
       t.end();
     });
     res.on('data', function(data) {
       t.fail("No body should be returned")
     });

   });
   req.end();
});

test("post, lowercase", function(t) {
  var dataCalled = false;
  
  var scope = nock('http://www.google.com')
     .post('/form')
     .reply(200, "OK!");

   var req = http.request({
       host: "www.google.com"
     , method: 'post'
     , method: 'POST'
     , path: '/form'
     , port: 80
   }, function(res) {

     t.equal(res.statusCode, 200);
     res.on('end', function() {
       t.notOk(dataCalled);
       scope.done();
       t.end();
     });
     res.on('data', function(data) {
       dataCalled = true;
       t.end();
     });
   });

   req.end();
});

test("get with reply callback", function(t) {
  var scope = nock('http://www.google.com')
     .get('/')
     .reply(200, function() {
        return 'OK!';
     });

  var req = http.request({
     host: "www.google.com"
    , path: '/'
    , port: 80
  }, function(res) {
    res.on('end', function() {
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      t.equal(data.toString(), 'OK!', 'response should match');
    });
  });

  req.end();
});

test("get with reply callback returning object", function(t) {
  var scope = nock('http://www.googlezzzz.com')
     .get('/')
     .reply(200, function() {
        return { message: 'OK!' };
     });

  var req = http.request({
     host: "www.googlezzzz.com"
    , path: '/'
    , port: 80
  }, function(res) {
    res.on('end', function() {
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      t.equal(data.toString(), JSON.stringify({ message: 'OK!' }), 'response should match');
    });
  });

  req.end();
});

test("post with reply callback, uri, and request body", function(t) {
  var input = 'key=val';

  var scope = nock('http://www.google.com')
     .post('/echo', input)
     .reply(200, function(uri, body) {
        return ['OK', uri, body].join(' ');
     });

  var req = http.request({
     host: "www.google.com"
    , method: 'POST'
    , path: '/echo'
    , port: 80
  }, function(res) {
    res.on('end', function() {
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      t.equal(data.toString(), 'OK /echo key=val' , 'response should match');
    });
  });

  req.write(input);
  req.end();
});

test("reply with callback and filtered path and body", function(t) {
  var noPrematureExecution = false;

  var scope = nock('http://www.realcallback.com')
     .filteringPath(/.*/, '*')
     .filteringRequestBody(/.*/, '*')
     .post('*', '*')
     .reply(200,  function(uri, body) {
         t.assert(noPrematureExecution);
         return ['OK', uri, body].join(' ');
      });

  var req = http.request({
     host: "www.realcallback.com"
    , method: 'POST'
    , path: '/original/path'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     scope.done();
     t.end();
   });
   res.on('data', function(data) {
     t.equal(data.toString(), 'OK /original/path original=body' , 'response should match');
   });
  });

  noPrematureExecution = true;
  req.end('original=body');
});

test("isDone", function(t) {
  var scope = nock('http://www.google.com')
    .get('/')
    .reply(200, "Hello World!");

  t.notOk(scope.isDone(), "not done when a request is outstanding");

  var req = http.request({
      host: "www.google.com"
    , path: '/'
    , port: 80
  }, function(res) {
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(scope.isDone(), "done after request is made");
      scope.done();
      t.end();
    });
  });

  req.end();
});

test("requireDone", function(t) {
  var scope = nock('http://www.google.com')
    .get('/', false, { requireDone: false })
    .reply(200, "Hello World!");

  t.ok(scope.isDone(), "done when a requireDone is set to false");

  scope.get('/', false, { requireDone: true})
       .reply(200, "Hello World!");

  t.notOk(scope.isDone(), "not done when a requireDone is explicitly set to true");

  nock.cleanAll()
  t.end();
});

test("request headers exposed", function(t) {

  var scope = nock('http://www.headdy.com')
     .get('/')
     .reply(200, "Hello World!", {'X-My-Headers': 'My Header value'});

  var req = http.get({
     host: "www.headdy.com"
    , method: 'GET'
    , path: '/'
    , port: 80
    , headers: {'X-My-Headers': 'My custom Header value'}
  }, function(res) {
    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

  t.equivalent(req._headers, {'x-my-headers': 'My custom Header value', 'host': 'www.headdy.com'});
});

test("headers work", function(t) {

  var scope = nock('http://www.headdy.com')
     .get('/')
     .reply(200, "Hello World!", {'X-My-Headers': 'My Header value'});

  var req = http.request({
     host: "www.headdy.com"
    , method: 'GET'
    , path: '/'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     t.equivalent(res.headers, {'x-my-headers': 'My Header value'});
     scope.done();
     t.end();
   });
  });

  req.end();

});

test("match headers", function(t) {
  var scope = nock('http://www.headdy.com')
     .get('/')
     .matchHeader('x-my-headers', 'My custom Header value')
     .reply(200, "Hello World!");

  http.get({
     host: "www.headdy.com"
    , method: 'GET'
    , path: '/'
    , port: 80
    , headers: {'X-My-Headers': 'My custom Header value'}
  }, function(res) {
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      t.equal(data, 'Hello World!');
    });

    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

});

test("match headers with regexp", function(t) {
  var scope = nock('http://www.headier.com')
     .get('/')
     .matchHeader('x-my-headers', /My He.d.r [0-9.]+/)
     .reply(200, "Hello World!");

  http.get({
     host: "www.headier.com"
    , method: 'GET'
    , path: '/'
    , port: 80
    , headers: {'X-My-Headers': 'My Header 1.0'}
  }, function(res) {
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      t.equal(data, 'Hello World!');
    });

    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

});

test("match all headers", function(t) {
  var scope = nock('http://api.headdy.com')
     .matchHeader('accept', 'application/json')
     .get('/one')
     .reply(200, { hello: "world" })
     .get('/two')
     .reply(200, { a: 1, b: 2, c: 3 });

  var ended = 0;
  function callback() {
    ended += 1;
    if (ended === 2) {
      scope.done();
      t.end();
    }
  }
  
  http.get({
     host: "api.headdy.com"
    , path: '/one'
    , port: 80
    , headers: {'Accept': 'application/json'}
  }, function(res) {
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      t.equal(data, '{"hello":"world"}');
    });

    res.on('end', callback);
  });

  http.get({
     host: "api.headdy.com"
    , path: '/two'
    , port: 80
    , headers: {'accept': 'application/json'}
  }, function(res) {
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      t.equal(data, '{"a":1,"b":2,"c":3}');
    });

    res.on('end', callback);
  });

});

test("header manipulation", function(t) {
  var scope = nock('http://example.com')
                .get('/accounts')
                .reply(200, { accounts: [{ id: 1, name: 'Joe Blow' }] })
    , req;

  req = http.get({ host: 'example.com', path: '/accounts' }, function (res) {
    res.on('end', function () {
      scope.done();
      t.end();
    });
  });

  req.setHeader('X-Custom-Header', 'My Value');
  t.equal(req.getHeader('X-Custom-Header'), 'My Value', 'Custom header was not set');

  req.removeHeader('X-Custom-Header');
  t.notOk(req.getHeader('X-Custom-Header'), 'Custom header was not removed');

  req.end();
});

test("head", function(t) {
  var dataCalled = false;
  
  var scope = nock('http://www.google.com')
     .head('/form')
     .reply(201, "OK!");

   var req = http.request({
       host: "www.google.com"
     , method: 'HEAD'
     , path: '/form'
     , port: 80
   }, function(res) {

     t.equal(res.statusCode, 201);
     res.on('end', function() {
       scope.done();
       t.end();
     });
   });

   req.end();
});

test("body data is differentiating", function(t) {
  var doneCount = 0
    , scope = nock('http://www.boddydiff.com')
               .post('/', 'abc')
               .reply(200, "Hey 1")
               .post('/', 'def')
               .reply(200, "Hey 2");

   function done(t) {
     doneCount += 1;
     if (doneCount === 2) {
       scope.di
     }
     t.end();
   };


  t.test("A", function(t) {
    var req = http.request({
       host: "www.boddydiff.com"
      , method: 'POST'
      , path: '/'
      , port: 80
    }, function(res) {
       var dataCalled = false;
       t.equal(res.statusCode, 200);
       res.on('end', function() {
         t.ok(dataCalled);
         done(t);
       });
       res.on('data', function(data) {
         dataCalled = true;
         t.ok(data instanceof Buffer, "data should be buffer");
         t.equal(data.toString(), "Hey 1", "response should match");
       });
    });

    req.end('abc');
  });

  t.test("B", function(t) {
    var req = http.request({
       host: "www.boddydiff.com"
      , method: 'POST'
      , path: '/'
      , port: 80
    }, function(res) {
       var dataCalled = false;
       t.equal(res.statusCode, 200);
       res.on('end', function() {
         t.ok(dataCalled);
         done(t);
       });
       res.on('data', function(data) {
         dataCalled = true;
         t.ok(data instanceof Buffer, "data should be buffer");
         t.equal(data.toString(), "Hey 2", "response should match");
       });
    });

    req.end('def');
  });

});

test("chaining", function(t) {
  var repliedCount = 0;
  var scope = nock('http://www.spiffy.com')
     .get('/')
     .reply(200, "Hello World!")
     .post('/form')
     .reply(201, "OK!");
   
   function endOne(t) {
     repliedCount += 1;
     if (t === 2) {
       scope.done();
     }
     t.end();
   }
   
   t.test("post", function(t) {
     var dataCalled;
     var req = http.request({
         host: "www.spiffy.com"
       , method: 'POST'
       , path: '/form'
       , port: 80
     }, function(res) {

       t.equal(res.statusCode, 201);
       res.on('end', function() {
         t.ok(dataCalled);
         endOne(t);
       });
       res.on('data', function(data) {
         dataCalled = true;
         t.ok(data instanceof Buffer, "data should be buffer");
         t.equal(data.toString(), "OK!", "response should match");
       });

     });

     req.end();
   });

   t.test("get", function(t) {
     var dataCalled;
     var req = http.request({
         host: "www.spiffy.com"
       , method: 'GET'
       , path: '/'
       , port: 80
     }, function(res) {

       t.equal(res.statusCode, 200);
       res.on('end', function() {
         t.ok(dataCalled);
         scope.done();
         t.end();
       });
       res.on('data', function(data) {
         dataCalled = true;
         t.ok(data instanceof Buffer, "data should be buffer");
         t.equal(data.toString(), "Hello World!", "response should match");
       });

     });

     req.end();
   });
});

test("encoding", function(t) {
  var dataCalled = false
  
  var scope = nock('http://www.encoderz.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      host: "www.encoderz.com"
    , path: '/'
    , port: 80
  }, function(res) {
    
    res.setEncoding('base64');
    
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(dataCalled);
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.type(data, 'string', "data should be string");
      t.equal(data, "SGVsbG8gV29ybGQh", "response should match base64 encoding");
    });
    
  });
  
  req.end();
});

test("reply with file", function(t) {
  var dataCalled = false
  
  var scope = nock('http://www.filereplier.com')
    .get('/')
    .replyWithFile(200, __dirname + '/../assets/reply_file_1.txt')
    .get('/test')
    .reply(200, 'Yay!');

  var req = http.request({
      host: "www.filereplier.com"
    , path: '/'
    , port: 80
  }, function(res) {
    
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(dataCalled);
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.equal(data.toString(), "Hello from the file!", "response should match");
    });
    
  });
  
  req.end();
  
});

test("reply with file and pipe response", function(t) {
  var scope = nock('http://www.files.com')
    .get('/')
    .replyWithFile(200, __dirname + '/../assets/reply_file_1.txt')

  var req = http.get({
      host: "www.files.com"
    , path: '/'
    , port: 80
  }, function(res) {
    var str = '';
    var fakeStream = new(require('stream').Stream);
    fakeStream.writable = true;

    fakeStream.write = function(d) {
      str += d;
    };

    fakeStream.end = function() {
      t.equal(str, "Hello from the file!", "response should match");
      t.end();
    };

    res.pipe(fakeStream);
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);
    
  });
  
});

test("reply with file with mikeal/request", function(t) {
  var scope = nock('http://www.files.com')
    .get('/')
    .replyWithFile(200, __dirname + '/../assets/reply_file_1.txt')

  var options = { uri: 'http://www.files.com/', onResponse: true };
  mikealRequest('http://www.files.com/', function(err, res, body) {
    if (err) {
      throw err;
    }

    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);

    t.equal(body, "Hello from the file!", "response should match");
    t.end();
  });
  
});

test("reply with JSON", function(t) {
  var dataCalled = false
  
  var scope = nock('http://www.jsonreplier.com')
    .get('/')
    .reply(200, {hello: "world"});

  var req = http.request({
      host: "www.jsonreplier.com"
    , path: '/'
    , port: 80
  }, function(res) {
    
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(dataCalled);
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.equal(data.toString(), '{"hello":"world"}', "response should match");
    });
    
  });
  
  req.end();
  
});

test("filter path with function", function(t) {
  var scope = nock('http://www.filterurls.com')
     .filteringPath(function(path) {
        return '/?a=2&b=1';
      })
     .get('/?a=2&b=1')
     .reply(200, "Hello World!");

  var req = http.request({
     host: "www.filterurls.com"
    , method: 'GET'
    , path: '/?a=1&b=2'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     scope.done();
     t.end();
   });
  });

  req.end();
});

test("filter path with regexp", function(t) {
  var scope = nock('http://www.filterurlswithregexp.com')
     .filteringPath(/\d/g, '3')
     .get('/?a=3&b=3')
     .reply(200, "Hello World!");

  var req = http.request({
     host: "www.filterurlswithregexp.com"
    , method: 'GET'
    , path: '/?a=1&b=2'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     scope.done();
     t.end();
   });
  });

  req.end();
});

test("filter body with function", function(t) {
  var scope = nock('http://www.filterboddiez.com')
     .filteringRequestBody(function(body) {
       t.equal(body, 'mamma mia');
        return 'mamma tua';
      })
     .post('/', 'mamma tua')
     .reply(200, "Hello World!");

  var req = http.request({
     host: "www.filterboddiez.com"
    , method: 'POST'
    , path: '/'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     scope.done();
     t.end();
   });
  });

  req.end('mamma mia');
});

test("filter body with regexp", function(t) {
  var scope = nock('http://www.filterboddiezregexp.com')
     .filteringRequestBody(/mia/, 'nostra')
     .post('/', 'mamma nostra')
     .reply(200, "Hello World!");

  var req = http.request({
     host: "www.filterboddiezregexp.com"
    , method: 'POST'
    , path: '/'
    , port: 80
  }, function(res) {
   t.equal(res.statusCode, 200);
   res.on('end', function() {
     scope.done();
     t.end();
   });
  });

  req.end('mamma mia');
});

test("abort request", function(t) {
  var scope = nock('http://www.google.com')
    .get('/hey')
    .reply(200, 'nobody');

  var req = http.request({
    host: 'www.google.com'
   , path: '/hey'
  });

  req.on('response', function(res) {
    res.on('close', function(err) {
      t.equal(err.code, 'aborted');
      scope.done();
      t.end();
    });

    res.on('end', function() {
      t.true(false, 'this should never execute');
    });
    
    req.abort();
  });

  req.end();
});

test("pause response before data", function(t) {
  var scope = nock('http://www.mouse.com')
    .get('/pauser')
    .reply(200, 'nobody');

  var req = http.request({
    host: 'www.mouse.com'
   , path: '/pauser'
  });

  req.on('response', function(res) {
    res.pause();

    var waited = false;
    setTimeout(function() {
      waited = true;
      res.resume();
    }, 500);

    res.on('data', function(data) {
      t.true(waited);
    });

    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

  req.end();
});

test("pause response after data", function(t) {
  var scope = nock('http://pauseme.com')
    .get('/')
    .reply(200, 'nobody');

  var req = http.get({
    host: 'pauseme.com'
   , path: '/'
  }, function(res) {
    var waited = false;
    setTimeout(function() {
      waited = true;
      res.resume();
    }, 500);

    res.on('data', function(data) {
      t.false(waited);
      res.pause();
    });

    res.on('end', function() {
      t.true(waited);
      scope.done();
      t.end();
    });
  });
});

test("response pipe", function(t) {
  var dest = (function() {
    function Constructor() {
      events.EventEmitter.call(this);

      this.buffer = new Buffer(0);
      this.writable = true;
    }

    util.inherits(Constructor, events.EventEmitter);

    Constructor.prototype.end = function() {
      this.emit('end');
    };

    Constructor.prototype.write = function(chunk) {
      var buf = new Buffer(this.buffer.length + chunk.length);

      this.buffer.copy(buf);
      chunk.copy(buf, this.buffer.length);

      this.buffer = buf;

      return true;
    };

    return new Constructor();
  })();

  var scope = nock('http://pauseme.com')
    .get('/')
    .reply(200, 'nobody');

  var req = http.get({
    host: 'pauseme.com'
   , path: '/'
  }, function(res) {
    dest.on('pipe', function() {
      t.pass('should emit "pipe" event')
    });

    dest.on('end', function() {
      scope.done();
      t.equal(dest.buffer.toString(), 'nobody');
      t.end();
    });

    res.pipe(dest);
  });
});

test("response pipe without implicit end", function(t) {
  var dest = (function() {
    function Constructor() {
      events.EventEmitter.call(this);

      this.buffer = new Buffer(0);
      this.writable = true;
    }

    util.inherits(Constructor, events.EventEmitter);

    Constructor.prototype.end = function() {
      this.emit('end');
    };

    Constructor.prototype.write = function(chunk) {
      var buf = new Buffer(this.buffer.length + chunk.length);

      this.buffer.copy(buf);
      chunk.copy(buf, this.buffer.length);

      this.buffer = buf;

      return true;
    };

    return new Constructor();
  })();

  var scope = nock('http://pauseme.com')
    .get('/')
    .reply(200, 'nobody');

  var req = http.get({
    host: 'pauseme.com'
   , path: '/'
  }, function(res) {
    dest.on('end', function() {
      t.fail('should not call end implicitly');
    });

    res.on('end', function() {
      scope.done();
      t.pass('should emit end event');
      t.end();
    });

    res.pipe(dest, {end: false});
  });
});

test("chaining API", function(t) {
  var scope = nock('http://chainchomp.com')
    .get('/one')
    .reply(200, 'first one')
    .get('/two')
    .reply(200, 'second one');

  http.get({
    host: 'chainchomp.com'
   , path: '/one'
  }, function(res) {
    res.setEncoding('utf8');
    t.equal(res.statusCode, 200, 'status should be ok');
    res.on('data', function(data) {
      t.equal(data, 'first one', 'should be equal to first reply');
    });

    res.on('end', function() {

      http.get({
        host: 'chainchomp.com'
       , path: '/two'
      }, function(res) {
        res.setEncoding('utf8');
        t.equal(res.statusCode, 200, 'status should be ok');
        res.on('data', function(data) {
          t.equal(data, 'second one', 'should be qual to second reply');
        });

        res.on('end', function() {
          scope.done();
          t.end();
        });
      });

    });
  });
});

test("same URI", function(t) {
  var scope = nock('http://sameurii.com')
    .get('/abc')
    .reply(200, 'first one')
    .get('/abc')
    .reply(200, 'second one');

  http.get({
    host: 'sameurii.com'
   , path: '/abc'
  }, function(res) {
    res.on('data', function(data) {
      res.setEncoding('utf8');
      t.equal(data.toString(), 'first one', 'should be qual to first reply');
      res.on('end', function() {
        http.get({
          host: 'sameurii.com'
         , path: '/abc'
        }, function(res) {
          res.setEncoding('utf8');
          res.on('data', function(data) {
            t.equal(data.toString(), 'second one', 'should be qual to second reply');
            res.on('end', function() {
              scope.done();
              t.end();
            });
          });
        });
      });
    });
  });
});

test("can use hostname instead of host", function(t) {
  var scope = nock('http://www.google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      hostname: "www.google.com"
    , path: '/'
  }, function(res) {

    t.equal(res.statusCode, 200);
    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

  req.end();
});

test("can take a port", function(t) {
  var scope = nock('http://www.myserver.com:3333')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      hostname: "www.myserver.com"
    , path: '/'
    , port: 3333
  }, function(res) {
    
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      scope.done();
      t.end();
    });
  });

  req.end();
});

test("can use https", function(t) {
  var dataCalled = false

  var scope = nock('https://google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = https.request({
      host: "google.com"
    , path: '/'
  }, function(res) {
    t.equal(res.statusCode, 200);
    res.on('end', function() {
      t.ok(dataCalled, 'data event called');
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
    });
  });

  req.end();
});

test("complaints if https route is missing", function(t) {
  var dataCalled = false

  var scope = nock('https://google.com')
    .get('/')
    .reply(200, "Hello World!");

  try {
    var req = https.request({
        host: "google.com"
      , path: '/abcdef892932'
    }, function(res) {
      throw new Error('should not come here!');
    }).end();
  } catch (err) {
    t.ok(err.message.match(/No match for HTTP request GET \/abcdef892932/));
    t.end();
  }
  

});

test("can use ClientRequest using GET", function(t) {
  
  var dataCalled = false

  var scope = nock('http://www2.clientrequester.com')
    .get('/dsad')
    .reply(202, "HEHE!");
    
  var req = new http.ClientRequest({
      host: "www2.clientrequester.com"
    , path: '/dsad'
  });
  req.end();

  req.on('response', function(res) {
    t.equal(res.statusCode, 202);
    res.on('end', function() {
      t.ok(dataCalled, "data event was called");
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "HEHE!", "response should match");
    });
  });

  req.end();
});

test("can use ClientRequest using POST", function(t) {
  
  var dataCalled = false

  var scope = nock('http://www2.clientrequester.com')
    .post('/posthere/please', 'heyhey this is the body')
    .reply(201, "DOOONE!");
    
  var req = new http.ClientRequest({
      host: "www2.clientrequester.com"
    , path: '/posthere/please'
    , method: 'POST'
  });
  req.write('heyhey this is the body');
  req.end();

  req.on('response', function(res) {
    t.equal(res.statusCode, 201);
    res.on('end', function() {
      t.ok(dataCalled, "data event was called");
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "DOOONE!", "response should match");
    });
  });

  req.end();
});

test("same url matches twice", function(t) {
  var scope = nock('http://www.twicematcher.com')
     .get('/hey')
     .reply(200, "First match")
     .get('/hey')
     .reply(201, "Second match");
     
  var replied = 0;
  
  function callback() {
    replied += 1;
    if (replied == 2) {
      scope.done();
      t.end();
    }
  }

  http.get({
     host: "www.twicematcher.com"
    , path: '/hey'
  }, function(res) {
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      t.equal(data.toString(), 'First match', 'should match first request response body');
    });

    res.on('end', callback);
  });

  http.get({
     host: "www.twicematcher.com"
    , path: '/hey'
  }, function(res) {
    t.equal(res.statusCode, 201);

    res.on('data', function(data) {
      t.equal(data.toString(), 'Second match', 'should match second request response body');
    });

    res.on('end', callback);
  });

});

test("scopes are independent", function(t) {
  var scope1 = nock('http://www34.google.com')
    .get('/')
    .reply(200, "Hello World!");
  var scope2 = nock('http://www34.google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      host: "www34.google.com"
    , path: '/'
    , port: 80
  }, function(res) {
    res.on('end', function() {
      t.ok(scope1.isDone());
      t.ok(! scope2.isDone()); // fails
      t.end();
    });
  });

  req.end();
});

test("two scopes with the same request are consumed", function(t) {
  var scope1 = nock('http://www36.google.com')
    .get('/')
    .reply(200, "Hello World!");
  
  var scope2 = nock('http://www36.google.com')
    .get('/')
    .reply(200, "Hello World!");
  
  var doneCount = 0;
  function done() {
    doneCount += 1;
    if (doneCount == 2) {
      t.end();
    }
  }

  for (var i = 0; i < 2; i += 1) {
    var req = http.request({
        host: "www36.google.com"
      , path: '/'
      , port: 80
    }, function(res) {
      res.on('end', done);
    });

    req.end();
  }
});

test("allow unmocked option works", function(t) {
  var scope = nock('http://www.google.com', {allowUnmocked: true})
    .get('/abc')
    .reply(200, 'Hey!')
    .get('/wont/get/here')
    .reply(200, 'Hi!');

  function secondIsDone() {
    t.ok(! scope.isDone());
    http.request({
        host: "www.google.com"
      , path: "/"
      , port: 80
    }, function(res) {
      res.destroy();
      t.assert(res.statusCode < 400 && res.statusCode >= 200, 'GET Google Home page');
      t.end();
    }).end();
  }

  function firstIsDone() {
    t.ok(! scope.isDone());
    http.request({
        host: "www.google.com"
      , path: "/does/not/exist/dskjsakdj"
      , port: 80
    }, function(res) {
      t.assert(res.statusCode === 404, 'Google say it does not exist');
      res.on('data', function() {});
      res.on('end', secondIsDone);
    }).end();
  }

  http.request({
      host: "www.google.com"
    , path: "/abc"
    , port: 80
  }, function(res) {
    res.on('end', firstIsDone);
  }).end();
});

test("default reply headers work", function(t) {
  var scope = nock('http://default.reply.headers.com')
    .defaultReplyHeaders({'X-Powered-By': 'Meeee', 'X-Another-Header': 'Hey man!'})
    .get('/')
    .reply(200, '', {A: 'b'});

  function done(res) {
    t.deepEqual(res.headers, {'x-powered-by': 'Meeee', 'x-another-header': 'Hey man!', a: 'b'});
    t.end();
  }

  http.request({
      host: 'default.reply.headers.com'
    , path: '/'
  }, done).end();
});

test('clean all works', function(t) {
  var scope = nock('http://amazon.com')
    .get('/nonexistent')
    .reply(200);

  var req = http.get({host: 'amazon.com', path: '/nonexistent'}, function(res) {
    t.assert(res.statusCode === 200, "should mock before cleanup");

    nock.cleanAll();

    var req = http.get({host: 'amazon.com', path: '/nonexistent'}, function(res) {
      res.destroy();
      t.assert(res.statusCode !== 200, "should clean up properly");
      t.end();
    }).on('error', function(err) {
      t.end();
    });
  });

});

test('username and password works', function(t) {
  var scope = nock('http://passwordyy.com')
    .get('/')
    .reply(200, "Welcome, username");

  http.request({
    hostname: 'passwordyy.com',
    auth: "username:password",
    path: '/'
  }, function(res) {
    scope.done();
    t.end();
  }).end();
});


test('works with mikeal/request and username and password', function(t) {
    var scope = nock('http://passwordyyyyy.com')
      .get('/abc')
      .reply(200, "Welcome, username");

  mikealRequest({uri: 'http://username:password@passwordyyyyy.com/abc', log:true}, function(err, res, body) {
    t.ok(! err, 'error');
    t.ok(scope.isDone());
    t.equal(body, "Welcome, username");
    t.end();
  });

});

test('different ports work works', function(t) {
  var scope = nock('http://abc.portyyyy.com:8081')
    .get('/pathhh')
    .reply(200, "Welcome, username");

  http.request({
    hostname: 'abc.portyyyy.com',
    port: 8081,
    path: '/pathhh'
  }, function(res) {
    scope.done();
    t.end();
  }).end();
});

test('different ports work work with Mikeal request', function(t) {
  var scope = nock('http://abc.portyyyy.com:8082')
    .get('/pathhh')
    .reply(200, "Welcome to Mikeal Request!");

  mikealRequest.get('http://abc.portyyyy.com:8082/pathhh', function(err, res, body) {
    t.ok(! err, 'no error');
    t.equal(body, 'Welcome to Mikeal Request!');
    t.ok(scope.isDone());
    t.end();
  });
});

test('explicitly specifiying port 80 works', function(t) {
  var scope = nock('http://abc.portyyyy.com:80')
    .get('/pathhh')
    .reply(200, "Welcome, username");

  http.request({
    hostname: 'abc.portyyyy.com',
    port: 80,
    path: '/pathhh'
  }, function(res) {
    scope.done();
    t.end();
  }).end();
});

test('post with object', function(t) {
  var scope = nock('http://uri')
    .post('/claim', {some_data: "something"})
    .reply(200);

  http.request({
    hostname: 'uri',
    port: 80,
    method: "POST",
    path: '/claim'
  }, function(res) {
    scope.done();
    t.end();
  }).end('{"some_data":"something"}');

});

test('accept string as request target', function(t) {
  var scope = nock('http://www.example.com')
    .get('/')
    .reply(200, "Hello World!");

  http.get('http://www.example.com', function(res) {
    t.equal(res.statusCode, 200);

    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
    });

    res.on('end', function() {
      t.ok(dataCalled);
      scope.done();
      t.end();
    });
  });
});

test('request has path', function(t) {
  var scope = nock('http://haspath.com')
    .get('/the/path/to/infinity')
    .reply(200);

  var req = http.request({
    hostname: 'haspath.com',
    port: 80,
    method: "GET",
    path: '/the/path/to/infinity'
  }, function(res) {
    scope.done();
    t.equal(req.path, '/the/path/to/infinity', 'should have req.path set to /the/path/to/infinity');
    t.end();
  });
  req.end();
});

test('persists interceptors', function(t) {
  var scope = nock('http://persisssists.con')
    .persist()
    .get('/')
    .reply(200, "Persisting all the way");

  http.get('http://persisssists.con/', function(res) {
    t.ok(! scope.isDone());
    http.get('http://persisssists.con/', function(res) {
      t.ok(! scope.isDone());
      t.end();
    }).end();
  }).end();
});

test('(re-)activate after restore', function(t) {
  var scope = nock('http://google.com')
    .get('/')
    .reply(200, 'Hello, World!');

  nock.restore();

  http.get('http://google.com/', function(res) {
    res.resume();
    res.on('end', function() {
      t.ok(! scope.isDone());

      nock.activate();
      http.get('http://google.com', function(res) {
        res.resume();
        res.on('end', function() {
          t.ok(scope.isDone());
          t.end();
        });
      }).end();
    });
  }).end();
});

test("allow unmocked option works with https", function(t) {
  t.plan(5)
  var scope = nock('https://www.google.com', {allowUnmocked: true})
    .get('/abc')
    .reply(200, 'Hey!')
    .get('/wont/get/here')
    .reply(200, 'Hi!');

  function secondIsDone() {
    t.ok(! scope.isDone());
    https.request({
        host: "www.google.com"
      , path: "/"
    }, function(res) {
      res.resume();
      t.ok(true, 'Google replied to /');
      res.destroy();
      t.assert(res.statusCode < 400 && res.statusCode >= 200, 'GET Google Home page');
    }).end();
  }

  function firstIsDone() {
    t.ok(! scope.isDone(), 'scope is not done');
    https.request({
        host: "www.google.com"
      , path: "/does/not/exist/dskjsakdj"
    }, function(res) {
      t.equal(503, res.statusCode, 'real google response status code');
      res.on('data', function() {});
      res.on('end', secondIsDone);
    }).end();
  }

  https.request({
      host: "www.google.com"
    , path: "/abc"
  }, function(res) {
    res.on('end', firstIsDone);
  }).end();
});


test('allow unmocked post with json data', function(t) {
  var scope = nock('https://httpbin.org', { allowUnmocked: true }).
    get("/abc").
    reply(200, "Hey!");

  var options = {
    method: 'POST',
    uri: 'https://httpbin.org/post',
    json: { some: 'data' }
  };

  mikealRequest(options, function(err, resp, body) {
    t.equal(200, resp.statusCode)
    t.end();
  });
});

test('allow unordered body with json encoding', function(t) {
  var scope =
  nock('http://wtfjs.org')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo'
    })
    .reply(200, 'Heyyyy!');

  mikealRequest({
    uri: 'http://wtfjs.org/like-wtf',
    method: 'POST',
    json: {
      bar: 'foo',
      foo: 'bar'
    }},
  function (e, r, body) {
    t.equal(body, 'Heyyyy!');
    scope.done();
    t.end();
  });
});

test('allow unordered body with form encoding', function(t) {
  var scope =
  nock('http://wtfjs.org')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo'
    })
    .reply(200, 'Heyyyy!');

  mikealRequest({
    uri: 'http://wtfjs.org/like-wtf',
    method: 'POST',
    form: {
      bar: 'foo',
      foo: 'bar'
    }},
  function (e, r, body) {
    t.equal(body, 'Heyyyy!');
    scope.done();
    t.end();
  });
});


test('allow string json spec', function(t) {
  var bodyObject = {bar: 'foo', foo: 'bar'};

  var scope =
  nock('http://wtfjs.org')
    .post('/like-wtf', JSON.stringify(bodyObject))
    .reply(200, 'Heyyyy!');

  mikealRequest({
    uri: 'http://wtfjs.org/like-wtf',
    method: 'POST',
    json: {
      bar: 'foo',
      foo: 'bar'
    }},
  function (e, r, body) {
    t.equal(body, 'Heyyyy!');
    scope.done();
    t.end();
  });
});