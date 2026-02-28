/**
 * Scan API: /api/scan/mrz/parse, /api/scan/doc/parse
 */

const express = require('express');
const mrzParse = require('./mrzParse');
const docParse = require('./docParse');

const router = express.Router();
router.use(mrzParse);
router.use(docParse);

module.exports = router;
