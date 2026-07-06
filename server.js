#!/usr/bin/env node
/*
 * Trophy Room Kiosk — zero-dependency Node.js host server.
 * Serves the app, a JSON API backed by a single db file, and an SSE
 * channel so every device on the LAN sees changes instantly.
 *
 *   node server.js [port]      (default port 8080)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BASE_FILE = path.join(ROOT, 'base-config.json');
const PORT = parseInt(process.argv[2], 10) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ---------------------------------------------------------------- db --- */

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

const DEFAULT_DB = {
  version: 1,
  pinHash: sha256('1234'), // default admin PIN: 1234
  overrides: {},           // builtin id -> replacement trophy object
  deleted: [],             // builtin ids hidden from the gallery
  custom: [],              // trophies added at runtime
  settings: null,          // null = use base-config settings untouched
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}

let base = readJson(BASE_FILE, { trophies: [], settings: {} });
let db = Object.assign({}, DEFAULT_DB, readJson(DB_FILE, {}));

let saveTimer = null;
function saveDb() {
  db.version++;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
  broadcast();
}

function mergedTrophies() {
  const out = [];
  for (const t of base.trophies) {
    if (db.deleted.includes(t.id)) continue;
    out.push(db.overrides[t.id] ? Object.assign({}, db.overrides[t.id], { id: t.id, builtin: true, edited: true }) : Object.assign({}, t, { builtin: true }));
  }
  for (const t of db.custom) out.push(Object.assign({}, t, { builtin: false }));
  return out;
}

function mergedSettings() {
  return Object.assign({}, base.settings, db.settings || {});
}

function publicState() {
  return { version: db.version, trophies: mergedTrophies(), settings: mergedSettings() };
}

/* --------------------------------------------------------------- auth --- */

const tokens = new Set();
function newToken() {
  const t = crypto.randomBytes(24).toString('hex');
  tokens.add(t);
  if (tokens.size > 200) tokens.delete(tokens.values().next().value);
  return t;
}
function authed(req) {
  const t = req.headers['x-token'];
  return t && tokens.has(t);
}

/* ---------------------------------------------------------------- sse --- */

const sseClients = new Set();
function broadcast() {
  const msg = `data: ${JSON.stringify({ version: db.version })}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch (e) { sseClients.delete(res); } }
}
setInterval(() => { // keep-alive so TV browsers don't drop the stream
  for (const res of sseClients) { try { res.write(': ping\n\n'); } catch (e) { sseClients.delete(res); } }
}, 25000);

/* ------------------------------------------------------------- helpers --- */

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limitMb = 12) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitMb * 1024 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function sanitizeTrophy(t) {
  const s = {};
  const str = k => { s[k] = String(t[k] == null ? '' : t[k]).slice(0, 4000); };
  ['title_ar', 'title_en', 'game_ar', 'game_en', 'location_ar', 'location_en',
   'desc_ar', 'desc_en', 'image', 'color'].forEach(str);
  s.year = parseInt(t.year, 10) || new Date().getFullYear();
  s.device = Math.min(4, Math.max(1, parseInt(t.device, 10) || 1));
  s.ledStart = Math.max(0, parseInt(t.ledStart, 10) || 0);
  s.ledStop = Math.max(s.ledStart + 1, parseInt(t.ledStop, 10) || s.ledStart + 1);
  if (!/^#[0-9a-fA-F]{6}$/.test(s.color)) s.color = '#ff9500';
  s.photos = Array.isArray(t.photos) ? t.photos.slice(0, 24).map(p => String(p).slice(0, 500)) : [];
  return s;
}

function sanitizeSettings(v) {
  const cur = mergedSettings();
  const s = {
    masterOn: v.masterOn == null ? cur.masterOn : !!v.masterOn,
    idleColor: /^#[0-9a-fA-F]{6}$/.test(v.idleColor || '') ? v.idleColor : cur.idleColor,
    devices: [],
  };
  const inDev = Array.isArray(v.devices) ? v.devices : (cur.devices || []);
  for (let i = 0; i < 4; i++) {
    const d = inDev[i] || {};
    s.devices.push({
      ip: String(d.ip || '').slice(0, 64).replace(/[^0-9a-zA-Z.\-:]/g, ''),
      ledCount: Math.min(4096, Math.max(1, parseInt(d.ledCount, 10) || 300)),
    });
  }
  return s;
}

/* ------------------------------------------------------------- routing --- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    /* ---- API ---- */
    if (p === '/api/state' && req.method === 'GET') return send(res, 200, publicState());

    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ version: db.version })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (p === '/api/login' && req.method === 'POST') {
      const body = await readBody(req, 1);
      if (sha256(body.pin || '') === db.pinHash) return send(res, 200, { token: newToken() });
      return send(res, 401, { error: 'wrong pin' });
    }

    if (p.startsWith('/api/') && !['/api/state', '/api/events', '/api/login'].includes(p)) {
      if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
    }

    if (p === '/api/trophy' && req.method === 'POST') {
      const body = await readBody(req);
      const t = sanitizeTrophy(body);
      const id = String(body.id || '');
      const isBuiltin = base.trophies.some(b => b.id === id);
      if (isBuiltin) {
        db.overrides[id] = t;
        db.deleted = db.deleted.filter(d => d !== id);
      } else if (id && db.custom.some(c => c.id === id)) {
        const i = db.custom.findIndex(c => c.id === id);
        db.custom[i] = Object.assign({ id }, t);
      } else {
        t.id = 'c_' + crypto.randomBytes(6).toString('hex');
        db.custom.push(t);
      }
      saveDb();
      return send(res, 200, { ok: true, id: t.id || id });
    }

    if (p.startsWith('/api/trophy/') && req.method === 'DELETE') {
      const id = decodeURIComponent(p.split('/')[3] || '');
      if (base.trophies.some(b => b.id === id)) {
        if (!db.deleted.includes(id)) db.deleted.push(id);
        delete db.overrides[id];
      } else {
        db.custom = db.custom.filter(c => c.id !== id);
      }
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p.startsWith('/api/trophy/') && p.endsWith('/restore') && req.method === 'POST') {
      const id = decodeURIComponent(p.split('/')[3] || '');
      delete db.overrides[id];
      db.deleted = db.deleted.filter(d => d !== id);
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/settings' && req.method === 'POST') {
      db.settings = sanitizeSettings(await readBody(req, 1));
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/pin' && req.method === 'POST') {
      const body = await readBody(req, 1);
      if (sha256(body.oldPin || '') !== db.pinHash) return send(res, 403, { error: 'wrong pin' });
      const np = String(body.newPin || '');
      if (!/^\d{4,8}$/.test(np)) return send(res, 400, { error: 'pin must be 4-8 digits' });
      db.pinHash = sha256(np);
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p === '/api/upload' && req.method === 'POST') {
      const body = await readBody(req, 12);
      const m = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,(.+)$/.exec(body.data || '');
      if (!m) return send(res, 400, { error: 'expected base64 image data URL' });
      const ext = { png: '.png', jpg: '.jpg', jpeg: '.jpg', gif: '.gif', webp: '.webp', 'svg+xml': '.svg' }[m[1]];
      const name = 'u_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + ext;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
      return send(res, 200, { ok: true, path: 'uploads/' + name });
    }

    if (p === '/api/export' && req.method === 'GET') {
      const cfg = { trophies: mergedTrophies().map(t => { const c = Object.assign({}, t); delete c.builtin; delete c.edited; return c; }), settings: mergedSettings() };
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="base-config.json"',
      });
      return res.end(JSON.stringify(cfg, null, 2));
    }

    if (p === '/api/apply-base' && req.method === 'POST') {
      // Bake all runtime changes into base-config.json and clear the delta.
      const cfg = { trophies: mergedTrophies().map(t => { const c = Object.assign({}, t); delete c.builtin; delete c.edited; return c; }), settings: mergedSettings() };
      fs.writeFileSync(BASE_FILE + '.bak', JSON.stringify(base, null, 2));
      fs.writeFileSync(BASE_FILE, JSON.stringify(cfg, null, 2));
      base = cfg;
      db.overrides = {}; db.deleted = []; db.custom = []; db.settings = null;
      saveDb();
      return send(res, 200, { ok: true });
    }

    if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    /* ---- static ---- */
    let file = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('not found');
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': p.startsWith('/uploads/') || p.startsWith('/img/') ? 'max-age=86400' : 'no-cache',
        'Content-Length': st.size,
      });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const list of Object.values(nets)) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal) addrs.push(n.address);
  }
  console.log('Trophy Room Kiosk running (offline LAN mode)');
  console.log('  Local:   http://localhost:' + PORT);
  for (const a of addrs) console.log('  Network: http://' + a + ':' + PORT + '   <- open this on the TV / phones');
  console.log('  Default admin PIN: 1234');
});
