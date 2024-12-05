const axios = require('axios');


require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const sendBulkSMS = async (phones, message) => {

    await axios.post('https://sms-uat.sss.io/api/sms/send-bulk', {
        toList: phones,
        message: message
    }, {
        headers: { Authorization: `Bearer ${process.env.PHONE_API_KEY}` }
    }
    ).then(async function (response) {
        console.log(response.data);
    })
        .catch(function (error) {
            console.log(error);
        });
    
};

module.exports = sendBulkSMS;