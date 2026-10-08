// ============================================================
//  Stripe — INTEGRACIÓN EN MODO DE PRUEBA ÚNICAMENTE
// ------------------------------------------------------------
//  - Solo acepta claves de prueba (sk_test_...). Si detecta una
//    clave real (sk_live_...), el servidor SE NIEGA a arrancar.
//  - Sin claves configuradas, la facturación queda desactivada
//    y el resto de la app funciona normal (modo local).
//  - Para probar pagos usa la tarjeta 4242 4242 4242 4242
//    (cualquier fecha futura y cualquier CVC).
// ============================================================
import express from 'express';
import Stripe from 'stripe';
import { requireAuth } from './auth.js';
import { setUserPlan, findUserByStripeCustomer } from './db.js';

export const router = express.Router();

let stripe = null;
let webhookSecret = null;

export function stripeConfigured() {
  return !!stripe;
}

export function initStripe() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  const priceHint = (process.env.STRIPE_PRICE_ID || '').trim();

  if (!key || key.includes('TU_CLAVE')) {
    console.log('⚠️  Stripe no configurado: la página de precios mostrará un aviso (modo local).');
    console.log('   Para activar el modo PRUEBA, pon tus claves sk_test_ en el .env (ver .env.example).');
    return null;
  }
  if (key.startsWith('sk_live_')) {
    console.error('⛔ STRIPE_SECRET_KEY es una clave REAL (sk_live_).');
    console.error('   Este proyecto solo permite MODO DE PRUEBA. Cambia a una clave sk_test_.');
    process.exit(1);
  }
  if (!key.startsWith('sk_test_')) {
    console.error('⛔ STRIPE_SECRET_KEY debe empezar con sk_test_ (modo prueba).');
    process.exit(1);
  }
  stripe = new Stripe(key);
  webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim() || null;
  if (!webhookSecret || webhookSecret.includes('TU_SECRETO')) {
    console.log('⚠️  Sin STRIPE_WEBHOOK_SECRET: el webhook aceptará eventos sin verificar firma (solo para pruebas locales).');
  }
  if (!priceHint || priceHint.includes('TU_PRECIO')) {
    console.log('⚠️  Falta STRIPE_PRICE_ID en el .env: crea un precio de prueba de $19/mes en el Dashboard de Stripe.');
  }
  console.log('💳 Stripe en MODO DE PRUEBA activado (ningún cargo real).');
  return stripe;
}

// Crear sesión de Checkout para la suscripción Pro ($19/mes, prueba)
router.post('/checkout', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe no está configurado. Activa el modo de prueba en el .env (ver README).',
    });
  }
  const priceId = (process.env.STRIPE_PRICE_ID || '').trim();
  if (!priceId || priceId.includes('TU_PRECIO')) {
    return res.status(503).json({
      error: 'Falta STRIPE_PRICE_ID. Crea el precio de $19/mes en el Dashboard de Stripe (modo prueba) y ponlo en el .env.',
    });
  }
  try {
    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    // Reutiliza el customer si ya existe
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { app_user_id: String(req.user.id) },
      });
      customerId = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: String(req.user.id),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing.html?cancelado=1`,
    });
    // Guarda el customer para reconciliar en el webhook
    setUserPlan(req.user.id, { stripeCustomerId: customerId });
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: 'No se pudo iniciar el pago de prueba: ' + err.message });
  }
});

// Webhook: Stripe avisa aquí de pagos y cancelaciones.
// IMPORTANTE: esta ruta necesita el cuerpo "crudo" (raw); se monta
// en index.js ANTES de express.json().
export async function handleWebhook(req, res) {
  if (!stripe) return res.status(503).send('Stripe no configurado');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      console.log('⚠️  Webhook sin firma verificada (modo local).');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const userId = Number(s.client_reference_id);
      if (userId) {
        setUserPlan(userId, {
          plan: 'pro',
          subscriptionStatus: 'active',
          stripeCustomerId: typeof s.customer === 'string' ? s.customer : s.customer?.id,
          stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : s.subscription?.id,
        });
        console.log(`✅ Usuario ${userId} ahora es PRO (prueba).`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const user = customerId ? findUserByStripeCustomer(customerId) : null;
      if (user) {
        setUserPlan(user.id, { plan: 'free', subscriptionStatus: 'canceled', stripeSubscriptionId: null });
        console.log(`↩️ Usuario ${user.id} volvió al plan gratis (suscripción cancelada).`);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const user = customerId ? findUserByStripeCustomer(customerId) : null;
      if (user) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        setUserPlan(user.id, {
          plan: active ? 'pro' : 'free',
          subscriptionStatus: sub.status,
        });
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }
  return res.json({ received: true });
}

// Estado de facturación del usuario actual
router.get('/status', requireAuth, (req, res) => {
  res.json({
    plan: req.user.plan,
    subscription_status: req.user.subscription_status,
    stripe_configured: stripeConfigured(),
    test_mode: true,
  });
});
