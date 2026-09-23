const axios = require('axios');

const authKey = '496218A1KFy8m2aml69b7a363P1';
const templateId = '6a28008481272f42db081432';
const fullMobile = '917560844748';
const generatedOtp = '777777';
const senderId = 'MEDHEE';

const options = {
  method: 'POST',
  url: 'https://control.msg91.com/api/v5/flow/',
  headers: {
    'authkey': authKey,
    'content-type': 'application/json'
  },
  data: {
    template_id: templateId,
    sender: senderId,
    short_url: "0",
    recipients: [
      {
        mobiles: fullMobile,
        number: generatedOtp
      }
    ]
  }
};

axios(options)
  .then(res => console.log('FLOW SUCCESS:', res.data))
  .catch(err => console.error('FLOW ERROR:', err.response ? err.response.data : err.message));
