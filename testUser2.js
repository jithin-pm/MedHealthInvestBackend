const sequelize = require('./config/db');
const User = require('./models/userModel');

async function testUsers() {
    const user = await User.findOne({ where: { email: 'jithinpm1234@gmail.com' } });
    console.log(user ? 'EXISTS' : 'NOT FOUND');
    process.exit(0);
}
testUsers();
