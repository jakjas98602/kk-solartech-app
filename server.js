const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));

const userSchema = new mongoose.Schema({
  meno: String,
  email: String,
  heslo: String,
  rola: String,
  stavba_id: String
}, { timestamps: true });

const locationSchema = new mongoose.Schema({
  nazov: String,
  typ: String,
  adresa: String,
  veduci_id: String,
  veduci_meno: String
}, { timestamps: true });

const toolSchema = new mongoose.Schema({
  nazov: String,
  interne_cislo: String,
  kategoria: String,
  fotka_sitku: String,
  aktualna_lokacia_id: String,
  aktualna_lokacia: String,
  stav: String,
  qr_kod: String,
  vlastnik_meno: String,
  historie: [{ typ: String, datum: String, popis: String }],
  poznamky: [{ datum: String, text: String, autor: String, typ: String }],
  udrzba: [{ datum: String, text: String, autor: String }]
}, { timestamps: true });

const moveSchema = new mongoose.Schema({
  naradie_id: String,
  nazov_naradia: String,
  qr_kod: String,
  z_lokacie: String,
  do_lokacie: String,
  datum_cas: String,
  kto_spravil: String,
  stav_presunu: String,
  typ: String,
  poznamka: String
}, { timestamps: true });

const scanSchema = new mongoose.Schema({
  uzivatel: String,
  lokacia_id: String,
  lokacia_nazov: String,
  typ: String,
  data: Array,
  datum_cas: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Location = mongoose.model('Location', locationSchema);
const Tool = mongoose.model('Tool', toolSchema);
const Move = mongoose.model('Move', moveSchema);
const Scan = mongoose.model('Scan', scanSchema);

async function seedIfEmpty() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      meno: 'admin',
      email: 'admin@kk-solartech.sk',
      heslo: 'admin123',
      rola: 'admin',
      stavba_id: ''
    });
  }
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/all', async (req, res) => {
  const [users, locations, tools, moves, scans] = await Promise.all([
    User.find().lean(),
    Location.find().lean(),
    Tool.find().lean(),
    Move.find().lean(),
    Scan.find().lean()
  ]);
  res.json({ users, locations, tools, moves, scans });
});

app.get('/api/users', async (req, res) => {
  res.json(await User.find().lean());
});

app.get('/api/users/:id', async (req, res) => {
  const item = await User.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: 'User not found' });
  res.json(item);
});

app.post('/api/users', async (req, res) => {
  const created = await User.create(req.body);
  res.json(created);
});

app.put('/api/users/:id', async (req, res) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

app.delete('/api/users/:id', async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

app.get('/api/locations', async (req, res) => {
  res.json(await Location.find().lean());
});

app.get('/api/locations/:id', async (req, res) => {
  const loc = await Location.findById(req.params.id).lean();
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const [tools, users] = await Promise.all([
    Tool.find({ aktualna_lokacia_id: String(loc._id) }).lean(),
    User.find().lean()
  ]);

  const veduci = users.find(u => String(u._id) === String(loc.veduci_id));

  res.json({
    ...loc,
    veduci: veduci || null,
    tools
  });
});

app.post('/api/locations', async (req, res) => {
  const created = await Location.create(req.body);
  res.json(created);
});

app.put('/api/locations/:id', async (req, res) => {
  const updated = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ error: 'Location not found' });
  res.json(updated);
});

app.delete('/api/locations/:id', async (req, res) => {
  const deleted = await Location.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Location not found' });
  res.json({ ok: true });
});

app.get('/api/tools', async (req, res) => {
  res.json(await Tool.find().lean());
});

app.get('/api/tools/:id', async (req, res) => {
  const item = await Tool.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: 'Tool not found' });
  res.json(item);
});

app.post('/api/tools', async (req, res) => {
  const created = await Tool.create(req.body);
  res.json(created);
});

app.put('/api/tools/:id', async (req, res) => {
  const updated = await Tool.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ error: 'Tool not found' });
  res.json(updated);
});

app.delete('/api/tools/:id', async (req, res) => {
  const deleted = await Tool.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Tool not found' });
  res.json({ ok: true });
});

app.get('/api/moves', async (req, res) => {
  const { qr, lokacia, typ, user, od, do: doDatum } = req.query;
  const query = {};

  if (qr) query.qr_kod = new RegExp(String(qr), 'i');
  if (typ) query.typ = String(typ);
  if (user) query.kto_spravil = new RegExp(String(user), 'i');
  if (lokacia) {
    query.$or = [
      { z_lokacie: new RegExp(String(lokacia), 'i') },
      { do_lokacie: new RegExp(String(lokacia), 'i') }
    ];
  }

  let items = await Move.find(query).lean();

  if (od) {
    items = items.filter(i => String(i.datum_cas || '').localeCompare(String(od)) >= 0);
  }
  if (doDatum) {
    items = items.filter(i => String(i.datum_cas || '').localeCompare(String(doDatum)) <= 0);
  }

  res.json(items);
});

app.post('/api/moves', async (req, res) => {
  const created = await Move.create(req.body);
  res.json(created);
});

app.get('/api/scans', async (req, res) => {
  const { typ, user, lokacia } = req.query;
  const query = {};

  if (typ) query.typ = String(typ);
  if (user) query.uzivatel = new RegExp(String(user), 'i');
  if (lokacia) query.lokacia_nazov = new RegExp(String(lokacia), 'i');

  res.json(await Scan.find(query).lean());
});

app.post('/api/scans', async (req, res) => {
  const created = await Scan.create(req.body);
  res.json(created);
});

app.get('/api/dashboard', async (req, res) => {
  const [users, locations, tools, moves, scans] = await Promise.all([
    User.find().lean(),
    Location.find().lean(),
    Tool.find().lean(),
    Move.find().lean(),
    Scan.find().lean()
  ]);

  res.json({
    usersCount: users.length,
    locationsCount: locations.length,
    toolsCount: tools.length,
    movesCount: moves.length,
    scansCount: scans.length
  });
});

async function start() {
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
  await mongoose.connect(MONGODB_URI);
  await seedIfEmpty();
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});