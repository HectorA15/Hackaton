const request = require('supertest');
const app = require('../src/server');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db/connection');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

let testToken;

beforeAll(async () => {
  await migrate();
  
  // Create a test user
  const hashedPassword = await bcrypt.hash('test123', 10);
  try {
    await User.create('testuser', hashedPassword, 'worker');
  } catch (err) {
    // User might already exist
  }
  
  // Login to get token
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'test123' });
  
  if (response.body.token) {
    testToken = response.body.token;
  }
});

afterAll(async () => {
  db.close();
});

describe('API Health Check', () => {
  test('GET /api/health should return status ok', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('Authentication', () => {
  test('POST /api/auth/login should fail with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'invalid', password: 'wrong' })
      .expect(401);
    
    expect(response.body.error).toBeDefined();
  });

  test('POST /api/auth/login should succeed with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' })
      .expect(200);
    
    expect(response.body.token).toBeDefined();
    expect(response.body.user).toBeDefined();
    expect(response.body.user.username).toBe('testuser');
  });
});

describe('Products API', () => {
  test('GET /api/products should return products', async () => {
    const response = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/products without token should fail', async () => {
    await request(app)
      .get('/api/products')
      .expect(401);
  });
});

describe('Batches API', () => {
  test('GET /api/batches should return batches', async () => {
    const response = await request(app)
      .get('/api/batches')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('Inventory API', () => {
  test('GET /api/inventory should return inventory items', async () => {
    const response = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });
});
