// Default media viewer, only shows media player, no queue
// It is assumed that the server will only allow one media client
import React from "react";
import {
    render as _render
} from "react-dom";
import ReactPlayer from "react-player";

class Player extends React.Component {
    /**
     * Initialize media player.
     */
    constructor(props) {
        super(props);
        this.state = {
            url: null, // URL of media
            playing: false, // Is playing?
            volume: 1, // Media volume
            socket: null // Server connection socket
        };
    }

    componentDidMount() {
        // Initialize socket
        this.setState((state, props) => {
            let socket = io({
                query: {
                    mediaClient: true
                }
            });
            console.log("socket created");
            this.createEvents(socket);
            return {socket: socket};
        });
    }

    /**
     * Set up the socket events to listen for.
     * 
     * @param {Object} socket Server connection socket.
     */
    createEvents(socket) {
        console.log("creating event listeners");
        var fthis = this;
        /* Events */
        socket.on("connect", function () {
            console.log("new connection");
        });
        socket.on("play", function () {
            console.log("play");
            fthis.setState({
                playing: true
            });
        });
        socket.on("pause", function () {
            console.log("pause");
            fthis.setState({
                playing: false
            });
        });
        socket.on("next", function () {
            console.log("next");
        });
        socket.on("set url", function (url) {
            console.log("set url to " + url);
            fthis.setState({url:""});
            fthis.setState({
                url: url,
                playing: true
            });
        });
        socket.on("volume", function(data) {
            const volume = data.volume;
            if (volume) {
                console.log("volume set: " + volume);
                fthis.setState({volume: volume});
            }
        });
        socket.on("disconnect", function () {
            console.log("disconnected!");
        });
        socket.on("error", function (err) {
            console.log("error from server: " + err);
        });
    }

    /// Prop callbacks

    onStart = () => {
        console.log("media starting");
        // Notify server
        const socket = this.state.socket;
        if (socket) {
            // TODO
        }
    };

    onEnded = () => {
        console.log("media ended");
        // Notify server
        const socket = this.state.socket;
        if (socket) {
            socket.emit("media ended");
        }
    };

    onPause = () => {
        // Update state
        this.setState({playing: false});
        // Notify server
    }

    onError = (e) => {
        console.log("onError: " + e);
        // Notify server
        const socket = this.state.socket;
        if (socket) {
            socket.emit("error", e);
        }
    }

    /**
     * Render the component.
     */
    render() {
        return <ReactPlayer
        url = {
            this.state.url
        }
        playing = {
            this.state.playing
        }
        onStart = {
            this.onStart
        }
        onEnded = {
            this.onEnded
        }
        onPause = {
            this.onPause
        }
        onError = {
            this.onError
        }
        volume = {
            this.state.volume
        }
        controls
        className = "react-player"
        width = "100%"
        height = "100%" /> ;
    }
}

/* Finalize */
_render( < Player /> , document.getElementById("player"));
