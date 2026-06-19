var Sails = require('../../../lib').Sails;
var SocketIOClient = require('socket.io-client');
delete require.cache[require.resolve('socket.io-client')];
var SailsIOClient = require('sails.io.js');

var io = SailsIOClient(SocketIOClient);
io.sails.environment = 'production';
io.sails.autoConnect = false;

describe('Broadcast hook', function () {

  this.timeout(10000);

  describe('loading a Sails app', function () {

    describe('without sockets hook', function () {
      var app = Sails();
      it('should still load (but methods will throw when called)', function (done) {
        app.load({
          globals: false,
          log: { level: 'silent' },
          hooks: {
            sockets: false,
            orm: false,
            pubsub: false,
            grunt: false
          },
          loadHooks: ['moduleloader', 'userconfig', 'broadcast']
        }, function (err) {
          if (err) { return done(err); }
          if (!app.hooks.broadcast) { return done(new Error('Broadcast hook should have loaded.')); }
          return done();
        });
      });
      after(function (done) {
        app.lower(done);
      });
    });

    describe('with sockets hook', function () {
      var app = Sails();
      it('should load successfully and expose sails.broadcast and sails.broadcastToRoom', function (done) {
        app.load({
          globals: false,
          log: { level: 'warn' },
          hooks: {
            sockets: require('sails-hook-sockets'),
            orm: false,
            pubsub: false,
            grunt: false
          },
          loadHooks: ['moduleloader', 'userconfig', 'http', 'sockets', 'broadcast']
        }, function (err) {
          if (err) { return done(err); }
          if (typeof app.broadcast !== 'function') {
            return done(new Error('sails.broadcast should be a function.'));
          }
          if (typeof app.broadcastToRoom !== 'function') {
            return done(new Error('sails.broadcastToRoom should be a function.'));
          }
          return done();
        });
      });
      after(function (done) {
        app.lower(done);
      });
    });

  });

  describe('broadcast functionality', function () {

    var sails;
    var socket1;
    var socket2;
    var socket3;

    before(function (done) {
      var app = Sails();
      app.lift({
        globals: false,
        log: { level: 'silent' },
        port: 1342,
        hooks: {
          sockets: require('sails-hook-sockets'),
          orm: false,
          pubsub: false,
          grunt: false
        },
        loadHooks: ['moduleloader', 'userconfig', 'http', 'sockets', 'broadcast']
      }, function (err, _sails) {
        if (err) { return done(err); }
        sails = _sails;

        socket1 = io.sails.connect('http://localhost:1342', { multiplex: false });
        socket1.on('connect', function () {
          socket2 = io.sails.connect('http://localhost:1342', { multiplex: false });
          socket2.on('connect', function () {
            socket3 = io.sails.connect('http://localhost:1342', { multiplex: false });
            socket3.on('connect', function () {
              return done();
            });
          });
        });
      });
    });

    after(function (done) {
      if (socket1) { socket1.disconnect(); }
      if (socket2) { socket2.disconnect(); }
      if (socket3) { socket3.disconnect(); }
      if (sails) {
        sails.lower(done);
      } else {
        done();
      }
    });

    describe('sails.broadcast()', function () {

      it('should send event to all connected clients', function (done) {
        var receivedCount = 0;
        var testData = { message: 'Hello everyone!', timestamp: Date.now() };

        function checkDone() {
          receivedCount++;
          if (receivedCount === 3) {
            done();
          }
        }

        socket1.on('test:broadcast', function (data) {
          if (data.timestamp === testData.timestamp) {
            checkDone();
          }
        });

        socket2.on('test:broadcast', function (data) {
          if (data.timestamp === testData.timestamp) {
            checkDone();
          }
        });

        socket3.on('test:broadcast', function (data) {
          if (data.timestamp === testData.timestamp) {
            checkDone();
          }
        });

        sails.broadcast('test:broadcast', testData)
          .then(function () {})
          .catch(done);
      });

      it('should return a promise that resolves after broadcast', function (done) {
        var result = sails.broadcast('test:promise', { foo: 'bar' });
        if (!result || typeof result.then !== 'function') {
          return done(new Error('sails.broadcast should return a promise.'));
        }
        result.then(function () {
          done();
        }).catch(done);
      });

      it('should reject promise if eventName is not provided', function (done) {
        sails.broadcast('', { foo: 'bar' })
          .then(function () {
            done(new Error('Should have rejected promise when eventName is missing.'));
          })
          .catch(function (err) {
            if (err && err.message) {
              done();
            } else {
              done(new Error('Should have rejected with an error message.'));
            }
          });
      });

    });

    describe('sails.broadcastToRoom()', function () {

      it('should only send event to clients in the specified room', function (done) {
        var roomName = 'test-room-' + Date.now();
        var testData = { message: 'Room only!', timestamp: Date.now() };
        var socket1Received = false;
        var socket2Received = false;
        var socket3Received = false;

        socket1.on('test:room', function (data) {
          if (data.timestamp === testData.timestamp) {
            socket1Received = true;
          }
        });

        socket2.on('test:room', function (data) {
          if (data.timestamp === testData.timestamp) {
            socket2Received = true;
          }
        });

        socket3.on('test:room', function (data) {
          if (data.timestamp === testData.timestamp) {
            socket3Received = true;
          }
        });

        var connectedSocketsMap = sails.io.sockets.sockets;
        var socketIds = Array.from(connectedSocketsMap.keys());
        var rawSocket1 = connectedSocketsMap.get(socketIds[0]);
        var rawSocket2 = connectedSocketsMap.get(socketIds[1]);

        rawSocket1.join(roomName);
        rawSocket2.join(roomName);

        setTimeout(function () {
          sails.broadcastToRoom(roomName, 'test:room', testData)
            .then(function () {
              setTimeout(function () {
                if (!socket1Received) {
                  return done(new Error('Socket1 (in room) should have received the message.'));
                }
                if (!socket2Received) {
                  return done(new Error('Socket2 (in room) should have received the message.'));
                }
                if (socket3Received) {
                  return done(new Error('Socket3 (not in room) should NOT have received the message.'));
                }
                done();
              }, 500);
            })
            .catch(done);
        }, 200);
      });

      it('should return a promise that resolves after broadcast', function (done) {
        var result = sails.broadcastToRoom('some-room', 'test:promise', { foo: 'bar' });
        if (!result || typeof result.then !== 'function') {
          return done(new Error('sails.broadcastToRoom should return a promise.'));
        }
        result.then(function () {
          done();
        }).catch(done);
      });

      it('should reject promise if roomName is not provided', function (done) {
        sails.broadcastToRoom('', 'test:event', { foo: 'bar' })
          .then(function () {
            done(new Error('Should have rejected promise when roomName is missing.'));
          })
          .catch(function (err) {
            if (err && err.message) {
              done();
            } else {
              done(new Error('Should have rejected with an error message.'));
            }
          });
      });

      it('should reject promise if eventName is not provided', function (done) {
        sails.broadcastToRoom('some-room', '', { foo: 'bar' })
          .then(function () {
            done(new Error('Should have rejected promise when eventName is missing.'));
          })
          .catch(function (err) {
            if (err && err.message) {
              done();
            } else {
              done(new Error('Should have rejected with an error message.'));
            }
          });
      });

    });

  });

});
