// ============================================================
//  CAPA DE ABSTRACCIÓN DEL PROVEEDOR DE IA
// ------------------------------------------------------------
//  generateRepurposing({ text, tone }) -> { tiktok, instagram, x }
//
//  AI_PROVIDER=local     → motor de plantillas incluido (GRATIS, sin API)
//                           Es el valor por defecto. Funciona sin claves.
//  AI_PROVIDER=openai     → API de OpenAI (requiere OPENAI_API_KEY;
//                           CUESTA DINERO por cada uso).
//  AI_PROVIDER=anthropic  → API de Anthropic (requiere ANTHROPIC_API_KEY;
//                           CUESTA DINERO por cada uso).
//
//  Para conectar una API real en el futuro, completa el TODO marcado
//  en openaiGenerate() / anthropicGenerate(). Mientras tanto, el
//  motor local es el que genera todo, sin costo alguno.
// ============================================================

export async function generateRepurposing({ text, tone = 'energetico' }) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 120) {
    const err = new Error('Pega un texto más largo (mínimo unas 3 frases) para generar buenos resultados.');
    err.status = 400;
    throw err;
  }
  const provider = (process.env.AI_PROVIDER || 'local').toLowerCase();
  if (provider === 'openai') return openaiGenerate(clean, tone);
  if (provider === 'anthropic') return anthropicGenerate(clean, tone);
  return localGenerate(clean, tone); // por defecto
}

// ------------------------------------------------------------
//  MOTOR LOCAL (gratis): división de frases, hooks, hashtags,
//  guion de TikTok, caption de Instagram e hilo de X.
// ------------------------------------------------------------

const TONES = {
  energetico: {
    nombre: 'Enérgico',
    hooks: [
      (s) => `🔥 ¡PARA TODO! ${s}`,
      (s) => `🤯 Esto te va a volar la cabeza: ${lcFirst(s)}`,
      (s) => `⚡ Nadie habla de esto: ${lcFirst(s)}`,
    ],
    cta: '🔥 Sígueme para más contenido así y compártelo con quien lo necesite.',
    igCta: '💬 ¿Te sirvió? Guárdalo y compártelo con alguien que lo necesite 👇',
  },
  profesional: {
    nombre: 'Profesional',
    hooks: [
      (s) => `Dato clave: ${lcFirst(s)}`,
      (s) => `Esto es lo que debes saber: ${lcFirst(s)}`,
      (s) => `Un apunte importante: ${lcFirst(s)}`,
    ],
    cta: 'Sígueme para más análisis y comparte esto con tu equipo.',
    igCta: '¿Te resultó útil? Guárdalo para consultarlo después.',
  },
  divertido: {
    nombre: 'Divertido',
    hooks: [
      (s) => `😂 Ok, esto está buenísimo: ${lcFirst(s)}`,
      (s) => `👀 Agárrate: ${lcFirst(s)}`,
      (s) => `🍿 Ponte cómodo, que se pone bueno: ${lcFirst(s)}`,
    ],
    cta: '😄 Si te gustó, sígueme que se pone mejor. ¡Comparte!',
    igCta: '😂 Etiqueta a ese amigo que necesita leer esto 👇',
  },
};

function lcFirst(s) {
  s = stripEnd(s);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function stripEnd(s) {
  return (s || '').trim().replace(/[.!?…]+$/, '');
}

function splitSentences(text) {
  const matches = text.match(/[^.!?…\n]+[.!?…]+["”»)]?|[^.!?…\n]+$/g);
  if (!matches) return [text.trim()];
  return matches.map((s) => s.trim()).filter((s) => s.length > 2);
}

const STOPWORDS = new Set(
  'el la los las un una unos unas lo al del de en y o u e que qué con por para como cómo se su sus me te nos le les este esta estos estas ese esa esos esas esto eso muy más mas pero cuando donde dónde mientras también solo sólo hay está están es son fue fueron era eran ser tiene tienen hacer hace hacen puede pueden cada entre sobre hasta desde sin tras ante bajo hacia durante mediante según cual cuál cuales quién quien aunque siempre nunca todo toda todos todas mucho mucha muchos muchas poco poca otro otra otros otras mismo misma tan tanto tal tales dos tres uno primer primera gran grande nuevo nueva buen bueno buena mis tus nuestro nuestra'.split(' ')
);

function extractKeywords(text, max = 10) {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/);
  const freq = new Map();
  for (const w of words) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

function chunkInto(sentences, parts) {
  const groups = Array.from({ length: parts }, () => []);
  sentences.forEach((s, i) => {
    groups[Math.min(parts - 1, Math.floor((i * parts) / Math.max(1, sentences.length)))].push(s);
  });
  return groups.filter((g) => g.length);
}

function buildTikTok(sentences, toneKey) {
  const T = TONES[toneKey] || TONES.energetico;
  const hookFn = T.hooks[sentences.join(' ').length % T.hooks.length];
  const hook = hookFn(sentences[0]);
  const rest = sentences.slice(1);
  const scenes = chunkInto(rest.length ? rest : sentences.slice(0), 3);
  const words = sentences.join(' ').split(/\s+/).length;
  const seconds = Math.max(15, Math.round(words / 2.5));

  let out = '🎬 GUION PARA TIKTOK\n\n';
  out += '🪝 HOOK (primeros 3 segundos):\n' + hook + '\n\n';
  out += '🎞️ DESARROLLO:\n';
  scenes.forEach((g, i) => {
    out += `\n— Escena ${i + 1}:\n` + g.map((s) => `• ${s}`).join('\n') + '\n';
  });
  out += '\n📣 CIERRE / CTA:\n' + T.cta + '\n';
  out += `\n⏱️ Duración estimada: ~${seconds} segundos`;
  return out;
}

function buildInstagram(sentences, keywords, toneKey) {
  const T = TONES[toneKey] || TONES.energetico;
  let summary = sentences.slice(0, 2).join(' ');
  if (summary.length > 320) summary = summary.slice(0, 317).trimEnd() + '…';
  const tags = keywords.slice(0, 10).map((k) => '#' + k).join(' ');
  return `${summary}\n\n.\n.\n.\n\n${tags}\n\n${T.igCta}`;
}

function buildThread(sentences, toneKey) {
  const T = TONES[toneKey] || TONES.energetico;
  const tweets = [];
  let current = '';
  const push = () => {
    if (current.trim()) tweets.push(current.trim());
    current = '';
  };
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > 260) push();
    current = (current + ' ' + s).trim();
  }
  push();
  const n = tweets.length;
  return tweets
    .map((t, i) => (i === 0 ? `🧵 ${i + 1}/${n}\n\n` : `${i + 1}/${n}\n\n`) + t)
    .join('\n\n---\n\n');
}

function localGenerate(text, toneKey) {
  const tone = TONES[toneKey] ? toneKey : 'energetico';
  const sentences = splitSentences(text);
  const keywords = extractKeywords(text);
  return {
    tiktok: buildTikTok(sentences, tone),
    instagram: buildInstagram(sentences, keywords, tone),
    x: buildThread(sentences, tone),
    meta: {
      provider: 'local',
      tone,
      sentences: sentences.length,
      charsIn: text.length,
      keywords,
    },
  };
}

// ------------------------------------------------------------
//  Proveedores reales (OPCIONAL, cuestan dinero por uso).
//  Están declarados para que el cambio sea de una línea en .env,
//  pero la llamada HTTP está marcada como TODO a propósito:
//  nunca se llamará a una API de pago sin que el dueño la
//  configure y la apruebe explícitamente.
// ------------------------------------------------------------

async function openaiGenerate(text, tone) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error('AI_PROVIDER=openai pero falta OPENAI_API_KEY en el .env');
    err.status = 500;
    throw err;
  }
  // TODO (salida a producción): implementa aquí la llamada a
  // https://api.openai.com/v1/chat/completions con un prompt que pida
  // { tiktok, instagram, x } en JSON. Costo aprox: revisa
  // https://openai.com/api/pricing (ej. gpt-4o-mini ≈ $0.15 / 1M tokens de entrada).
  const err = new Error('Proveedor OpenAI declarado pero aún no cableado. Completa el TODO en server/aiProvider.js o usa AI_PROVIDER=local.');
  err.status = 501;
  throw err;
}

async function anthropicGenerate(text, tone) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error('AI_PROVIDER=anthropic pero falta ANTHROPIC_API_KEY en el .env');
    err.status = 500;
    throw err;
  }
  // TODO (salida a producción): implementa aquí la llamada a
  // https://api.anthropic.com/v1/messages. Costo aprox: revisa
  // https://www.anthropic.com/pricing (ej. Haiku ≈ $0.25 / 1M tokens de entrada).
  const err = new Error('Proveedor Anthropic declarado pero aún no cableado. Completa el TODO en server/aiProvider.js o usa AI_PROVIDER=local.');
  err.status = 501;
  throw err;
}
