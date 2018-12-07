var express = require('express');
var router = express.Router();

// Control client
router.get("/", function(req, res, next) {
  res.render('index', { });
});

module.exports = router;
