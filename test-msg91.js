const axios = require('axios');
const authKey = '496218A1KFy8m2aml69b7a363P1';
const templateId = '6a28008481272f42db081432';
const fullMobile = '917560844748';
const generatedOtp = 123456;
const senderId = 'MEDHEE';
let url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${fullMobile}&authkey=${authKey}&otp=${generatedOtp}&number=${generatedOtp}&sender=${senderId}`;

axios.get(url)
  .then(res => console.log('SUCCESS:', res.data))
  .catch(err => console.error('ERROR:', err.response ? err.response.data : err.message));
