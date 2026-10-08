// ============================================================
//  Reutilizador de Contenido — lógica del frontend
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let authMode = 'login';
let currentTone = 'energetico';

const EXAMPLE = `La constancia le gana al talento cuando el talento no es constante. La mayoría de los creadores abandona en los primeros 90 días porque espera resultados inmediatos. Pero el algoritmo premia a quien publica con regularidad, no a quien publica perfecto una vez al mes. Empieza con tres publicaciones por semana, mide qué funciona y repite el formato ganador. No necesitas el mejor equipo: necesitas el mejor hábito. El crecimiento en redes es un juego de resistencia, y cada video que subes es un boleto más en la rifa de la viralidad. Documenta tu proceso en lugar de esperar a tenerlo todo perfecto, porque la autenticidad conecta más que la producción cara.`;

// ---------- Auth ----------
function setToken(t) {
  if (t) localStorage.setItem('rc_token', t);
  else localStorage.removeItem('rc_token');
}
function getToken() { return localStorage.getItem('rc_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }; }

$$('.auth-tab').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.auth-tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    authMode = b.dataset.mode;
    $('#auth-submit').textContent = authMode === 'login' ? 'Entrar' : 'Crear cuenta gratis';
    $('#auth-error').classList.add('hidden');
  })
);

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const err = $('#auth-error');
  err.classList.add('hidden');
  try {
    const r = await fetch(`/api/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error de acceso');
    setToken(data.token);
    await boot();
  } catch (e2) {
    err.textContent = e2.message;
    err.classList.remove('hidden');
  }
});

$('#btn-logout').addEventListener('click', () => {
  setToken(null);
  boot();
});

// ---------- Vistas ----------
async function boot() {
  const token = getToken();
  if (!token) {
    $('#view-auth').classList.remove('hidden');
    $('#view-app').classList.add('hidden');
    $('#user-chip').classList.add('hidden');
    $('#btn-logout').classList.add('hidden');
    return;
  }
  try {
    const r = await fetch('/api/me', { headers: authHeaders() });
    if (!r.ok) throw new Error('sesión inválida');
    const data = await r.json();
    $('#view-auth').classList.add('hidden');
    $('#view-app').classList.remove('hidden');
    const chip = $('#user-chip');
    chip.textContent = `👤 ${data.user.email} · ${data.user.plan === 'pro' ? 'PRO ⭐' : 'Gratis'}`;
    chip.classList.remove('hidden');
    $('#btn-logout').classList.remove('hidden');
    renderUsage(data.usage);
    if (data.user.plan === 'pro') $('#btn-upgrade').style.display = 'none';
  } catch {
    setToken(null);
    boot();
  }
}

function renderUsage(usage) {
  if (!usage) return;
  if (usage.limit === null) {
    $('#usage-text').textContent = 'Plan Pro ⭐ — usos ilimitados';
    $('#usage-fill').style.width = '100%';
    return;
  }
  $('#usage-text').textContent = `${usage.used}/${usage.limit} usos gratis este mes`;
  $('#usage-fill').style.width = Math.min(100, (usage.used / usage.limit) * 100) + '%';
}

// ---------- Tonos ----------
$$('.tone').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.tone').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    currentTone = b.dataset.tone;
  })
);

$('#btn-example').addEventListener('click', () => {
  $('#input-text').value = EXAMPLE;
});

// ---------- Pestañas ----------
$$('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('active'));
    $$('.panel').forEach((p) => p.classList.add('hidden'));
    b.classList.add('active');
    document.querySelector(`[data-panel="${b.dataset.tab}"]`).classList.remove('hidden');
  })
);

// ---------- Copiar ----------
function copyText(text, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = '✅ ¡Copiado!';
    setTimeout(() => (btn.textContent = old), 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch { alert('No se pudo copiar automáticamente. Selecciona el texto manualmente.'); }
  document.body.removeChild(ta);
}
$$('[data-copy]').forEach((b) =>
  b.addEventListener('click', () => {
    const key = b.dataset.copy;
    copyText($('#out-' + key).textContent, b);
  })
);

// ---------- Generar ----------
$('#btn-generate').addEventListener('click', async () => {
  const text = $('#input-text').value.trim();
  const err = $('#gen-error');
  const btn = $('#btn-generate');
  err.classList.add('hidden');
  if (text.length < 120) {
    err.textContent = 'Pega un texto más largo (mínimo unas 3 frases) para generar buenos resultados.';
    err.classList.remove('hidden');
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ Generando…';
  try {
    const r = await fetch('/api/repurpose', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, tone: currentTone }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (data.upgrade) {
        err.innerHTML = `${data.error} <a href="/pricing.html">Ver plan Pro</a>`;
      } else {
        err.textContent = data.error || 'Ocurrió un error.';
      }
      err.classList.remove('hidden');
      return;
    }
    $('#out-tiktok').textContent = data.tiktok;
    $('#out-instagram').textContent = data.instagram;
    $('#out-x').textContent = data.x;
    $('#count-tiktok').textContent = `${data.tiktok.length} caracteres`;
    $('#count-instagram').textContent = `${data.instagram.length} caracteres (límite IG: 2200)`;
    $('#count-x').textContent = `${data.x.length} caracteres en total`;
    $('#results').classList.remove('hidden');
    renderUsage(data.usage);
    $('#results').scrollIntoView({ behavior: 'smooth' });
  } catch {
    err.textContent = 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Reutilizar contenido';
  }
});

boot();
