# Delta System

To reduce bandwidth use and keep things efficient, the versioning system of the queue is called the "delta" system. A delta is a structure of data that describes a change to the queue. For this project, a delta is structured as follows:

```js
{
    action: int,
    indexes: [],
    media: Object
}
```

* Where __action__ is a code that describes the delta:
    - `0` = Swap indexes, requires `indexes` to be at least length 2.
    - `1` = Delete index, requires `indexes` to be at least length 1.
    - `2` = Move index, requires `indexes` to be at least length 2.
        - Element `0` of `indexes` is the target index.
        - Element `1` of `indexes` is the destination index.
    - `3` = Add media to queue, requires `media` to not be `null`.
    - `4` = Replace media object at index, requires `indexes` to be at least length 1 and `media` to not be `null`.
    - `5` = Get all of queue. __Do not use__, this is an unused code.
    - `6` = Delete all in queue.
* Where __indexes__ is an array of integers.
* Where __media__ is an object, can be left `null` if not required by the __action__

## Server delta

The server is in charge of of the master queue and the delta list. The delta list is kept for clients to recieve changes necessary to have their queues in-par with the master. If the server is to modify its own queue not commanded by a client (i.e. popping the queue to play next media object), the server must create an appropriate delta for its action--in other words, _EVERY_ action taken against the master queue will have an appropriate delta. Along with this, the server is also responsible for the __delta number__, which is a number representing how many deltas there are in the list (you can also think of it as the queue's "version"). This number should always be a positive integer greater than or equal to 0. This number is used to determine if a client is up to date, because if the client's delta number is the same, it is assumed the client has performed previous delta operations that the server has provided. The server shouldn't give the client its delta number, except in a `"greet"` message.

_Any_ new deltas should trigger the server to broadcast a new delta to all connected clients. By emitting `"delta update"`, with the data being the delta object.

If the server recieves a delta with invalid values for `indexes`, then the server should ignore it and emit a `"bad delta"` to the sender. Otherwise, if a request is successful, add delta and emit `"good delta"` to client, with the data being the added delta object. Because a `"bad delta"` request is in response to a `"propose"`, which contains `"clientDelta"`, the server should return the missing deltas by calculating the difference between the server and client delta numbers (`diff`) and sending the last `diff` deltas. If the client's delta is less than 0, or greater than the server delta, server should respond with a `"greet"`. The server can also set a limit on how "old" the client's delta can be, the environment variable `DELTA_BUFFER_MAX` can be set to set a limit on the server delta array size, so clients with delta numbers lower than the current server delta - `DELTA_BUFFER_MAX` will be given a `"greet"`. 

# Client delta

The client does not need to keep track of a delta list, but it does need to track its own delta number. Any recieved deltas from the server should increase the delta number. This delta number will be sent to the server for every request to modify the queue. If the client delta number is different from the server's, the server will ignore the request and will send a `"delta update"` message, with a `"deltas"` field containing an array of delta objects. The client will be responsible for updating its own queue and delta number. The client can request to directly get the queue and the latest delta number, however it may reduce performance--so emit `"get all"` to the server as minimal as possible.

When making a request to modify the master queue, the client should emit `"propose"`, which should "propose" a new delta. Should follow the same format and rules as a normal server-side delta, but should include a `"clientDelta"` field with the client's delta. This is to compare with the server delta and ensure that the client is _likely_ up to date.

```js
{
    "clientDelta": int,
    "action": ...
    ...
}
```

_Recommendation:_ If the client continues to have bad requests (consecutive `"bad delta"`s), the client should brute-force a queue refresh with `"get all"`. This should be the only resort to use `"get all"`. A good number of consecutive erroneous requests to do this after is around 2+ times.
