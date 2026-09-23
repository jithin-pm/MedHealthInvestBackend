const axios = require('axios');
const authKey = '496218A1KFy8m2aml69b7a363P1';
const fullMobile = '917560844748';
const generatedOtp = 123456;

const verifyUrl = `https://control.msg91.com/api/v5/otp/verify?otp=${generatedOtp}&mobile=${fullMobile}&authkey=${authKey}`;

axios.get(verifyUrl)
  .then(res => console.log('VERIFY SUCCESS:', res.data))
  .catch(err => console.error('VERIFY ERROR:', err.response ? err.response.data : err.message));
