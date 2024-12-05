const axios = require('axios');


require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const sendSMS = async (phone, message) => {

    await axios.post('https://sms-uat.jaidee.io/api/sms/send', {
        to: phone,
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

module.exports = sendSMS;