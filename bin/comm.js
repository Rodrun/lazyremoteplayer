/*
 * Socket communications module. Handles socket-io events between
 * media and control clients.
 */

var queue = require("../queue.js");

module.exports = (server) => {

if (!server) {
    throw "HTTP Server must be given for comms to work.";
} else {
    console.log("COMM active");
}

/**
 * Create Socket IO instance and events.
 */
var io = require("socket.io")(server);
var mediaClient = null; // Media client socket
var volume = 1; // Media client volume

/**
 * Emit an event to the active media client--if any.
 * 
 * @param {Object} mc Media client socket.
 * @param {String} event Name of event.
 * @param {Any} data Data to send.
 */
function mediaClientEmit(mc, event, data) {
  try {
    mc.emit(event, data);
  } catch (err) {
    console.log("Error occurred on socket.emit: " + err);
  }
}
/**
 * Emit a standard greet to the client socket.
 * 
 * @param socket Socket object.
 */
function emitGreet(socket) {
  socket.emit("greet", {
    "queue": queue.queue,
    "delta": queue.getDeltaNumber()
  });
}

/**
 * Check if x is within given min and max.
 * Expect false if min > max.
 * 
 * @param {Number} x Input.
 * @param {Number} min Minimum bound.
 * @param {Number} max Maximum bound.
 * @returns If min <= x <= max.
 */
function withinBounds(x, min, max) {
  return x >= min && x <= max;
}

/**
 * Clamp x within a minimum and maximum boundary, so it never is over or under
 * the respective boundaries.
 *
 * @param x {Number} Input.
 * @param min {Number} Minimum bound.
 * @param max {Number} Maximum bound.
 */
function clampTo(x, min, max) {
  if (x < min) {
    return min;
  } else if (x > max) {
    return max;
  }
  return x;
}

/**
 * Broadcast delta update to all other sockets. Will not check for
 * delta validitiy!
 * 
 * @param {Object} socket Socket to use.
 * @param {Object} d Delta object.
 * @param {Boolean} include Also emit to given socket.
 */
function emitDeltaUpdate(socket, d, include) {
  if (socket) {
    socket.broadcast.emit("delta update", d);
    if (include) {
      socket.emit("delta update", d);
    }
  }
}

// New client connection
io.on("connection", function(socket) {
  // Register as control or media client
  var isMediaClient = socket.handshake.query.mediaClient;
  // Only allow one media client to have an active connection
  if (isMediaClient && mediaClient) {
    console.log("Disconnecting attempted media client");
    socket.disconnect(true);
  }
  
  if (!isMediaClient) {
    /* CLIENT EVENTS */
    console.log("CLIENT control connected");

    socket.on("get all", function(data) {
      emitGreet(socket);
    });
  
    // Client wants to add a delta (change to queue)
    socket.on("propose", function(data) {
      console.log("CLIENT proposed: " + JSON.stringify(data));
      queue.performDelta(data).then((newDelta) => {
        console.log("COMM good delta accepted");
        socket.emit("good delta", newDelta);
        // Notify everyone about the new delta
        emitDeltaUpdate(socket, newDelta);
      },
      (err) => {
        console.error("proposal error: " + err);
        // TODO: use diff
        socket.emit("bad delta");
      });
    });

    socket.on("play", function() {
      mediaClientEmit(mediaClient, "play");
    });

    socket.on("pause", function() {
      mediaClientEmit(mediaClient, "pause");
    });

    socket.on("next", function() {
      // Going to the next element in the queue is done by deleting the first
      queue.proceedToNext((newDelta) => {
        // Notify everyone, because we modified the queue
        emitDeltaUpdate(socket, newDelta, true);
        //mediaClientEmit(mediaClient, "set url", queue.getCurrent().url);
      }, (cur) => { // If there isn't anything to pop (and queue length = 1)
        mediaClientEmit(mediaClient, "set url", cur.url);
      });
    });

    socket.on("volume edit", function(vol) {
      // Shallow validation
      console.log("CLIENT recieved vol = " + vol);
      if (t(vol).isNumber) {
        if (withinBounds(Math.abs(vol), 0, 1)) {
          volume = clampTo(volume + vol, 0, 1);
          // Emit to media client
          mediaClientEmit(mediaClient, "volume", {volume: volume});
        }
      }
    });
  } else {
    /* MEDIA CLIENT EVENTS */
    console.log("MEDIA client connected");
    mediaClient = socket;

    // Only initially let know of the current if there is one
    if (queue.getCurrent())
      mediaClientEmit(mediaClient, "set url", queue.getCurrent().url);

    socket.on("media ended", function() {
      // Auto play next (if any)
      queue.proceedToNext((newDelta) => {
        console.log("COMM auto-playing next in queue");
        emitDeltaUpdate(socket, newDelta);
        mediaClientEmit(mediaClient, "set url", queue.getCurrent().url);
      }, () => {});
    });

    socket.on("disconnect", function() {
      console.log("MEDIA client disconnected!");
      mediaClient = null; // Allow new media client
    });

    socket.on("error", function(err) {
      console.log("MEDIA client error: " + err);
    });
  }
});

};
