var express = require("express");
var router = express.Router();

// Media client
router.get("/", function(req, res, next) {
    res.render("media", {});
});

module.exports = router;