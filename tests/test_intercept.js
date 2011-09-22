var nock = require('../.')
var http = require('http');
var tap  = require('tap');

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
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
      scope.done();
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
       t.end();
     });
     res.on('data', function(data) {
       dataCalled = true;
       t.ok(data instanceof Buffer, "data should be buffer");
       t.equal(data.toString(), "OK!", "response should match");
       scope.done();
     });

   });

   req.end();
});

tap.test("headers work", function(t) {
  t.end();
});

tap.test("body data is differentiating", function(t) {
  t.end();
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
         t.end();
       });
       res.on('data', function(data) {
         dataCalled = true;
         t.ok(data instanceof Buffer, "data should be buffer");
         t.equal(data.toString(), "Hello World!", "response should match");
         scope.done();
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
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.type(data, 'string', "data should be string");
      t.equal(data, "SGVsbG8gV29ybGQh", "response should match base64 encoding");
      scope.done();
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