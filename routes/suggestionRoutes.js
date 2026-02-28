const express = require('express');
const router = express.Router();
const { getSuggestions } = require('../controllers/suggestionControllers');

// It's a public route for authenticated shops
router.get('/:type', getSuggestions);

module.exports = router;
