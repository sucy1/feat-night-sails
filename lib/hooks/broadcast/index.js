module.exports = function(sails) {

  return {

    initialize: function(cb) {

      sails.broadcast = function(eventName, data) {
        return new Promise(function(resolve, reject) {
          if (!eventName) {
            return reject(new Error('`sails.broadcast()` called without an event name. API is `.broadcast(eventName, data)`.'));
          }
          if (!sails.io || !sails.io.sockets) {
            return reject(new Error('Cannot broadcast: socket.io is not available. Make sure the `sockets` hook is enabled.'));
          }
          try {
            sails.io.sockets.emit(eventName, data);
            return resolve();
          } catch (err) {
            return reject(err);
          }
        });
      };

      sails.broadcastToRoom = function(roomName, eventName, data) {
        return new Promise(function(resolve, reject) {
          if (!roomName) {
            return reject(new Error('`sails.broadcastToRoom()` called without a room name. API is `.broadcastToRoom(roomName, eventName, data)`.'));
          }
          if (!eventName) {
            return reject(new Error('`sails.broadcastToRoom()` called without an event name. API is `.broadcastToRoom(roomName, eventName, data)`.'));
          }
          if (!sails.sockets) {
            return reject(new Error('Cannot broadcast to room: sails.sockets is not available. Make sure the `sockets` hook is enabled.'));
          }
          try {
            sails.sockets.broadcast(roomName, eventName, data);
            return resolve();
          } catch (err) {
            return reject(err);
          }
        });
      };

      return cb();
    }

  };

};
