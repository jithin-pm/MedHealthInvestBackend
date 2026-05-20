require('dotenv').config();
const db = require('./config/db');
db.query('DESCRIBE projects').then(([results]) => {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
