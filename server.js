const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function defaultDB() {
  return {
    users: [
      { _id: 'u1', meno: 'admin', email: 'admin@kk.sk', heslo: 'admin', rola: 'admin', stavba_id: '' }
    ],
    locations: [],
    tools: [],
    moves: [],
    scans: []
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const init = defaultDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    const init = defaultDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

app.get('/api/all', (req, res) => {
  const db = loadDB();
  res.json(db);
});

app.get('/api/users', (req, res) => {
  const db = loadDB();
  res.json(db.users);
});

app.post('/api/users', (req, res) => {
  const db = loadDB();
  const { meno, email, heslo, rola, stavba_id = '' } = req.body || {};
  if (!meno || !heslo || !rola) return res.status(400).json({ error: 'Chýbajú povinné polia.' });

  const user = {
    _id: newId('u'),
    meno,
    email: email || '',
    heslo,
    rola,
    stavba_id
  };

  db.users.push(user);
  saveDB(db);
  res.json(user);
});

app.put('/api/users/:id', (req, res) => {
  const db = loadDB();
  const idx = db.users.findIndex(u => String(u._id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Používateľ sa nenašiel.' });

  db.users[idx] = { ...db.users[idx], ...req.body, _id: db.users[idx]._id };
  saveDB(db);
  res.json(db.users[idx]);
});

app.delete('/api/users/:id', (req, res) => {
  const db = loadDB();
  const before = db.users.length;
  db.users = db.users.filter(u => String(u._id) !== String(req.params.id));
  if (db.users.length === before) return res.status(404).json({ error: 'Používateľ sa nenašiel.' });
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/locations', (req, res) => {
  const db = loadDB();
  res.json(db.locations);
});

app.post('/api/locations', (req, res) => {
  const db = loadDB();
  const { nazov, typ, adresa = '', veduci_id = '', veduci_meno = '' } = req.body || {};
  if (!nazov || !typ) return res.status(400).json({ error: 'Chýbajú povinné polia.' });

  const location = {
    _id: newId('l'),
    nazov,
    typ,
    adresa,
    veduci_id,
    veduci_meno
  };

  db.locations.push(location);
  saveDB(db);
  res.json(location);
});

app.put('/api/locations/:id', (req, res) => {
  const db = loadDB();
  const idx = db.locations.findIndex(l => String(l._id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Lokácia sa nenašla.' });

  db.locations[idx] = { ...db.locations[idx], ...req.body, _id: db.locations[idx]._id };
  saveDB(db);
  res.json(db.locations[idx]);
});

app.delete('/api/locations/:id', (req, res) => {
  const db = loadDB();
  const before = db.locations.length;
  db.locations = db.locations.filter(l => String(l._id) !== String(req.params.id));
  if (db.locations.length === before) return res.status(404).json({ error: 'Lokácia sa nenašla.' });
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/tools', (req, res) => {
  const db = loadDB();
  res.json(db.tools);
});

app.post('/api/tools', (req, res) => {
  const db = loadDB();
  const tool = {
    _id: newId('t'),
    nazov: req.body?.nazov || '',
    interne_cislo: req.body?.interne_cislo || '',
    kategoria: req.body?.kategoria || '',
    fotka_sitku: req.body?.fotka_sitku || '',
    aktualna_lokacia_id: req.body?.aktualna_lokacia_id || '',
    aktualna_lokacia: req.body?.aktualna_lokacia || '',
    stav: req.body?.stav || 'dostupne',
    qr_kod: req.body?.qr_kod || `QR-${Date.now()}`,
    vlastnik_meno: req.body?.vlastnik_meno || '',
    historie: Array.isArray(req.body?.historie) ? req.body.historie : [],
    poznamky: Array.isArray(req.body?.poznamky) ? req.body.poznamky : [],
    udrzba: Array.isArray(req.body?.udrzba) ? req.body.udrzba : []
  };

  db.tools.push(tool);
  saveDB(db);
  res.json(tool);
});

app.put('/api/tools/:id', (req, res) => {
  const db = loadDB();
  const idx = db.tools.findIndex(t => String(t._id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Náradie sa nenašlo.' });

  db.tools[idx] = { ...db.tools[idx], ...req.body, _id: db.tools[idx]._id };
  saveDB(db);
  res.json(db.tools[idx]);
});

app.delete('/api/tools/:id', (req, res) => {
  const db = loadDB();
  const before = db.tools.length;
  db.tools = db.tools.filter(t => String(t._id) !== String(req.params.id));
  if (db.tools.length === before) return res.status(404).json({ error: 'Náradie sa nenašlo.' });
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/moves', (req, res) => {
  const db = loadDB();
  res.json(db.moves);
});

app.post('/api/moves', (req, res) => {
  const db = loadDB();
  const move = {
    _id: newId('m'),
    naradie_id: req.body?.naradie_id || '',
    nazov_naradia: req.body?.nazov_naradia || '',
    qr_kod: req.body?.qr_kod || '',
    z_lokacie: req.body?.z_lokacie || '',
    do_lokacie: req.body?.do_lokacie || '',
    datum_cas: req.body?.datum_cas || new Date().toLocaleString('sk-SK'),
    kto_spravil: req.body?.kto_spravil || '',
    stav_presunu: req.body?.stav_presunu || 'dorucene',
    typ: req.body?.typ || 'presun',
    poznamka: req.body?.poznamka || ''
  };

  db.moves.push(move);
  saveDB(db);
  res.json(move);
});

app.get('/api/scans', (req, res) => {
  const db = loadDB();
  res.json(db.scans);
});

app.post('/api/scans', (req, res) => {
  const db = loadDB();
  const scan = {
    _id: newId('s'),
    uzivatel: req.body?.uzivatel || '',
    lokacia_id: req.body?.lokacia_id || '',
    lokacia_nazov: req.body?.lokacia_nazov || '',
    typ: req.body?.typ || '',
    data: Array.isArray(req.body?.data) ? req.body.data : [],
    datum_cas: req.body?.datum_cas || new Date().toLocaleString('sk-SK')
  };

  db.scans.push(scan);
  saveDB(db);
  res.json(scan);
});

app.delete('/api/scans/:id', (req, res) => {
  const db = loadDB();
  const before = db.scans.length;
  db.scans = db.scans.filter(s => String(s._id) !== String(req.params.id));
  if (db.scans.length === before) return res.status(404).json({ error: 'Sken sa nenašiel.' });
  saveDB(db);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server beží na http://localhost:${PORT}`);
});