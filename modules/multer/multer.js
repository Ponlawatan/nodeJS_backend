const multer = require('multer');


const fileFilter = (req, file, cb) => {
    if (file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        cb(null, true)
    } else {
        cb(null, false)
    }
}

const storage = multer.memoryStorage();

const processFiles = multer ({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 3 //10 mb
    },
    fileFilter: fileFilter,
    upload: (err) => {
        if (err instanceof multer.MulterError) {
            throw new Error ('Error uploading files ' + err)
        }
    }
})

module.exports = processFiles;