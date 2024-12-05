const { OSSStorage } = require('../modules/storage/oss');

const fileUpload = async (req, res) => {
    try {

        console.log('File', req.file);
        console.log('Body', req.body);

        const result = await OSSStorage.put('uploads/product.jpg', Buffer.from(req.file.buffer));

        console.log(result);

        res.status(200).send({ message: 'File Uploaded', result: result });


    } catch (err) {
        console.log(err);
    }
};


const deleteImageInBucket = async (req, res) => {
    const result = await OSSStorage.delete('product');

    res.status(200).send(result);
}

module.exports = {
    fileUpload, queryObjectInBucket: deleteImageInBucket
}

