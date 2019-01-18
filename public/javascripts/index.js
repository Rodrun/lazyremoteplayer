// Default control client
import React from "react";
import ReactDOM from "react-dom";

/* Style/classes constants */
const STYLE = Object.freeze({
    "button": "w3-button",
    "button-circle": "w3-circle",
    "mobile": "w3-mobile", // Responsive
    "bar": "w3-bar",
    "div": "w3-container",
    "panel": "w3-panel w3-display-container",
    "display-": "w3-display-" // Prefix for display classes
});

/**
 * Combine multiple styles as one string.
 *
 * @param  {...any} styles Class names to join.
 */
function joinStyles(...styles) {
    return styles.join(" ");
}

// Control client socket
var socket = io(); // Will not connect until QueueRoot loaded
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

const Button = props =>
    <button
        className={props.type || STYLE["button"]}
        onClick={props.onClick}>
            {props.text}
    </button>;

/**
 * Text field component. This renders an <input>.
 */
class TextField extends React.Component {
    /**
     * @constructor
     * Significant prop:
     * valueListener = Function that recieves updated value of text.
     */
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
            <Button
                onClick={this.onClick}
                text={this.getButtonName()} />
            </div>;
    }
}

/**
 * Volume controller component. Allows client to increase/decrease
 * media player volume.
 */
class VolumeController extends React.Component {
    constructor(props) {
        super(props);
    }

    /**
     * Get the increment/decrement step. This is to be
     * sent with "volume edit" events.
     */
    getStep() {
        if (this.props.step) {
            return Math.abs(this.props.step);
        }
        return 0.1; // Default
    }

    decreaseClick = () => {
        emit("volume edit", -0.1);
    }

    increaseClick = () => {
        emit("volume edit", 0.1)
    }

    render() {
        return <div className={STYLE["bar"]}>
            <Button
                type={STYLE["button-circle"]}
                onClick={this.decreaseClick}
                text={"-"} />
            <Button
                type={STYLE["button-circle"]}
                onClick={this.increaseClick}
                text={"+"} />
            </div>;
    }
}

/**
 * Display and handle playback options, including play, pause, and next.
 */
class PlaybackController extends React.Component {
    /**
     * @constructor
     * Significant props (all have defaults):
     * onPauseClick - Callback on pause clicked.
     * onPlayClick - Callback on play clicked.
     * onNextClick - Callback okn next clicked.
     * pauseText - Pause button text.
     * playText - Play button text.
     * nextText - Next button text.
     */
    constructor(props) {
        super(props);
        const DEFAULT_CALLBACK = () => console.warn("No callback on click.");
        this.onPauseClick = props.onPauseClick || DEFAULT_CALLBACK;
        this.onPlayClick = props.onPlayClick || DEFAULT_CALLBACK;
        this.onNextClick = props.onNextClick || DEFAULT_CALLBACK;
        this.pauseText = props.pauseText || "Pause";
        this.playText = props.playText || "Play";
        this.nextText = props.nextText || "Next";
    }

    render() {
        return <div className={"bar"}>
            <Button onClick={this.onPauseClick} text={this.pauseText} />
            <Button onClick={this.onPlayClick} text={this.playText} />
            <Button onClick={this.onNextClick} text={this.nextText} />
        </div>;
    }
}

/**
 * Control root component. Here goes all the input components
 * of the controller. All requested inputs will emit to the
 * server, and actual changes to the queue will occur once
 * the server responds.
 */
class ControlRoot extends React.Component {
    constructor(props) {
        super(props);
    }

    onPauseClick = () => {
        emit("pause");
    }

    onPlayClick = () => {
        emit("play");
    }

    onNextClick = () => {
        emit("next");
    }

    /**
     * Callback for onSubmit on the TextSubmitter component, which
     * will recieve user input to add a new media object to queue.
     */
    onSubmit = (value) => {
        emit("propose", {
            action: 3,
            media: {url: value}
        });
    }

    render() {
        return <div className={STYLE["bar"]} id="controlRoot">
            <PlaybackController
                onPauseClick={this.onPauseClick}
                onPlayClick={this.onPlayClick}
                onNextClick={this.onNextClick}
                /> 
            <VolumeController />
            <TextSubmitter onSubmit={this.onSubmit} />
            </div>;
    }
}

/* Set up queue root */

/**
 * Displays a media object and its options.
 */
class MediaObjectComponent extends React.Component {
    constructor(props) {
        super(props);
        this.onRemoveRequested = () => { console.log("remove requested."); }
    }

    render() {
        const removeCNames = joinStyles(STYLE["display-"] + "right",
            STYLE["button-circle"]);
        return <li className={STYLE["panel"]}>
                <span className={STYLE["display-"] + "middle"}>{this.props.url}</span>
                <Button type={removeCNames}
                    text={"\&times"}
                    onClick={this.onRemoveRequested} />
            </li>;
    }
}

/**
 * Root component of the queue viewer. All media objects
 * will be displayed here.
 */
class QueueRoot extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            queue: [], // Queue of media objects
            deltaNumber: 0 // Client delta number
        };
        this.recieveGreet = this.recieveGreet.bind(this);
        this.performDelta = this.performDelta.bind(this);
    }

    /**
     * Perform a given delta on the local queue. This does not
     * perform any socket communications.
     * 
     * @param delta Delta number.
     * @see DELTA.md
     */
    performDelta(delta) {
        console.log("got good delta response: " + JSON.stringify(delta));
        switch (delta.action) {
            case 1:
                this.deleteAt(delta.indexes[0]);
                break;
            case 3:
                this.add(delta.media);
                break;
            case 6:
                this.deleteAll();
                break;
            default:
                console.warn("did not recognize given delta?");
                this.incrementDelta(); // Do it anyway, for now
                break;
        }
    }

    componentDidMount() { // Add socket listeners
        addListener("greet", this.recieveGreet);

        addListener("good delta", this.performDelta);
        addListener("delta update", this.performDelta);

        addListener("bad delta", function(deltas) {
            // TODO
            console.warn("got bad delta response");
        });

        // Now greet the server
        emit("get all");
    }

    /**
     * Handle greeting from server.
     * @param data Greet data.
     */
    recieveGreet(data) {
        this.setMediaObjects(data.queue);
        this.setState({ deltaNumber: data.delta });
    }

    /**
     * Add media to the queue.
     * 
     * @param media Media object to add. Not MediaObject!
     */
    add(media) {
        this.state.queue.push(media);
        this.incrementDelta();
    }

    // TODO: Support all DELTA commands

    /**
     * Delete media at index.
     * @param index Index of media object to delete.
     */
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
        this.setState((state) => ({
            deltaNumber: state.deltaNumber + 1
        })); 
    }

    /**
     * Set the list of media objects in queue.
     */
    setMediaObjects(list) {
        if (list && Array.isArray(list)) {
            this.setState(() => ({ queue: list }));
        }
    }

    render() {
        return <ul>
                {
                    this.state.queue.map(media => (
                        <MediaObjectComponent url={media.url} />
                    ))
                }
            </ul>;
    }
}

// Finally, render roots
ReactDOM.render(<ControlRoot />, document.getElementById("controlRoot"));
ReactDOM.render(<QueueRoot />,
    document.getElementById("queueRoot"));
