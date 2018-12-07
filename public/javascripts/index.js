// Default control client
import React from "react";
import ReactDOM from "react-dom";

/* Style */
const STYLE = {
    "button": "w3-button",
    "bar": "w3-bar",
    "div": "w3-container"
};

// Control client socket
var socket = null; // Will not connect until QueueRoot loaded
var deltaNumber = 0;

/**
 * Emit an event to the server.
 * 
 * @param {String} event Event name.
 * @param {Any} data Data to send.
 */
function emit(event, data) {
    if (socket) {
        socket.emit(event, data);
    } else {
        console.log("could not emit due to invalid socket");
    }
}

/**
 * Add a listener for an event on the socket.
 * 
 * @param {String} event Name of event.
 * @param {Functio} fn Callback.
 */
function addListener(event, fn) {
    if (socket) {
        socket.on(event, fn);
    }
}

/**
 * Text field component. This renders an <input>.
 */
class TextField extends React.Component {
    constructor(props) {
        super(props);
        this.state = {value: ""};
    }

    /**
     * Update value on input field change.
     */
    onChange = (event) => {
        if (this.props.valueListener) {
            this.setState({value: event.target.value}, () => {
                this.props.valueListener(this.state.value);
            });
        }
    }

    /**
     * Clear the text field.
     */
    clear() {
        this.setState({value: ""});
        //this.onChange({target: {value: ""}});
    }

    render() {
        return <input
            value={this.state.value}
            onChange={this.onChange} />;
    }
}

/**
 * Text Submitter component. This is a TextField paired with a button.
 * 
 * Uses the following props:
 * - onSubmit = Callback function on submit, with the text as the parameter.
 * - buttonName = Name of submit button.
 */
class TextSubmitter extends React.Component {
    constructor(props) {
        super(props);
        this.state = { value: "" };
        this.fieldRef = React.createRef(); // Ref to the TextField
    }

    getButtonName() {
        const pName = this.props.buttonName;
        if (!pName) {
            return "Submit";
        }
        return pName;
    }

    /**
     * Submit button onClick callback. This calls the given
     * onSubmit callback with the textfield's text as the parameter.
     */
    onClick = () => {
        try {
            // Notify submit callback
            this.props.onSubmit(this.state.value);
            // Clear field
            this.fieldRef.current.clear();
        } catch (err) {
            console.warn(err);
        }
    }

    /**
     * Value listener callback for the TextField.
     */
    valueListener = (newText) => {
        this.setState({value: newText});
    }

    render() {
        return <div className={STYLE["bar"]}>
            <TextField
                ref={this.fieldRef}
                valueListener={this.valueListener} />
            <button
                className={STYLE["button"]}
                onClick={this.onClick}>
                {this.getButtonName()}
            </button>
            </div>;
    }
}

/**
 * Control root component. Here goes all the input components
 * of the controller.
 */
class ControlRoot extends React.Component {
    constructor(props) {
        super(props);
    }

    onPauseClick = () => {
        console.log("Pause clicked");
        emit("pause");
    }

    onPlayClick = () => {
        console.log("Play clicked");
        emit("play");
    }

    onNextClick = () => {
        console.log("Next clicked");
        emit("next");
    }

    onAddClick = () => {
        console.log("Add clicked");
    }

    /**
     * Callback for onSubmit on the TextSubmitter component, which
     * will recieve user input to add a new media object to queue.
     */
    onSubmit = (value) => {
        console.log("Submitted: " + value);
        emit("propose", {
            action: 3,
            media: {url: value}
        });
    }

    render() {
        return <div className={STYLE["bar"]} id="controlRoot">
            <button className={STYLE["button"]} onClick={this.onPauseClick}>{this.props.pauseText}</button>
            <button className={STYLE["button"]} onClick={this.onPlayClick}>{this.props.playText}</button>
            <button className={STYLE["button"]} onClick={this.onNextClick}>{this.props.nextText}</button>
            <TextSubmitter onSubmit={this.onSubmit} />
            </div>;
    }
}

/* Set up queue root */

class MediaObject extends React.Component { // TODO: Finish
    constructor(props) {
        super(props);
    }

    render() {
        return <li className="media-object">{this.props.url}</li>;
    }
}


class QueueRoot extends React.Component {
    constructor(props) {
        super(props); // TODO: set socket object in props
        this.state = {
            queue: [], // Queue of media objects
            deltaNumber: 0 // Client delta number
        };
    }

    performDelta(delta) {
        // TODO: Use more "scalable (?)" solution
        // This is temporary
        console.log("got good delta response: " + JSON.stringify(delta));
        switch (delta.action) {
            case 1:
                this.deleteAt(delta.indexes[0]);
                break;
            case 3:
                this.add(delta.media);
                break;
            case 6:
                this.deleteall();
                break;
            default:
                console.warn("did not recognize given delta?");
                this.incrementDelta(); // Do it anyway, for now
                break;
        }
    }

    componentDidMount() { // Add socket listeners
        socket = io(); // Server connection (temporary)
        
        let that = this;
        addListener("greet", function(data) {
            that.setState((state, props) => {
                // Map all media to MediaObjects
                const fixedMap = data.queue.map((mediaObj) => {
                    return <MediaObject url={mediaObj.url} />;
                });
                // Return as new state
                return {
                    queue: fixedMap,
                    deltaNumber: data.delta // Align with server delta
                };
            });
        });

        addListener("good delta", d => this.performDelta(d));
        addListener("delta update", d => this.performDelta(d));

        addListener("bad delta", function(deltas) {
            // TODO
            console.log("got bad delta response");
        });
    }

    /**
     * Add media to the queue.
     * 
     * @param {Object} media Media object to add. Not MediaObject!
     */
    add(media) {
        // Possibly hold off pushing as MediaObject until later?????
        // Doing something like that may fix the react warning about keys
        this.state.queue.push(<MediaObject url={media.url} />);
        this.incrementDelta();
    }

    // TODO: Support all DELTA commands

    deleteAt(index) {
        this.state.queue.splice(index, 1);
        this.incrementDelta();
    }

    /**
     * Delete all in queue.
     */
    deleteAll() {
        this.state.queue.length = 0;
        this.incrementDelta();
    }

    /**
     * Increase the delta number by 1.
     */
    incrementDelta() {
        this.setState((state, props) => ({
            deltaNumber: state.deltaNumber + 1
        }));
    }

    render() {
        return <div>
            <ul>
                {this.state.queue}
            </ul>
            </div>;
    }
}

// Finally, render roots
ReactDOM.render(<ControlRoot
    pauseText={"Pause"}
    playText={"Play"}
    nextText={"Next"}
    />, document.getElementById("controlRoot"));
ReactDOM.render(<QueueRoot />,
    document.getElementById("queueRoot"));
