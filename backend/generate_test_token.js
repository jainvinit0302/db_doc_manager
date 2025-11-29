const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate a token for user ID 1 (dex@gmail.com)
const token = jwt.sign(
    { userId: 1, email: 'dex@gmail.com' },
    JWT_SECRET,
    { expiresIn: '7d' }
);

console.log('Generated test token for user ID 1:');
console.log(token);
console.log('\nTest the profile endpoint with:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:4000/api/profile`);
