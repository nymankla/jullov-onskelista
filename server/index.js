import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { api } from './api.js';
import { UPLOADS_DIR, getState } from './store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const app = express();
app.disable('x-powered-by');
// Bakom Railways proxy: lita på X-Forwarded-*
const trustProxy = process.env.TRUST_PROXY || (process.env.RAILWAY_ENVIRONMENT ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, api);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

// Självhostade typsnitt så att appen fungerar offline
const fontDir = (pkg) => path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files');
app.use('/fonts/cormorant', express.static(fontDir('cormorant-garamond'), { maxAge: '365d' }));
app.use('/fonts/inter', express.static(fontDir('inter'), { maxAge: '365d' }));

app.use(express.static(path.join(ROOT, 'public'), {
  setHeaders(res, file) {
    if (file.endsWith('sw.js') || file.endsWith('.html') || file.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Jullovets önskelista körs på http://localhost:${port} (${getState().wishes.length} önskade rätter)`);
});

// Vid omdeploy skickar Railway SIGTERM: avsluta pågående anrop innan processen stängs
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig}: stänger servern`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
