const fs = require('fs');
const content = fs.readFileSync('controllers/authController.js', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('user') || line.toLowerCase().includes('all') || line.toLowerCase().includes('find')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
