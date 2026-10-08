// ============================================================
//  Autenticación: registro, login y middleware JWT
// ============================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.includes('CAMBIA_ESTO')) {
  console.error('⛔ Falta JWT_SECRET válido en tu archivo .env');
  console.error('   Copia .env.example a .env y pon una clave larga y aleatoria.');
  process.exit(1);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(u) {
  return { id: u.id, email: u.email, plan: u.plan, subscription_status: u.subscription_status };
}

export async function signup(req, res) {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Escribe un correo válido.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Ese correo ya tiene cuenta. Inicia sesión.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = createUser(email, hash);
  return res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Escribe tu correo y contraseña.' });
  }
  const user = findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  return res.json({ token: signToken(user.id), user: publicUser(findUserById(user.id)) });
}

// Middleware: exige token válido en Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No has iniciado sesión.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Sesión inválida.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada. Vuelve a entrar.' });
  }
}
