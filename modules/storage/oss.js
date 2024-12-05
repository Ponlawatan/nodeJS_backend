const OSS = require('ali-oss');

const OSSStorage = new OSS({
    //region: 'oss-ap-southeast-1',
    endpoint: 'oss-ap-southeast-7.aliyuncs.com',
    accessKeyId: 'LTAI5tJCsQhGvpUzow',
    accessKeySecret: '4CcH3dWiCtsrnnV',
    bucket: 'heasp',
});

module.exports = { OSSStorage };