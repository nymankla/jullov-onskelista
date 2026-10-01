// Import av recept från webbsidor via schema.org/Recipe (JSON-LD), som koket.se, ica.se, arla.se m.fl. publicerar.
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'JullovOnskelista/1.0 (+receptimport för familjens önskelista)';
const MAX_HTML = 5 * 1024 * 1024;
export const MAX_IMAGE = 4 * 1024 * 1024;

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- Säker hämtning: bara http(s) mot publika adresser (skydd mot SSRF) ----------
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw fail('Ogiltig webbadress'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw fail('Endast http- och https-adresser stöds');
  const addrs = await dns.lookup(url.hostname, { all: true }).catch(() => { throw fail(`Hittar inte servern ${url.hostname}`); });
  if (addrs.some((a) => isPrivateIp(a.address))) throw fail('Adressen pekar på ett internt nätverk');
  return url;
}

/** fetch med kontroll av varje omdirigering, tidsgräns och storleksgräns. */
export async function safeFetch(raw, { maxBytes = MAX_HTML, accept = 'text/html' } = {}) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': UA, accept, 'accept-language': 'sv,en;q=0.8' },
      signal: AbortSignal.timeout(15000),
    }).catch((e) => { throw fail(`Kunde inte hämta sidan: ${e.cause?.code ?? e.message}`, 502); });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url).href);
      continue;
    }
    if (!res.ok) throw fail(`Sidan svarade med ${res.status}`, 502);
    if (Number(res.headers.get('content-length')) > maxBytes) throw fail('Filen är för stor', 413);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) throw fail('Filen är för stor', 413);
      chunks.push(chunk);
    }
    return { url: url.href, contentType: res.headers.get('content-type') ?? '', body: Buffer.concat(chunks) };
  }
  throw fail('För många omdirigeringar', 502);
}

// ---------- Tolkning av JSON-LD ----------
const types = (x) => [].concat(x?.['@type'] ?? []);
const decode = (s) => String(s ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if (types(node).includes('Recipe')) return node;
  for (const key of ['@graph', 'mainEntity', 'itemListElement']) { const r = findRecipe(node[key]); if (r) return r; }
  return null;
}

export function extractRecipeJsonLd(html) {
  const re = /<script[^>]*type=["']?application\/ld(?:\+|&#x2B;|&#43;)json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const r = findRecipe(JSON.parse(m[1].trim()));
      if (r) return r;
    } catch { /* trasig JSON-LD: prova nästa block */ }
  }
  return null;
}

function imageUrl(img, base) {
  const first = [].concat(img ?? [])[0];
  const src = typeof first === 'string' ? first : first?.url ?? first?.contentUrl;
  try { return src ? new URL(src, base).href : ''; } catch { return ''; }
}

export function instructionsToSteps(ins) {
  const steps = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      // En del sajter lägger alla steg i en sträng
      for (const part of decode(node).split(/\s*(?:\n|(?<=\.)\s+(?=\d+\.\s))\s*/)) if (part.trim()) steps.push(part.replace(/^\d+\.\s*/, '').trim());
      return;
    }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (types(node).includes('HowToSection')) { walk(node.itemListElement); return; }
    const t = decode(node.text ?? node.name ?? '');
    if (t) steps.push(t);
  };
  walk(ins);
  return steps;
}

/** Gör om schema.org/Recipe till de fält en önskad rätt har. */
export function toWishDraft(ld, pageUrl) {
  const yieldNum = Number(String([].concat(ld.recipeYield ?? [])[0] ?? '').match(/\d+/)?.[0]) || null;
  const host = new URL(pageUrl).hostname.replace(/^www\./, '');
  return {
    title: decode(ld.name),
    note: decode(ld.description).slice(0, 400),
    url: pageUrl,
    servings: yieldNum,
    ingredients: [].concat(ld.recipeIngredient ?? ld.ingredients ?? []).map(decode).filter(Boolean),
    steps: instructionsToSteps(ld.recipeInstructions),
    imageUrl: imageUrl(ld.image, pageUrl),
    host,
  };
}

export async function importFromUrl(url) {
  const page = await safeFetch(url);
  if (!/html|xml/.test(page.contentType)) throw fail('Adressen är inte en webbsida');
  const ld = extractRecipeJsonLd(page.body.toString('utf8'));
  if (!ld) throw fail('Hittade inget recept på sidan. Sidan måste innehålla receptdata enligt schema.org. Du kan fylla i rätten för hand.', 422);
  return toWishDraft(ld, page.url);
}

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Hämtar en bild. Returnerar null om den inte går att använda, eftersom receptet fungerar utan bild. */
export async function fetchImage(url) {
  try {
    const img = await safeFetch(url, { maxBytes: MAX_IMAGE, accept: 'image/*' });
    const ext = IMAGE_TYPES[img.contentType.split(';')[0].trim().toLowerCase()];
    return ext ? { body: img.body, ext } : null;
  } catch {
    return null;
  }
}
