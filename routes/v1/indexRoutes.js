const express = require('express');
const router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { pageTitle: 'HiddenGem Lab Backend (Test2)',featuredContent:'adfdfsdfsd'});
});

module.exports = router;
