# Client/Server socket communication

In order to keep client and server queues synchronized, the client and server are connected via socket.io. See `DELTA.md` for further references on delta. There are two distinct types of connections: _server-control client_ and _server-media client_. _Server-control client_ refers to a connection between the server and a "normal" client that'll make requests to the queue and media player status. _Server-media client_ connections accept media player state change data, and only one of these are permitted.

## On initial connection

### Server-control client connection

Once the server accepts the client's connection, the server emits a `"greet"` with the queue and the server delta number.

### Server-media client connection

The client should emit a `"register media"`, in which the server will register the media client, _only if_ there is currently no other media client (at the moment, only one media client is allowed).

## Socket events to listen for (server-control client)

### `"get all"`

__To__ server __from__ client.

Client requests the entire queue and the delta number. Server should then emit `"greet"` event.

### `"delta update"`

__To__ all clients __from__ server.

Broadcast new delta to all clients. The data is the same as a delta object.

### `"greet"`

__To__ client __from__ server.

Greeting message.

__data:__

```js
{
    "queue": [],
    "delta": int
}
```

* Where __queue__ is the server queue array.
* Where __delta__ is the server delta number (int).

### `"propose"`

__To__ server __from__ client.

Propose a new delta. Server should emit `"good delta"` if good request, otherwise `"bad delta"`.

__data:__

```js
{
    "action": int,
    "indexes": [],
    "media": Object
}
```

_See `DELTA.md` for further information on deltas_


### `"good delta"`

__To__ client __from__ server.

Response to client if the proposed delta is valid and added.

### `"bad delta"`

__To__ client __from__ server.

Response to client if the proposed delta is invalid and ignored. Server responds with the same data a `"delta update"` would yield to the client.

### `"pause"`

__To__ server __from__ client.

Request server to pause media.

### `"play"`

__To__ server __from__ client.

Request server to play media.

### `"next"`

__To__ server __from__ client.

Request server to skip to next media in queue.

## Socket events to listen for (server-media client)

All events here are __to__ client __from__ server.

### `"play"`

__To__ server __from__ client.

Play the current media.

### `"pause"`

__To__ server __from__ client.

Pause the current media.

## Socket events to listen for (server-media client)

### `"set url"`

__To__ client __from__ server.

Set the current URL source of the media.

__data:__

```js
{
    "url": String
}
```

### `"play"`

__To__ client __from__ server.

Play media.

### `"pause"`

__To__ client __from__ server.

Pause media.

### `"volume"`

__To__ client __from__ server.

Set the volume of the player. The given volume is in terms of percentages [0.0, 1.0].

__data:__

```js
{
    "volume": Float
}
```

### `"seek"`

__To__ client __from__ server.

To be documented...

### `"media state"`

__To__ server __from__ client.

Update the server on the current state of the media.

__data:__

```js
{
    "volume": Float,
    "playing": Boolean,
    "url": String,
}
```

### `"time"`

__To__ server __from__ client.

To be documented...

## `"media ended"`

__To__ server __from__ client.

Notify the server that the media has finished playing.
