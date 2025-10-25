const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const { migrate } = require('./src/db/migrate');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
  console.log('===================================');
  console.log('Inventory Expiry Tracker Setup');
  console.log('===================================\n');

  try {
    // Run migrations
    console.log('Running database migrations...');
    await migrate();
    console.log('✓ Database migrations completed\n');

    // Check if admin user exists
    const existingAdmin = await User.findByUsername('admin');
    
    if (existingAdmin) {
      console.log('Admin user already exists.');
      const recreate = await question('Do you want to create another admin user? (y/n): ');
      if (recreate.toLowerCase() !== 'y') {
        console.log('\nSetup completed!');
        rl.close();
        process.exit(0);
      }
    }

    // Create admin user
    console.log('\nCreate Admin User');
    console.log('-----------------');
    
    const username = await question('Username: ');
    const password = await question('Password: ');
    const confirmPassword = await question('Confirm Password: ');

    if (password !== confirmPassword) {
      console.error('✗ Passwords do not match!');
      rl.close();
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('✗ Password must be at least 6 characters!');
      rl.close();
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await User.create(username, hashedPassword, 'admin');

    console.log(`\n✓ Admin user created successfully! (ID: ${userId})`);
    console.log('\nYou can now start the server with: npm start');
    console.log('Then login at: http://localhost:3000');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    rl.close();
    process.exit(1);
  }
}

setup();
