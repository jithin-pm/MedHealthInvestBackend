const seq = require('./config/db');
seq.query('SELECT * FROM Enquiries ORDER BY id DESC LIMIT 5').then(r => console.log(r[0])).catch(e => console.error(e)).finally(() => process.exit(0));
