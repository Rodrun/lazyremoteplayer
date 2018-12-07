// Test queue.js
var queue = require("../queue.js");
var assert = require("assert");

/**
 * Add dummy media object to queue.
 */
function addDummy() {
    queue.performDelta(queue.createDelta(3, [], queue.createMedia("")));
}

describe("queue", function() {
    beforeEach(function() {
        // Delete all in queue prior
        queue.performDelta(queue.createDelta(6));
    });
    describe("#deleteAll", function() {
        it("should appropriately clear the queue", function () {
            addDummy();
            const prevDelta = queue.getDeltaNumber();
            const prevLen = queue.getQueueLength();
            
            queue.performDelta(queue.createDelta(6));

            assert.notStrictEqual(queue.getDeltaNumber(), prevDelta,
                "expecting a delta to be added from operation");
            assert.notStrictEqual(queue.getQueueLength(), prevLen,
                "expecting queue length to not remain the same");
        });
    });
    describe("#createDelta", function() {
        it("should create basic, valid delta objects", function () {
            let negativeCode = queue.createDelta(-2, null, null);
            let replaceCode = queue.createDelta(4, [0], {url: "hello"});
            let specialCode = queue.createDelta(5, [], null);
            assert.deepStrictEqual(negativeCode, null,
                "delta with negative code should return null");
            assert.deepStrictEqual(replaceCode, {action: 4, indexes:[0], media:{url:"hello"}});
            assert.deepStrictEqual(specialCode, null, "special code shouldn't be created!");
        });
        it("should return null when creating invalid delta object", function() {
            let invalidDelta = queue.createDelta(0, [], null);
            assert.strictEqual(invalidDelta, null, "invalid data should return null");
        })
    });
    describe("#createMedia", function() {
        it("should create a media object", function() {
            let media0 = queue.createMedia("media.com/media.mp4");
            assert.deepStrictEqual(media0, {url:"media.com/media.mp4"},
                "basic media object with url property set");
        });
        it("should return null on invalid parameters", function() {
            let arr = queue.createMedia([0, 1, 2, 3]);
            let num = queue.createMedia(1);
            let nil = queue.createMedia(null);
            assert.strictEqual(arr, null);
            assert.strictEqual(num, null);
            assert.strictEqual(nil, null);
        });
    });
    describe("#get", function() {
        it("should return null on invalid indexes", function() {
            assert.strictEqual(queue.get(-1), null);
            assert.strictEqual(queue.get(null), null);
        });
    });
    describe("#add", function() {
        it("sould safely add a media object and the end", function() {
            const prevLen = queue.getQueueLength();
            let mediaObj = queue.createMedia("hello.avi");
            
            queue.performDelta(queue.createDelta(3, [], mediaObj));
            assert.notStrictEqual(prevLen, queue.getQueueLength());
            assert.deepStrictEqual(queue.get(queue.getQueueLength() - 1),
                mediaObj,
                "expecting latest media object to be what was added");
        });
    })
    describe("#getCurrent", function() {
        it("should return front media object in queue", function() {
            //addDummy();
            addDummy();
            assert.notStrictEqual(queue.getCurrent(), null);
        });
        it("should return null on empty queue", function() {
            queue.performDelta(queue.createDelta(6));
            assert.strictEqual(queue.getCurrent(), null);
        });
    });
    describe("#delete", function() {
        it("should ignore invalid index deletions", function() {
            addDummy();

            const preveDelta = queue.getDeltaNumber();
            // Attempt invalid indexes
            queue.performDelta(queue.createDelta(1, [-1]))
                .then((d) => {}, (err) => {});
            queue.performDelta(queue.createDelta(1, [queue.getQueueLength()]))
                .then((d) => {}, (err) => {});

            assert.strictEqual(preveDelta, queue.getDeltaNumber(),
                "invalid indexes should not create new deltas");
        });
    });
    describe("#getDiff", function() {
        it("should return correct delta diffs", function() {
            const cDelta = queue.getDeltaNumber();
            assert.strictEqual(queue.getDiff(cDelta), 0,
                `expecting 0 from ${queue.getDeltaNumber()} - ${cDelta}`);
            
            // Now add a new media to update delta
            //addDummy();
            addDummy();
            assert.strictEqual(queue.getDiff(cDelta), 1,
                "expecting 1 after one addition to queue");
        });
    });
    describe("#getDeltaData", function () {
        it("should return diff amount of delta objects", function() {
            const serverDelta = queue.getDeltaNumber(); // Before adding
            //addDummy();
            addDummy();
            // After adding
            let zero = queue.getDeltaData(queue.getDeltaNumber());
            let one = queue.getDeltaData(serverDelta);
            assert.strictEqual(zero.length, 0,
                "expecting length of 0 from comparing the same delta");
            assert.strictEqual(one.length, 1,
                "expecting length of 1 after adding 1 media");
        });
    });
});
