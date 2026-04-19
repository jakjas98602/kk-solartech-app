const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname)));

const userSchema = new mongoose.Schema({
  meno: String,
  email: String,
  heslo: String,
  rola: String
}, { timestamps: true });

const locationSchema = new mongoose.Schema({
  nazov: String,
  typ: String,
  adresa: String,
  veduci_meno: String
}, { timestamps: true });

const toolSchema = new mongoose.Schema({
  nazov: String,
  interné_cislo: String,
  kategoria: String,
  fotka_sitku: String,
  aktualna_lokacia_id: String,
  aktualna_lokacia: String,
  stav: String,
  qr_kod: String,
  historie: [{ typ: String, datum: String, popis: String }],
  poznamky: [{ datum: String, text: String, autor: String }],
  udrzba: [{ datum: String, text: String, autor: String }]
}, { timestamps: true });

const moveSchema = new mongoose.Schema({
  naradie_id: String,
  z_lokacie: String,
  do_lokacie: String,
  datum_cas: String,
  kto_spravil: String,
  stav_presunu: String
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
      rola: 'admin'
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

app.post('/api/users', async (req, res) => {
  const doc = await User.create(req.body);
  res.json(doc);
});

app.post('/api/locations', async (req, res) => {
  const doc = await Location.create(req.body);
  res.json(doc);
});

app.post('/api/tools', async (req, res) => {
  const doc = await Tool.create(req.body);
  res.json(doc);
});

app.put('/api/tools/:id', async (req, res) => {
  const doc = await Tool.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(doc);
});

app.post('/api/moves', async (req, res) => {
  const doc = await Move.create(req.body);
  res.json(doc);
});

app.post('/api/scans', async (req, res) => {
  const doc = await Scan.create(req.body);
  res.json(doc);
});

app.get('/api/seed', async (req, res) => {
  await seedIfEmpty();
  res.json({ ok: true });
});

async function start() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  await mongoose.connect(MONGODB_URI);
  await seedIfEmpty();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});