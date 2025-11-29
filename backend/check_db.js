const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db/dbdoc.db');

try {
    const db = new Database(DB_PATH, { readonly: true });

    console.log('=== Database Connection Successful ===\n');

    // Check users table
    console.log('--- Users Table ---');
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`Total users: ${userCount.count}`);

    if (userCount.count > 0) {
        const users = db.prepare('SELECT id, email, name, created_at FROM users LIMIT 5').all();
        console.log('\nRecent users:');
        users.forEach(user => {
            console.log(`  ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
        });
    }

    // Check usage_stats table
    console.log('\n--- Usage Stats Table ---');
    const statsCount = db.prepare('SELECT COUNT(*) as count FROM usage_stats').get();
    console.log(`Total stats records: ${statsCount.count}`);

    if (statsCount.count > 0) {
        const stats = db.prepare('SELECT * FROM usage_stats LIMIT 5').all();
        console.log('\nRecent stats:');
        stats.forEach(stat => {
            console.log(`  User ID: ${stat.user_id}, Logins: ${stat.login_count}, Validations: ${stat.validation_count}, Generations: ${stat.generation_count}`);
        });
    }

    // Check schema
    console.log('\n--- Users Table Schema ---');
    const userSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    console.log(userSchema.sql);

    console.log('\n--- Usage Stats Table Schema ---');
    const statsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='usage_stats'").get();
    console.log(statsSchema.sql);

    db.close();
    console.log('\n=== Database Check Complete ===');
} catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
}
