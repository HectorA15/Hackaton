const request = require('supertest');
const app = require('../src/server');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db/connection');

beforeAll(async () => {
  await migrate();
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
  let adminToken;

  test('POST /api/auth/login should fail with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'invalid', password: 'wrong' })
      .expect(401);
    
    expect(response.body.error).toBeDefined();
  });
});

describe('Products API', () => {
  let token;

  beforeAll(async () => {
    // Create a test user and login
    const bcrypt = require('bcryptjs');
    const User = require('../src/models/User');
    const hashedPassword = await bcrypt.hash('test123', 10);
    await User.create('testuser', hashedPassword, 'worker');
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    
    token = response.body.token;
  });

  test('GET /api/products should return products', async () => {
    const response = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/products without token should fail', async () => {
    await request(app)
      .get('/api/products')
      .expect(401);
  });
});
