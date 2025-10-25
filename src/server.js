/**
 * server.js
 * Versión propuesta: añade registro, login y creación por defecto de cuentas:
 * - admin / admin (rol: admin)
 * - manager / manager (rol: manager)
 * - worker  / worker  (rol: worker)
 *
 * Nota: este archivo sobrescribe o reemplaza el src/server.js existente.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_DIR = path.join(__dirname, 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'cambiame_en_produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // en producción usar true con HTTPS
}));

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Asegura la existencia del directorio y archivo de usuarios, y crea usuarios por defecto
function ensureUsersFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    // Crear usuarios por defecto con contraseñas hasheadas
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
    console.log('Archivo users.json creado con cuentas por defecto.');
  }
}

// Leer usuarios
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

// Guardar usuarios
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// Inicializar
ensureUsersFile();

// Rutas

// Página de registro (archivo estático en public/register.html)
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});

// Procesar registro
app.post('/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).send('Faltan campos: username, password o role.');
  }

  // No permitir crear cuenta 'admin' desde el formulario
  if (username.toLowerCase() === 'admin') {
    return res.status(400).send('No está permitido crear la cuenta "admin" desde el formulario.');
  }

  // Sólo permitir roles manager o worker al registrarse
  if (!['manager', 'worker'].includes(role)) {
    return res.status(400).send('Role inválido. Sólo se permiten: manager, worker.');
  }

  const users = readUsers();
  if (users.find(u => u.username === username)) {
    return res.status(400).send('El nombre de usuario ya existe.');
  }

  const saltRounds = 10;
  const hashed = bcrypt.hashSync(password, saltRounds);

  users.push({ username, password: hashed, role });
  writeUsers(users);

  return res.redirect('/login');
});

// Página de login (archivo estático en public/login.html)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Procesar login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).send('Usuario o contraseña incorrectos.');
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).send('Usuario o contraseña incorrectos.');
  }

  // Guardar sesión mínima
  req.session.user = { username: user.username, role: user.role };
  return res.redirect('/dashboard');
});

// Dashboard simple (muestra información según rol)
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const { username, role } = req.session.user;
  res.send(`
    <h1>Bienvenido ${username}</h1>
    <p>Rol: ${role}</p>
    <p><a href="/logout">Cerrar sesión</a></p>
    ${role === 'admin' ? '<p><a href="/admin/users">Ver todos los usuarios</a></p>' : ''}
  `);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/');
  });
});

// Ruta protegida: solo admin puede ver la lista de usuarios
app.get('/admin/users', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Acceso denegado. Requiere rol admin.');
  }
  const users = readUsers().map(u => ({ username: u.username, role: u.role }));
  res.send(`<h2>Usuarios registrados</h2><pre>${JSON.stringify(users, null, 2)}</pre><p><a href="/dashboard">Volver</a></p>`);
});

// Página principal simple (si existe index.html en public se servirá automáticamente)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
