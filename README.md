# 🔁 Reutilizador de Contenido

Micro-SaaS en español para creadores de contenido: pegas un texto largo (o la transcripción de un video) y obtienes, listo para copiar:

- 🎵 **Guion de TikTok** con hook de 3 segundos, desarrollo por escenas y CTA
- 📸 **Caption de Instagram** con hashtags extraídos de tu texto
- 𝕏 **Hilo de X** dividido en tuits de menos de 280 caracteres

Con 3 tonos a elegir: ⚡ Enérgico, 💼 Profesional y 😄 Divertido.

**Modelo de negocio:** plan gratis (5 usos/mes) + plan Pro **$19/mes** con usos ilimitados, cobrado con Stripe.

> 🧪 **Estado actual: versión 1.0 local, costo $0.** No hay dominio comprado, no hay hosting contratado, Stripe está SOLO en modo de prueba y la IA es un motor de plantillas incluido (gratis). Nada de lo que hay aquí gasta dinero.

---

## Requisitos

- **Node.js 22 o superior** (usa la base de datos SQLite incluida en Node, sin instalar nada más).
  Verifica con: `node --version`

## Cómo correrlo en tu computadora

```bash
cd ~/workspace/microapps/reutilizador

# 1. Instalar dependencias (solo una vez)
npm install

# 2. Crear tu archivo de configuración (solo una vez)
cp .env.example .env

# 3. Pon una clave secreta larga en el .env (obligatorio para las sesiones)
#    Genera una con:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    y pégala en la línea JWT_SECRET=

# 4. Arrancar
npm start
```

Abre en tu navegador: **http://localhost:3000**

1. Crea tu cuenta (es local, no sale de tu máquina).
2. Pega un texto largo o toca **"Cargar ejemplo"**.
3. Elige un tono y pulsa **✨ Reutilizar contenido**.
4. Cambia de pestaña (TikTok / Instagram / X) y usa **📋 Copiar**.

La página **Precios** muestra el plan Pro de $19/mes. Sin claves de Stripe configuradas verás un aviso; con claves de prueba podrás completar un pago falso con la tarjeta `4242 4242 4242 4242`.

---

## Probar los pagos (modo prueba, $0)

1. Crea una cuenta gratis en [dashboard.stripe.com](https://dashboard.stripe.com) (no pide tarjeta).
2. Activa el **modo de prueba** (interruptor "Test mode" arriba a la derecha).
3. Ve a **Product catalog → Add product**: nombre "Pro", precio **$19 USD / mes** recurrente → copia el **Price ID** (`price_...`).
4. Ve a **Developers → API keys** → copia la **Secret key** de prueba (`sk_test_...`).
5. Pégalas en tu `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_ID=price_...
   BASE_URL=http://localhost:3000
   ```
6. (Opcional, para que la suscripción se active sola) Instala la [Stripe CLI](https://docs.stripe.com/stripe-cli) y corre:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
   Copia el secreto `whsec_...` que te muestra en `STRIPE_WEBHOOK_SECRET` del `.env`.
7. Reinicia con `npm start`, entra a **Precios → Suscribirme** y paga con `4242 4242 4242 4242` (cualquier fecha futura y CVC). Verás la pantalla de éxito y tu cuenta pasará a **PRO ⭐** con usos ilimitados.

---

## Estructura del proyecto

```
reutilizador/
├── package.json            # Dependencias y script de arranque
├── .env.example            # Plantilla de configuración (sin secretos)
├── .gitignore              # Evita subir .env y la base de datos
├── README.md               # Este archivo
├── server/
│   ├── index.js            # Servidor Express: rutas y arranque
│   ├── db.js               # SQLite (usuarios + conteo de usos mensuales)
│   ├── auth.js             # Registro/login con JWT
│   ├── aiProvider.js       # CAPA DE IA: motor local gratis + interfaz para API real
│   └── stripe.js           # Stripe SOLO en modo prueba + webhook de suscripciones
└── public/
    ├── index.html          # App: login, editor, tonos, pestañas, copiar
    ├── app.js              # Lógica del frontend
    ├── styles.css          # Diseño móvil
    ├── pricing.html        # Página de precios ($19/mes)
    └── success.html        # Confirmación de suscripción (prueba)
```

**Cómo funciona la capa de IA (`server/aiProvider.js`):** todo pasa por `generateRepurposing({ text, tone })`. Con `AI_PROVIDER=local` (por defecto) usa el motor de plantillas incluido: divide en frases, genera el hook según el tono, extrae palabras clave para hashtags y arma el hilo. Para usar IA real en el futuro se cambia a `AI_PROVIDER=openai` (o `anthropic`) y se completa el bloque marcado `TODO` — pero eso **cuesta dinero por cada uso** (ver checklist abajo).

---

## ✅ Checklist para salir a producción (salir a vender de verdad)

Nada de esto está hecho todavía. Cada punto dice si cuesta dinero.

### Gratis (solo configuración)
- [x] **Página de ventas** (`public/landing.html`): hero con dolor, cómo funciona, ejemplo real, planes y FAQ — lista para recibir tráfico de TikTok.
- [x] **Archivo `render.yaml`**: despliegue en el plan gratis de Render ($0) listo para conectar. OJO: Netlify (el del video) no sirve para esta app porque es un servidor Node con base de datos — Render Free sí.
- [ ] Generar un `JWT_SECRET` largo y aleatorio en el servidor.
- [ ] Cambiar `BASE_URL` a tu dominio real (ej. `https://reutilizador.app`).
- [ ] En Stripe: terminar la **verificación del negocio** (te piden identidad y datos bancarios; es gratis, Stripe solo cobra comisión por cada cobro).
- [ ] Configurar el **webhook de producción** en Stripe apuntando a `https://tudominio.com/api/billing/webhook` y poner su secreto en `STRIPE_WEBHOOK_SECRET`.
- [ ] Hacer copia de seguridad periódica del archivo SQLite (o migrar a Postgres cuando crezca).

### Cuestan dinero 💰 (requieren tu aprobación antes de pagar)
- [ ] **Dominio** (~$10–15/año, ej. en Cloudflare o Namecheap). 💰
- [ ] **Hosting**: Vercel / Railway / Render (~$0–7/mes para empezar). 💰
- [ ] **Stripe en modo real**: cambiar las claves `sk_test_` por las `sk_live_` y recrear el precio de $19/mes en modo real. Activar el negocio es gratis; Stripe cobra **2.9% + $0.30 USD por cada cobro** (de los $19 te quedarían ~$18.15). 💰 por transacción.
- [ ] **API de IA real** (opcional pero recomendada para un producto que la gente pague): poner `AI_PROVIDER=openai` (o `anthropic`) + la API key, y completar el `TODO` en `server/aiProvider.js`. Costo aproximado por cada texto reutilizado: **$0.01–0.05 USD** según el modelo (ej. `gpt-4o-mini` o `claude-haiku`). Con 100 clientes que usen 20 veces al mes ≈ **$20–100/mes** de costo de IA. 💰 por uso.

### Ejemplo de números (para que veas el margen)
- 100 suscriptores × $19 = **$1,900/mes** de ingreso.
- Stripe (~2.9% + $0.30): ≈ **−$85**.
- IA (100 × 20 usos × $0.02): ≈ **−$40**.
- Hosting + dominio prorrateado: ≈ **−$8**.
- **Ganancia aprox: ~$1,767/mes.** La IA es un costo pequeño; el margen es tuyo.

---

## Seguridad

- Las contraseñas se guardan con hash (bcrypt), nunca en texto claro.
- Las sesiones usan JWT firmado con tu `JWT_SECRET`.
- El `.env` (con tus claves) **nunca** se sube a git: está en `.gitignore`.
- El servidor **se niega a arrancar** si detecta claves reales de Stripe (`sk_live_`): este proyecto solo permite modo de prueba hasta que tú decidas lo contrario.
