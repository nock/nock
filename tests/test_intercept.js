var nock    = require('../.')
var http    = require('http');
var util    = require('util');
var events  = require('events');
var tap     = require('tap');

tap.test("get gets mocked", function(t) {
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

tap.test("not mocked should work in http", function(t) {
  var dataCalled = false;

  var scope = nock('http://www.yahoo.com')
    .get('/')
    .reply(200, "Hello World!");

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
    
    req.end();

  t.end();
});

tap.test("post", function(t) {
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

tap.test("request headers exposed", function(t) {

  var scope = nock('http://www.headdy.com')
     .get('/')
     .reply(200, "Hello World!", {'X-My-Headers': 'My Header value'});

  var req = http.request({
     host: "www.headdy.com"
    , method: 'GET'
    , path: '/'
    , port: 80
    , headers: {'X-My-Headers': 'My custom Header value'}
  });

  t.equivalent(req._headers, {'x-my-headers': 'My custom Header value', 'host': 'www.headdy.com'});
  t.end();
});

tap.test("headers work", function(t) {

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
     t.similar(res.headers, {'X-My-Headers': 'My Header value'});
     t.end();
   });
  });

  req.end();

});

tap.test("body data is differentiating", function(t) {
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

tap.test("chaining", function(t) {
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

tap.test("encoding", function(t) {
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

tap.test("reply with file", function(t) {
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

tap.test("reply with JSON", function(t) {
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

tap.test("filter path with function", function(t) {
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

tap.test("filter path with regexp", function(t) {
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

tap.test("filter body with function", function(t) {
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

tap.test("filter body with regexp", function(t) {
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

tap.test("abort request", function(t) {
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

tap.test("pause response before data", function(t) {
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

tap.test("pause response after data", function(t) {
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

tap.test("response pipe", function(t) {
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

tap.test("response pipe without implicit end", function(t) {
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

tap.test("chaining API", function(t) {
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

tap.test("same URI", function(t) {
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