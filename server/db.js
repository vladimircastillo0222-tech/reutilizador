// ============================================================
//  Base de datos SQLite (cero configuración, archivo local)
//  Usa node:sqlite incluido en Node 22+ — sin dependencias nativas.
// ============================================================
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.env.DB_PATH || './data/app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',               -- 'free' | 'pro'
  subscription_status TEXT NOT NULL DEFAULT 'none', -- 'none' | 'active' | 'canceled' | 'past_due'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tone TEXT,
  chars_in INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON generations(user_id, created_at);
`);

// ---------- Usuarios ----------
export function createUser(email, passwordHash) {
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email, plan, subscription_status, created_at'
  );
  return stmt.get(email.toLowerCase().trim(), passwordHash);
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
}

export function findUserById(id) {
  return db.prepare(
    'SELECT id, email, plan, subscription_status, stripe_customer_id, created_at FROM users WHERE id = ?'
  ).get(id);
}

export function findUserByStripeCustomer(customerId) {
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
}

export function setUserPlan(userId, { plan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId }) {
  db.prepare(`
    UPDATE users
    SET plan = COALESCE(?, plan),
        subscription_status = COALESCE(?, subscription_status),
        stripe_customer_id = COALESCE(?, stripe_customer_id),
        stripe_subscription_id = COALESCE(?, stripe_subscription_id)
    WHERE id = ?
  `).run(plan ?? null, subscriptionStatus ?? null, stripeCustomerId ?? null, stripeSubscriptionId ?? null, userId);
}

// ---------- Uso mensual ----------
export function countMonthlyGenerations(userId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM generations
    WHERE user_id = ?
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get(userId);
  return row.c;
}

export function logGeneration(userId, tone, charsIn) {
  db.prepare('INSERT INTO generations (user_id, tone, chars_in) VALUES (?, ?, ?)')
    .run(userId, tone, charsIn);
}
