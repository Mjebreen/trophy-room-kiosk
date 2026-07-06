#!/usr/bin/env node
/*
 * One-off importer: reads trophies.csv and regenerates base-config.json.
 * Keeps the existing settings block. Re-run any time the CSV changes:
 *   node import-trophies.js "C:\Users\mj\Downloads\tgs\trophies.csv"
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CSV = process.argv[2] || 'C:\\Users\\mj\\Downloads\\tgs\\trophies.csv';
const ROOT = __dirname;
const IMG_TROPHIES = 'img/trophies';
const IMG_TOURN = 'img/tournaments';

/* minimal RFC-4180 CSV parser (quotes, "" escapes, newlines in fields) */
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* per-game LED colors so each game family glows consistently on the shelf */
const GAME_COLORS = {
  'overwatch': '#f99e1a', 'valorant': '#ff4655', 'pubg: battlegrounds': '#f2a900',
  'pubg mobile': '#00c3ff', 'warzone': '#34c759', 'call of duty: mobile': '#30d158',
  'fc 24': '#00e5a0', 'mobile legends': '#af52de', 'tekken': '#ff375f',
  'street fighter': '#5e5ce6', 'guilty gear': '#ff6482', 'rocket league': '#0a84ff',
  'fortnite': '#bf5af2', 'cross-game': '#ffd60a', 'of all time': '#ffd700',
};
function colorFor(game) {
  const g = (game || '').toLowerCase();
  for (const k in GAME_COLORS) if (g.includes(k)) return GAME_COLORS[k];
  return '#ffb03a';
}

function webpName(ref) { return path.parse(String(ref).trim()).name.toLowerCase() + '.webp'; }
function exists(rel) { return fs.existsSync(path.join(ROOT, 'public', rel)); }

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const header = rows.shift().map(h => h.trim());
const col = n => header.indexOf(n);
const warnings = [];

const trophies = rows.map((r, idx) => {
  const name = r[col('name')].trim();
  const game = r[col('game')].trim() || 'CROSS-GAME'; // one CSV row has it blank
  // main image: trophy render, already delivered as webp
  let image = IMG_TROPHIES + '/' + path.parse(r[col('photo')].trim()).name + '.webp';
  if (!exists(image)) { warnings.push('missing trophy image: ' + image + '  (' + name + ')'); image = 'img/trophy-1.svg'; }
  // extra photos: tournament shots (converted to lowercase .webp)
  const photos = [image];
  for (const t of r[col('tournament_images')].split(',')) {
    if (!t.trim()) continue;
    const p = IMG_TOURN + '/' + webpName(t);
    if (exists(p)) photos.push(p);
    else warnings.push('missing tournament image: ' + p + '  (' + name + ')');
  }
  return {
    id: 't' + (idx + 1),
    title_ar: name, title_en: name,
    game_ar: game, game_en: game,
    year: parseInt(r[col('year')], 10) || 0,
    location_ar: '', location_en: '',
    desc_ar: r[col('description_ar')].trim(),
    desc_en: r[col('description_en')].trim(),
    image: image, photos: photos,
    device: 1, ledStart: 0, ledStop: 1, // filled below
    color: colorFor(game),
  };
});

/* spread trophies over the 4 strips: equal LED slices per strip */
const oldBase = JSON.parse(fs.readFileSync(path.join(ROOT, 'base-config.json'), 'utf8'));
const settings = oldBase.settings;
const perDev = Math.ceil(trophies.length / 4);
trophies.forEach((t, i) => {
  const dev = Math.min(4, Math.floor(i / perDev) + 1);
  const slot = i % perDev;
  const count = (settings.devices[dev - 1] && settings.devices[dev - 1].ledCount) || 300;
  const slice = Math.floor(count / perDev);
  t.device = dev;
  t.ledStart = slot * slice;
  t.ledStop = (slot + 1) * slice;
});

fs.writeFileSync(path.join(ROOT, 'base-config.json'),
  JSON.stringify({ trophies, settings }, null, 2));
console.log('wrote base-config.json with', trophies.length, 'trophies');
for (const w of warnings) console.log('WARN:', w);
