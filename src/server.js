/**
 * server.js
 * Versión con dashboard y API de productos:
 * - Usa bcryptjs.
 * - Redirecciones con mensajes en login/register.
 * - Sirve public/dashboard.html en /dashboard.
 * - API /api/session y /api/products (GET/POST/GET:id/DELETE).
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_DIR = path.join(__dirname, 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'cambiame_en_produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Static
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Helpers de almacenamiento
ensureUsersFile();
ensureProductsFile();

function ensureUsersFile() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const saltRounds = 10;
    const adminHash = bcrypt.hashSync('admin', saltRounds);
    const managerHash = bcrypt.hashSync('manager', saltRounds);
    const workerHash = bcrypt.hashSync('worker', saltRounds);
    const defaultUsers = [
      { username: 'admin', password: adminHash, role: 'admin' },
      { username: 'manager', password: managerHash, role: 'manager' },
      { username: 'worker', password: workerHash, role: 'worker' }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
  }
}
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function ensureProductsFile(){
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const sample = [
      { id: 'p1', name: 'Leche 1L', sku: 'LEC001', lot: 'L001', expiry: new Date(Date.now()+10*24*3600*1000).toISOString().slice(0,10), qty: 12 },
      { id: 'p2', name: 'Yogurt', sku: 'YOG123', lot: 'A12', expiry: new Date(Date.now()+3*24*3600*1000).toISOString().slice(0,10), qty: 6 }
    ];
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(sample, null, 2), 'utf8');
  }
}
function readProducts(){
  try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE,'utf8')); } catch { return []; }
}
function writeProducts(list){ fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(list, null, 2), 'utf8'); }

// ---- Rutas públicas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});

app.post('/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.redirect('/register?error=1');
  if (username.toLowerCase() === 'admin') return res.redirect('/register?error=1');
  if (!['manager','worker'].includes(role)) return res.redirect('/register?error=1');
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.redirect('/register?error=1');
  const hashed = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashed, role });
  writeUsers(users);
  return res.redirect('/login?registered=1');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.redirect('/login?error=1');
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.redirect('/login?error=1');
  req.session.user = { username: user.username, role: user.role };
  return res.redirect('/dashboard');
});

// API JSON para login con fetch
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ success:false, message:'Usuario o contraseña incorrectos.' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ success:false, message:'Usuario o contraseña incorrectos.' });
  req.session.user = { username: user.username, role: user.role };
  return res.json({ success:true, redirect:'/dashboard' });
});

// ---- Dashboard protegido
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin: ver usuarios (demo)
app.get('/admin/users', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Acceso denegado.');
  const users = readUsers().map(u => ({ username: u.username, role: u.role }));
  res.send(`<h2>Usuarios registrados</h2><pre>${JSON.stringify(users, null, 2)}</pre><p><a href="/dashboard">Volver</a></p>`);
});

// ---- API de sesión y productos
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  return res.status(401).json({ error: 'no session' });
});

app.get('/api/products', (req, res) => {
  const list = readProducts();
  const { sku } = req.query;
  if (sku) return res.json(list.filter(p => p.sku === sku));
  res.json(list);
});

app.get('/api/products/:id', (req, res) => {
  const p = readProducts().find(x => x.id === req.params.id);
  if (!p) return res.status(404).send('Not found');
  res.json(p);
});

app.post('/api/products', (req, res) => {
  const { name, sku, lot, expiry, qty } = req.body;
  if (!name || !expiry) return res.status(400).send('Faltan campos');
  const list = readProducts();
  const newP = { id: randomUUID(), name, sku, lot, expiry, qty: Number(qty || 0) };
  list.push(newP);
  writeProducts(list);
  res.status(201).json(newP);
});

app.delete('/api/products/:id', (req, res) => {
  let list = readProducts();
  list = list.filter(p => p.id !== req.params.id);
  writeProducts(list);
  res.status(204).send();
});

app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));