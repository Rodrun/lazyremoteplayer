/*
 * Master media queue handler.
 * 
 * Each element in the queue is an object with the following properties:
 * - url (string): URL/file location of media.
 */

const uuidv1 = require("uuid/v1"); // TODO
var t = require("typy");

/**
 * The maximum amount of stored deltas permissible at once. This
 * is the maximum length of the deltas array. If the deltas length
 * reaches this value, new deltas can still be added--however, the
 * "oldest" deltas will be removed to provide space for new deltas.
 * 
 * @see deltas
 */
const DELTA_BUFFER_MAX = process.env.DELTA_BUFFER_MAX || 50;

/**
 * Maximum amount of media allowed in the queue. This is the maximum length
 * of the queue array. Set to -1 if no limit is desired. Note that this is
 * not a constant, as queue size should be configurable during runtime.
 * 
 * @see queue
 */
var queue_max = process.env.QUEUE_DEFAULT_MAX || -1;

/**
 * The server/"master" queue of media objects. All client-side queues should
 * match this queue, which is done with a "delta"/versioning system.
 * 
 * Each element of the queue is referred to as a "media object," which
 * contains information of the media to be played. Each media object
 * has the following properties:
 * - url (string): URL or path of the media.
 * - title (sring): Title of the media. This property is not necessary.
 * - thumbnail (string): URL or path of the thumbnail. This property
 *      is not necessary.
 * 
 * The front of the queue (index 0) is the active media object (currently
 * "playing").
 * 
 * @see deltas
 */
var queue = [];

/**
 * Delta, or version history.
 * The higher the index, the more recent the recorded changes are. These
 * indexes are called "delta numbers," or versions. The server should deny
 * any requests from client's who do not have the same delta number as the
 * server (forcing a synchronization). If any complications arise, the client
 * may request the full master queue from the server; however, this should
 * be last resort (unless client's delta is < server delta - DELTA_BUFFER_MAX).
 * 
 * Each recorded change (delta) is an object with the following properties:
 * - action (int): Action code representing the type of change. (Required)
 *      -> <0= Do nothing (erroneous delta).
 *      -> 0 = Swap indexes (index a, index b).
 *          - Requires indexes property: length >= 2.
 *      -> 1 = Delete index (index i).
 *          - Requires indexes property: length > 0.
 *      -> 2 = Move index (index a, index b).
 *          - Requires indexes property: length >= 2.
 *      -> 3 = Add object (media object) to end of queue.
 *          - Requires media property: not null.
 *      -> 4 = Replace object at index (index i, media object).
 *          - Requires indexes property: length >= 1.
 *          - Requires media property: not null.
 *      -> 5 = All of queue (SPECIAL CASE ONLY).
 *          - Not to be added in the deltas list!
 *          - Only used with getDeltaData().
 *          - Requires master property: copy of master queue.
 *      -> 6 = Delete all in queue.
 * - indexes (array of int): Array of indexes that have been affected by the
 *      actions. (Optional)
 * - media (media object): Media object for the add or replace actions. This
 *      should only be populated if action is add or replace, otherwise it is
 *      ignored. (Optional)
 * 
 * Example:
 *
 *  { action: 0, indexes: [1, 3] }
 *  -> Switch indexes 1 and 3
 *  { action: 1, indexes: [0] }
 *  -> Delete index 0
 *  { action: 2, indexes: [8, 0] }
 *  -> Move index 8 to index 0 (move to front of queue)
 * 
 * The client should only send a queue delta request when modifying its own
 * version of the queue. Once the server processes it, it should recieve the
 * proper deltas to execute on its own queue. This could reduce possible
 * erroneous client-side queues that may have the same delta as the server, but
 * its elements completely different and arranged differently. If the client's
 * queue for some reason makes an erroneous request, and the deltas are
 * the same, the server should send the entire queue along with the latest
 * delta number, and the client should replace its queue with it.
 * 
 * @see DELTA_BUFFER_MAX
 */
var deltas = [];

/**
 * Delta listeners. Called after every successful delta performance.
 */
var deltaListeners = [];

/**
 * Function names of each action code.
 * @see module.exports
 */
const ACTION_NAMES = Object.freeze({
    "0": swap,
    "1": deleteAt,
    "2": move,
    "3": add,
    "4": replace,
    "6": deleteAll
});

/**
 * Check if object d has name, and that it is an array of at least length len.
 * 
 * @param {Object} d Object to target.
 * @param {String} name Name of property to check for.
 * @param {int} len Minimum length of the array.
 * @returns If d.name.length >= len.
 */
function hasArrayWith(d, name, len) {
    if (name in d) {
        if (t(d[name]).isArray) {
            return d[name].length >= len;
        }
    }
    return false;
}

/**
 * Validation information for each delta action code. Each key
 * is the action code, with its value being a function that
 * takes the delta object as a parameter. Returns true if
 * delta complies with its requirements.
 */
const ACTION_PROPS = Object.freeze({
    "0": function (d) {
        return hasArrayWith(d, "indexes", 2);
    },
    "1": function (d) {
        return hasArrayWith(d, "indexes", 1);
    },
    "2": function (d) {
        return hasArrayWith(d, "indexes", 2);
    },
    "3": function (d) {
        return "media" in d;
    },
    "4": function (d) {
        if ("media" in d) {
            if (d.media != null) {
                return hasArrayWith(d, "indexes", 1);
            }
        }
        return false;
    },
    "5": function (d) {
        return false; // Shouldn't be in deltas!
    },
    "6": function (d) {
        return true;
    }
});

/**
 * The delta number. Use to compare with client's delta number, which
 * will determine if the client is synchronized with the master queue.
 * 
 * @see deltas
 */
var delta = 0;

/**
 * Create a new delta. See action codes for further information
 * on required properties.
 * @param {int} action Action code.
 * @param {Array} indexes Array of integer indexes.
 * @param {object} media Media object for add and replace actions. 
 * @returns Delta object if valid, otherwise `null`.
 * 
 * @see deltas
 */
function createDelta(action, indexes, media) {
    let d = {
        action: action,
        indexes: indexes,
        media: media
    };
    if (isValidDelta(d)) {
        return d;
    }
    return null;
}

/**
 * Validate a delta. Note that an erroneous action number can be
 * part of a valid delta.
 * 
 * @param {object} d Delta to validate.
 * @returns If delta object `d` is valid.
 */
function isValidDelta(d) {
    if (t(d).isObject) {
        if ("action" in d) {
            // Ensure action has proper properties to use
            if (parseInt(d.action) >= 0) {
                // Call appropriate code validator function
                try {
                    return ACTION_PROPS["" + d.action](d);
                } catch (TypeError) {
                    console.debug("Invalid delta action: " + d.action);
                }
            }
        }
    }
    return false;
}

/**
 * Create a new media object for the queue. Will only be considered valid
 * if the url is a string.
 * 
 * @param {String} url URL of the media source.
 * @returns Media object.
 * 
 * @see queue
 */
function createMedia(url) {
    if (t(url).isString)
        return {
            url: url
        };
    return null;
}

/**
 * Check if media is valid.
 * 
 * @param {Object} media Media object to validate.
 * @returns If media is valid.
 */
function isValidMedia(media) {
    if (t(media).isObject && media !== null) {
        if ("url" in media) {
            return t(media.url).isString;
        }
    }
    return false;
}

/**
 * Check if index is within range of the queue and actually a number.
 * 
 * @param {int} i Index to validate.
 * @returns If i is valid.
 */
function isValidIndex(i) {
    if (t(i).isNumber) {
        return i >= 0 && i < queue.length;
    }
    return false;
}

/**
 * Swap indexes a and b in arr.
 * 
 * @param {Array} arr Target array.
 * @param {int} a Index a.
 * @param {int} b Index b.
 */
function arraySwap(arr, a, b) {
    let temp = copy(arr[a]);
    arr[a] = copy(arr[b]);
    arr[b] = temp;
}


/**
 * Add a media object to the queue.
 * 
 * @param {Object} d Delta.
 * @returns Added media object, or null if was invalid.
 */
function add(d) { // 3
    let media = d.media;
    if (t(media).isObject && "url" in media) { // Validate media object
        // ONLY add if queue is not full
        if (queue.length >= queue_max) {
            queue.push(media);
            addDelta(createDelta(3, null, media));
            return media;
        }
    }
    return null;
}
/**
 * Delete from queue.
 * 
 * @param {Object} d Delta.
 * @returns Index removed, or -1 if invalid index given.
 */
function deleteAt(d) { // 1
    let index = d.indexes[0];
    if (isValidIndex(index)) {
        queue.splice(index, 1);
        addDelta(createDelta(1, [index], null));
        return index;
    }
    return -1;
}
/**
 * Swap media objects at indexes a and b.
 * 
 * @param {Object} d Delta.
 * @returns If indexes were successfully swapped.
 */
function swap(d) { // 0
    let a = d.indexes[0];
    let b = d.indexes[1];
    if (a != b && isValidIndex(a) && isValidIndex(b) &&
        isValidIndex(d)) {
        // Swap index a with b
        arraySwap(queue, a, b);
        addDelta(createDelta(0, [a, b], null));
        return true;
    }
    return false;
}
/**
 * Move media object in the queue to given index.
 * A.K.A. Move media @ index a to index b.
 * 
 * This is done by making a copy of object of queue @ a,
 * deleting it from the queue, and inserting to position b.
 * 
 * @param {Object} d Delta.
 * @returns If move was successful.
 */
function move(d) { // 2
    let a = d.indexes[0];
    let b = d.indexes[1];
    if (a != b && isValidIndex(a) && isValidIndex(b) &&
        isValidDelta(d)) {
        let aCopy = copy(queue[a]); // Make copy of media a
        queue.splice(a, 1); // Remove original a from queue
        queue.splice(b, 0, aCopy); // Insert to pos b
        addDelta(createDelta(2, [a, b], null));
        return true;
    }
    return false;
}
/**
 * Replace index i with given media object.
 * 
 * @param {Object} d Delta.
 * @returns If replace was successful
 */
function replace(d) { // 4
    let i = d.indexes[0];
    let media = d.media;
    if (isValidIndex(i) && isValidMedia(media) &&
        isValidDelta(d)) {
        this.queue[i] = media;
        addDelta(createDelta(4, d.indexes, d.media));
        return true;
    }
    return false;
}
/**
 * Delete all elements from queue.
 * 
 * @param {Object} d Delta (unused).
 */
function deleteAll(d) { // 6
    if (isValidDelta(d)) {
        queue.length = 0;
        addDelta(createDelta(6));
    }
}
/**
 * Add a delta to the version history. This does not perform the action!
 * This should be used internally.
 * 
 * @param {object} newDelta Delta to add. This delta will ONLY be added
 *      if it is valid.
 * @returns If delta was successfully added.
 * 
 * @see `deltaIsValid()`
 */
function addDelta(newDelta) {
    // Only add if delta is valid
    if (isValidDelta(newDelta)) {
        deltas.push(newDelta); // Add to version history
        delta++; // Update delta number
        // Delete obsolete deltas, if any
        if (delta > DELTA_BUFFER_MAX) {
            const lenDiff = delta - DELTA_BUFFER_MAX;
            delta.splice(0, lenDiff);
        }
        return true;
    }
    return false;
}


module.exports = {
    queue: queue,
    deltas: deltas, // Delta list
    delta: delta, // Delta number
    queue_max: queue_max,
    createDelta: createDelta,
    createMedia: createMedia,
    /**
     * Perform the given delta, if valid. Will add delta to the array if
     * the requested action was successful.
     * 
     * @param {Object} d Delta to perform.
     * @returns Promise object. After success, the resolving call provides
     *      the successfully used delta. Otherwise, a rejected promise returns
     *      an error with a message.
     */
    performDelta: function (d) {
        return new Promise((resolve, reject) => {
            if (isValidDelta(d)) {
                const prevDelta = this.getDeltaNumber();
                ACTION_NAMES["" + d.action](d); // Perform delta action
                const success = prevDelta != this.getDeltaNumber();
                if (success) {
                    resolve(d);
                } else {
                    reject(Error("could not perform delta."));
                }
            } else {
                reject(Error("delta is invalid."));
            }
        });
    },
    /**
     * Get the next in the queue (will delete the front of the queue). If the queue
     * has one element, will invoke only ocb. If none, will do nothing.
     * 
     * @param {Function} cb Callback on success. Same function used in
     *      performDelta().then(...).
     * @param {FunctioN} ocb Callback when queue length is 1. Given parameter is the
     *      current media object.
     * @see performDelta
     */
    proceedToNext: function(cb, ocb) {
        if (this.getQueueLength() > 1) {
            // There is another element next
            this.performDelta(createDelta(1, [0])).then(cb); // Pop front
        } else if (this.getQueueLength() == 1) {
            ocb(this.getCurrent());
        }
    },
    /**
     * Get the media at given index in the queue.
     */
    get: function (index) {
        if (index < 0 || index > queue.length - 1 || queue.length <= 0) {
            return null;
        }
        return queue[index];
    },
    /**
     * Get the length of the master queue.
     * 
     * @returns Length of queue.
     */
    getQueueLength: function () {
        return queue.length;
    },
    /**
     * Get the delta number.
     * 
     * @returns Delta number.
     */
    getDeltaNumber: function () {
        return delta;
    },
    /**
     * Get the front of the queue (index 0).
     * 
     * @returns {Object} Front media object, null if queue is empty.
     */
    getCurrent: function () {
        if (queue.length > 0) {
            return queue[0];
        }
        return null;
    },
    /**
     * Get the delta at delta number.
     * 
     * @param {int} number Delta number.
     * @returns Delta object.
     */
    getDeltaAt: function (number) {
        return deltas[number];
    },
    /**
     * Get the difference between given client delta and current delta.
     *
     * @returns clientDelta Client's delta number.
     */
    getDiff: function (clientDelta) {
        return delta - clientDelta;
    },
    /**
     * Get "delta data," or change history since last client's sync.
     * The delta data should be sent to the client to allow the
     * client to perform actions to its own queue, in order to
     * synchronize with the server queue.
     * 
     * If clientDelta < delta - DELTA_BUFFER_MAX, will return
     * delta with action code `5`. This is because very outdated
     * clients should simply replace their media queues at once,
     * rather than follow the deltas. The same action wil be taken
     * if clientDelta > delta.
     * 
     * @param {int} clientDelta Client's current delta number.
     * @returns Array of deltas for the client to recieve.
     * 
     * @see deltas
     */
    getDeltaData: function (clientDelta) {
        if (clientDelta > delta || // Greater delta?
            (delta > DELTA_BUFFER_MAX // Delta too old?
                &&
                clientData < delta - DELTA_BUFFER_MAX)) {
            // Send all of queue
            return [{
                action: 5,
                master: copy(this.queue)
            }];
        } else {
            let diff = this.getDiff(clientDelta);
            let clientDeltas = [];
            for (let i = 0; i < diff; i++) {
                clientDeltas.push(this.getDeltaAt(delta - diff + i));
            }
            return clientDeltas;
        }
    }
}
