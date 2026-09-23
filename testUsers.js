const sequelize = require('./config/db');
const User = require('./models/userModel');

async function testUsers() {
    const users = await User.findAll({ attributes: ['id', 'fullName', 'email'] });
    console.log(users.slice(0, 3));
    process.exit(0);
}
testUsers();
