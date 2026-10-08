// ============================================================
//  Reutilizador de Contenido — servidor
//  Arranca con: npm install && npm start
// ============================================================
import 'dotenv/config'; // debe ir primero: los imports ESM se evalúan antes que dotenv.config()

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { signup, login, requireAuth } from './auth.js';
import { countMonthlyGenerations, logGeneration } from './db.js';
import { generateRepurposing } from './aiProvider.js';
import { router as billingRouter, initStripe, handleWebhook, stripeConfigured } from './stripe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PORT = Number(process.env.PORT || 3000);
const FREE_LIMIT = Number(process.env.FREE_MONTHLY_LIMIT || 5);

// Stripe (modo prueba) se inicializa aquí; si las claves son reales, el proceso se detiene.
initStripe();

const app = express();

// Webhook de Stripe ANTES de express.json() (necesita el cuerpo crudo)
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(ROOT, 'public')));

// ---------- Salud ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, stripe_test_mode: stripeConfigured(), ai_provider: process.env.AI_PROVIDER || 'local' });
});

// ---------- Auth ----------
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);

// ---------- Perfil + uso ----------
app.get('/api/me', requireAuth, (req, res) => {
  return res.json({
    user: { id: req.user.id, email: req.user.email, plan: req.user.plan },
    usage: {
      used: countMonthlyGenerations(req.user.id),
      limit: req.user.plan === 'pro' ? null : FREE_LIMIT, // null = ilimitado
    },
  });
});

// ---------- Reutilizar ----------
app.post('/api/repurpose', requireAuth, async (req, res) => {
  try {
    // Límite del plan gratis
    if (req.user.plan !== 'pro') {
      const used = countMonthlyGenerations(req.user.id);
      if (used >= FREE_LIMIT) {
        return res.status(402).json({
          error: `Llegaste a tu límite gratis (${FREE_LIMIT} usos este mes). Pásate a Pro para usos ilimitados.`,
          upgrade: true,
          usage: { used, limit: FREE_LIMIT },
        });
      }
    }
    const { text, tone } = req.body || {};
    const result = await generateRepurposing({ text, tone });
    logGeneration(req.user.id, tone || 'energetico', (text || '').length);
    const used = countMonthlyGenerations(req.user.id);
    return res.json({
      ...result,
      usage: { used, limit: req.user.plan === 'pro' ? null : FREE_LIMIT },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Ocurrió un error. Inténtalo de nuevo.' });
  }
});

// ---------- Facturación (Stripe modo prueba) ----------
app.use('/api/billing', billingRouter);

// ---------- Arranque ----------
app.listen(PORT, () => {
  console.log('');
  console.log('🔁 Reutilizador de Contenido corriendo en: http://localhost:' + PORT);
  console.log(`   Proveedor de IA: ${(process.env.AI_PROVIDER || 'local')} ${ (process.env.AI_PROVIDER || 'local') === 'local' ? '(gratis, sin API)' : '(¡revisa costos por uso!)' }`);
  console.log(`   Plan gratis: ${FREE_LIMIT} usos/mes · Plan Pro: $19/mes (Stripe MODO PRUEBA)`);
  console.log('');
});
