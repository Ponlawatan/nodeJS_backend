const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');


const processFiles = require('../../modules/multer/multer');

const upload = multer({ processFiles });

const { fileUpload, queryObjectInBucket } = require('../../controllers/fileUploadControllers');

router.post('/', upload.single('product'), fileUpload);
router.get('/', queryObjectInBucket);

module.exports = router;