Lazy Remote Player
==================

Server to play multiple types of media (online or local) from a queue.

# Setup
=====

## Install

`npm install`

## Port setup

Uses environment variable PORT.

`PORT=12345 npm start`

If not set, defaults to `3000`.

## Run

`npm start`

## Use

Connect to the host machine (e.g. `localhost:3000`) via your favorite browser. Request `/media` to connect a media client, otherwise other connections will be considered as a control client.

## Debug messages

You can set `DEBUG=` to `comm:<media | control | master>` and/or `queue` to get debug messages.
