from pathlib import Path
base=Path('output/kk_solartech_updated')
base.mkdir(parents=True, exist_ok=True)

server_js='''const path = require('path');
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
  interne_cislo: String,
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
    await User.create({ meno: 'admin', email: 'admin@kk-solartech.sk', heslo: 'admin123', rola: 'admin' });
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

app.post('/api/users', async (req, res) => res.json(await User.create(req.body)));
app.post('/api/locations', async (req, res) => res.json(await Location.create(req.body)));
app.post('/api/tools', async (req, res) => res.json(await Tool.create(req.body)));
app.put('/api/tools/:id', async (req, res) => res.json(await Tool.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.post('/api/moves', async (req, res) => res.json(await Move.create(req.body)));
app.post('/api/scans', async (req, res) => res.json(await Scan.create(req.body)));

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
'''

index_html='''<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KK Solartech – Sklad a QR evidencia</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
  <script src="https://unpkg.com/html5-qrcode"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>
<body>
  <div id="login-screen" class="login-screen">
    <div class="login-card">
      <div class="brand-inline">
        <div class="brand-mark"><span class="brand-sun"></span><span class="brand-grid"></span></div>
        <div>
          <div class="brand-name">KK <span>SOLARTECH</span></div>
          <div class="brand-sub">Skladová a QR evidencia</div>
        </div>
      </div>
      <h1>Prihlásenie</h1>
      <p class="muted">Prístup do interného systému KK Solartech.</p>
      <label>Meno</label>
      <input id="login-meno" type="text" placeholder="Zadaj meno">
      <label>Heslo</label>
      <input id="login-heslo" type="password" placeholder="Zadaj heslo">
      <button class="primary-btn" onclick="prihlasSa()">Prihlásiť sa</button>
      <div class="hint">Predvolený admin: admin / admin123</div>
    </div>
  </div>

  <div id="main-app" class="app-shell" style="display:none;">
    <header class="topbar">
      <div class="topbar-contact"><span>+421 910 940 710</span><span>info@kk-solartech.sk</span></div>
      <div class="topbar-right"><span id="meno-uzivatela"></span><button class="ghost-btn" onclick="odhlasSa()">Odhlásiť</button></div>
    </header>

    <nav class="navbar">
      <div class="brand-inline large">
        <div class="brand-mark"><span class="brand-sun"></span><span class="brand-grid"></span></div>
        <div><div class="brand-name">KK <span>SOLARTECH</span></div><div class="brand-sub">Interná aplikácia</div></div>
      </div>
      <div class="nav-links">
        <a href="#dashboard">Úvod</a><a href="#lokacie-section">Lokácie</a><a href="#naradie-section">Náradie</a><a href="#skeny-section">Skeny</a><a href="#report-section">Reporty</a>
      </div>
    </nav>

    <section class="hero"><div class="hero-overlay"></div><div class="hero-content"><h2>Prehľadná evidencia náradia, lokácií a QR skenov</h2><p>Ranný, nočný a presunový režim s históriou, údržbou, poznámkami a exportom.</p></div></section>

    <main class="content" id="dashboard">
      <section class="stats-grid">
        <div class="stat-card"><span>Lokácie</span><strong id="stat-lokacie">0</strong></div>
        <div class="stat-card"><span>Náradie</span><strong id="stat-naradie">0</strong></div>
        <div class="stat-card"><span>Presuny</span><strong id="stat-presuny">0</strong></div>
        <div class="stat-card"><span>Skeny</span><strong id="stat-skeny">0</strong></div>
      </section>

      <section class="panel" id="admin-panel">
        <div class="section-head"><h3>Administrácia</h3><p>Správa používateľov, lokácií a náradia.</p></div>
        <div class="grid-3">
          <div class="card">
            <h4>Pridať používateľa</h4>
            <input id="nove-meno" placeholder="Meno"><input id="novy-email" placeholder="Email"><input id="nove-heslo" type="password" placeholder="Heslo">
            <select id="nova-rola"><option value="admin">Admin</option><option value="veduci_stavby">Vedúci stavby</option><option value="skladnik">Skladník</option><option value="pracovnik">Pracovník</option></select>
            <button class="primary-btn" onclick="pridajPouzivatela()">Pridať používateľa</button>
            <div id="zoznam-pouzitvatelov" class="list-box"></div>
          </div>
          <div class="card">
            <h4>Pridať lokáciu</h4>
            <input id="lokacia-nazov" placeholder="Názov lokácie"><select id="lokacia-typ"><option value="stavba">Stavba</option><option value="sklad">Sklad</option><option value="servis">Servis</option></select>
            <input id="lokacia-adresa" placeholder="Adresa"><input id="lokacia-veduci" placeholder="Vedúci stavby">
            <button class="primary-btn" onclick="pridajLokaciu()">Pridať lokáciu</button>
            <div id="zoznam-lokacii" class="list-box"></div>
          </div>
          <div class="card">
            <h4>Pridať náradie</h4>
            <input id="naradie-nazov" placeholder="Názov náradia"><input id="naradie-cislo" placeholder="Interné číslo"><input id="naradie-kategoria" placeholder="Kategória">
            <select id="aktualna-lokacia"></select><input id="fotka-sitku" type="file" accept="image/*">
            <button class="primary-btn" onclick="pridajNaradie()">Pridať náradie</button>
            <div id="qr-container" class="qr-box"></div>
          </div>
        </div>
      </section>

      <section class="panel" id="veduci-panel">
        <div class="section-head"><h3>Vedúci stavby</h3><p>Ranný a nočný režim plus presun náradia.</p></div>
        <div class="grid-3">
          <div class="card">
            <h4>Ranný sken</h4>
            <select id="ranna-lokacia"></select>
            <div class="row"><button class="primary-btn" onclick="otvorRannySken()">Spustiť kameru</button><button class="ghost-btn" onclick="zrusRannySken()">Zavrieť</button></div>
            <div id="scanner-ranny" class="scanner-box" style="display:none;"></div>
            <div id="ranny-scanner-status" class="muted"></div>
            <div id="ranny-zoznam" class="list-box"></div>
            <button class="primary-btn" onclick="ulozRannySken()">✓ Uložiť ranný sken</button>
          </div>
          <div class="card">
            <h4>Nočný sken</h4>
            <select id="vecerna-lokacia"></select>
            <div class="row"><button class="primary-btn" onclick="otvorVecernySken()">Spustiť kameru</button><button class="ghost-btn" onclick="zrusVecernySken()">Zavrieť</button></div>
            <div id="scanner-vecerny" class="scanner-box" style="display:none;"></div>
            <div id="vecerny-scanner-status" class="muted"></div>
            <div id="vecerny-zoznam" class="list-box"></div>
            <button class="primary-btn" onclick="porovnajVecernySken()">✓ Uložiť nočný sken</button>
          </div>
          <div class="card">
            <h4>Presun náradia</h4>
            <select id="ciel-lokacia"></select>
            <div class="row"><button class="primary-btn" onclick="spustiPresunSken()">Skenovať QR</button><button class="ghost-btn" onclick="zrusPresunSken()">Zastaviť</button></div>
            <div id="scanner-presun" class="scanner-box" style="display:none;"></div>
            <div id="presun-scanner-status" class="muted"></div>
            <div id="info-presun" class="info-box"></div>
            <button id="potvrdi-presun" class="primary-btn" disabled onclick="potvrdiPresun()">✓ Potvrdiť presun</button>
            <select id="veduci-aktualna-lokacia" onchange="ulozAktualnuLokaciuVeduceho()"></select>
          </div>
        </div>
      </section>

      <section class="panel" id="lokacie-section">
        <div class="section-head"><h3>Lokácie</h3><p>Všetky stavby a sklady v systéme.</p></div>
        <div id="zoznam-lokacii" class="cards-grid"></div>
      </section>

      <section class="panel" id="naradie-section">
        <div class="section-head"><h3>Náradie</h3><p>Vyhľadávanie podľa názvu, QR a skenovanie QR kódu.</p></div>
        <div class="filters"><input id="filter-hladaj" placeholder="Hľadať náradie" oninput="renderAll()"><input id="filter-qr" placeholder="QR text / sken" oninput="renderAll()"><button class="ghost-btn" onclick="spustiVyhladavaciSken()">Skenovať QR</button><select id="filter-status" onchange="renderAll()"><option value="">Všetky statusy</option><option value="dostupne">Dostupné</option><option value="na_stavbe">Na stavbe</option><option value="oprava">Oprava</option><option value="stratene">Stratené</option><option value="presunute">Presunuté</option></select><select id="filter-lokacia" onchange="renderAll()"></select></div>
        <div id="scanner-vyhladavanie" class="scanner-box" style="display:none;"></div>
        <div id="vyhladavanie-status" class="muted"></div>
        <div id="zoznam-naradia" class="cards-grid"></div>
      </section>

      <section class="panel" id="skeny-section">
        <div class="section-head"><h3>Presuny a história</h3><p>Posledné pohyby a evidované skeny.</p></div>
        <div id="zoznam-presunov" class="list-box"></div>
      </section>

      <section class="panel" id="report-section">
        <div class="section-head"><h3>Reporty</h3><p>Export CSV, PDF a denný prehľad.</p></div>
        <div class="row"><button class="primary-btn" onclick="exportujCSV()">Export CSV</button><button class="ghost-btn" onclick="exportujDennyReport()">Pripraviť denný report</button><button class="ghost-btn" onclick="exportVsetkyNaradiaPdf()">PDF všetko podľa vedúcich</button></div>
        <div id="report-info" class="info-box"></div>
      </section>
    </main>
  </div>

  <div id="detail-modal" class="modal" style="display:none;"><div class="modal-box"><div class="modal-head"><h3>Detail náradia</h3><button class="ghost-btn" onclick="zatvorModal('detail-modal')">X</button></div><div id="detail-content"></div></div></div>
  <div id="edit-modal" class="modal" style="display:none;"><div class="modal-box"><div class="modal-head"><h3>Upraviť náradie</h3><button class="ghost-btn" onclick="zatvorModal('edit-modal')">X</button></div><div id="edit-content"></div></div></div>

  <script src="app.js"></script>
</body>
</html>
'''

style_css='''*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f4f7fb;color:#18304b}a{text-decoration:none;color:inherit}.muted{color:#667}.small-muted{font-size:12px;color:#667}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#0d2b45,#1f5f8b)}.login-card,.panel,.card,.stat-card,.modal-box,.info-box,.list-box{background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(11,33,61,.08)}.login-card{width:min(420px,100%);padding:28px}.brand-inline{display:flex;gap:12px;align-items:center}.brand-inline.large{transform:scale(1.05);transform-origin:left center}.brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#0d2b45,#1f5f8b);position:relative;overflow:hidden}.brand-sun{position:absolute;width:16px;height:16px;border-radius:50%;background:#ffd34d;top:8px;left:8px}.brand-grid{position:absolute;inset:auto 6px 6px 6px;height:18px;border:2px solid rgba(255,255,255,.85);border-top:none;border-radius:0 0 10px 10px}.brand-name{font-weight:900;letter-spacing:.5px}.brand-name span{color:#1f5f8b}.brand-sub{font-size:12px;color:#667}.topbar,.navbar{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:#fff}.topbar{border-bottom:1px solid #e8eef5}.topbar-contact,.topbar-right,.nav-links{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.navbar{box-shadow:0 6px 20px rgba(11,33,61,.05)}.hero{position:relative;min-height:220px;background:linear-gradient(135deg,#0d2b45,#1f5f8b);overflow:hidden}.hero-overlay{position:absolute;inset:0;background:url('') center/cover no-repeat;opacity:.08}.hero-content{position:relative;z-index:1;color:#fff;padding:40px 24px;max-width:900px}.hero h2{margin:0 0 10px;font-size:32px}.content{padding:24px;display:grid;gap:20px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.stat-card{padding:18px}.stat-card span{display:block;color:#667;margin-bottom:6px}.stat-card strong{font-size:30px}.panel{padding:18px}.section-head h3,.card h4{margin:0 0 6px}.section-head p{margin:0 0 12px;color:#667}.card{padding:16px}.card input,.card select,.login-card input,.login-card select,.filters input,.filters select,.edit-form select{width:100%;padding:12px 14px;border:1px solid #d7e1ec;border-radius:12px;margin:6px 0 10px;font:inherit;background:#fff}.primary-btn,.ghost-btn{border:none;border-radius:12px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer}.primary-btn{background:#1f5f8b;color:#fff}.ghost-btn{background:#eef4fa;color:#1f5f8b}.badge{display:inline-block;background:#e8f5ee;color:#20744b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}.list-box{padding:12px;display:grid;gap:10px;margin-top:12px}.pouzitvatel-item,.lokacia-item,.naradie-item,.history-item{padding:12px;border:1px solid #e8eef5;border-radius:14px;background:#fbfdff}.qr-box,.scanner-box,.info-box{padding:12px;margin-top:12px}.scanner-box{min-height:240px}.modal{position:fixed;inset:0;background:rgba(8,20,34,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:999}.modal-box{width:min(720px,100%);padding:18px}.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.detail-box{display:grid;gap:8px}.filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}img{max-width:100%;border-radius:12px;margin-top:10px}@media (max-width:1000px){.grid-3,.stats-grid,.filters{grid-template-columns:1fr}.topbar,.navbar,.row{flex-direction:column;align-items:flex-start}}'''

app_js='''let actualUser = null;
let data = { users: [], locations: [], tools: [], moves: [], scans: [] };
let qrScanner = null;
let qrMode = null;
let vybrateNaradieId = null;
let rannySkenList = [];
let vecernySkenList = [];
let uzNaskenovaneRano = new Set();
let uzNaskenovaneVecer = new Set();
let lastQrCanvas = null;
let lastQrText = '';

const byId = id => document.getElementById(id);

async function api(path, method = 'GET', body = null) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function prelozStatus(status) {
  return ({ dostupne: 'Dostupné', na_stavbe: 'Na stavbe', oprava: 'Oprava', stratene: 'Stratené', presunute: 'Presunuté' }[status] || status || 'Nezadané');
}

function showLogin() {
  byId('login-screen').style.display = 'flex';
  byId('main-app').style.display = 'none';
}

function showApp() {
  byId('login-screen').style.display = 'none';
  byId('main-app').style.display = 'block';
  if (actualUser) byId('meno-uzivatela').textContent = `${actualUser.meno} (${actualUser.rola})`;
}

function saveSession() {
  if (actualUser) localStorage.setItem('kk_user', JSON.stringify({ meno: actualUser.meno, rola: actualUser.rola }));
  else localStorage.removeItem('kk_user');
}

async function loadBootstrap() {
  data = await api('/api/all');
  const saved = JSON.parse(localStorage.getItem('kk_user') || 'null');
  actualUser = saved ? data.users.find(u => u.meno === saved.meno && u.rola === saved.rola) || null : null;
  renderAll();
}

async function prihlasSa() {
  const meno = byId('login-meno').value.trim();
  const heslo = byId('login-heslo').value;
  const u = data.users.find(x => x.meno === meno && x.heslo === heslo);
  if (!u) return alert('Nesprávne meno alebo heslo');
  actualUser = u;
  saveSession();
  showApp();
  renderAll();
}

function odhlasSa() {
  actualUser = null;
  saveSession();
  showLogin();
}

function renderStats() {
  byId('stat-lokacie').textContent = data.locations.length;
  byId('stat-naradie').textContent = data.tools.length;
  byId('stat-presuny').textContent = data.moves.length;
  byId('stat-skeny').textContent = data.scans.length;
}

function renderUsers() {
  const el = byId('zoznam-pouzitvatelov');
  if (!el) return;
  el.innerHTML = data.users.length ? data.users.map(u => `<div class="pouzitvatel-item"><strong>${u.meno}</strong> (${u.rola})<br>${u.email || ''}</div>`).join('') : '<p>Žiadni používatelia.</p>';
}

function renderLocations() {
  const el = byId('zoznam-lokacii');
  if (!el) return;
  el.innerHTML = data.locations.length ? data.locations.map(l => {
    const tools = data.tools.filter(t => String(t.aktualna_lokacia_id) === String(l._id));
    return `<div class="lokacia-item"><strong>${l.nazov}</strong> <span class="badge">${l.typ}</span><br>${l.adresa || ''}<div class="small-muted">Vedúci: ${l.veduci_meno || '-'}</div><div class="small-muted">Náradie: ${tools.length}</div><div class="row-actions"><button class="ghost-btn" onclick="otvorLokaciu('${l._id}')">Otvoriť</button></div></div>`;
  }).join('') : '<p>Žiadne lokácie.</p>';
}

function renderSelects() {
  const opts = data.locations.map(l => `<option value="${l._id}">${l.nazov}</option>`).join('');
  ['aktualna-lokacia', 'ciel-lokacia', 'ranna-lokacia', 'vecerna-lokacia', 'veduci-aktualna-lokacia', 'filter-lokacia'].forEach(id => {
    const el = byId(id); if (!el) return;
    if (id === 'filter-lokacia') el.innerHTML = `<option value="">Všetky lokácie</option>${opts}`;
    else if (id === 'veduci-aktualna-lokacia') el.innerHTML = `<option value="">Žiadna</option>${opts}`;
    else el.innerHTML = `<option value="">Vyber lokáciu</option>${opts}`;
  });
}

function renderTools() {
  const el = byId('zoznam-naradia');
  if (!el) return;
  const q = (byId('filter-hladaj')?.value || '').trim().toLowerCase();
  const qr = (byId('filter-qr')?.value || '').trim().toLowerCase();
  const st = byId('filter-status')?.value || '';
  const loc = byId('filter-lokacia')?.value || '';
  const list = data.tools.filter(n => {
    const hay = `${n.nazov} ${n.qr_kod} ${n.kategoria || ''} ${n.interne_cislo || ''}`.toLowerCase();
    return (!q || hay.includes(q)) && (!qr || String(n.qr_kod).toLowerCase().includes(qr)) && (!st || n.stav === st) && (!loc || String(n.aktualna_lokacia_id) === String(loc));
  });
  el.innerHTML = list.length ? list.map(n => `
    <div class="naradie-item">
      <strong>${n.nazov}</strong> <span class="badge">✓ ${prelozStatus(n.stav)}</span><br>
      QR: ${n.qr_kod}<br>
      Interné číslo: ${n.interne_cislo || '-'}<br>
      Kategória: ${n.kategoria || '-'}<br>
      <div class="lokacia-label">Nachádza sa: <strong>${n.aktualna_lokacia || '-'}</strong></div>
      <div class="row-actions">
        <button class="ghost-btn" onclick="otvorDetail('${n._id}')">Detail</button>
        <button class="ghost-btn" onclick="otvorUpravu('${n._id}')">Upraviť</button>
        <button class="ghost-btn" onclick="exportNaradiePdf('${n._id}')">PDF</button>
      </div>
      ${n.fotka_sitku ? `<img src="${n.fotka_sitku}" alt="Fotka štítku">` : ''}
    </div>
  `).join('') : '<p>Žiadne náradie nespĺňa filter.</p>';
}

function renderHistory() {
  const el = byId('zoznam-presunov');
  if (!el) return;
  el.innerHTML = data.moves.length ? data.moves.slice().reverse().map(p => `<div class="history-item"><strong>${p.datum_cas || ''}</strong><br>${p.kto_spravil || ''} presunul náradie z <strong>${p.z_lokacie || '-'}</strong> do <strong>${p.do_lokacie || '-'}</strong></div>`).join('') : '<p>Žiadna história presunov.</p>';
}

function renderAdmin() {
  if (byId('admin-panel')) byId('admin-panel').style.display = actualUser?.rola === 'admin' ? 'block' : 'none';
  if (byId('veduci-panel')) byId('veduci-panel').style.display = actualUser ? 'block' : 'none';
  if (actualUser?.rola === 'admin') renderUsers();
}

function renderAll() {
  if (!actualUser) {
    showLogin();
    return;
  }
  showApp();
  renderStats();
  renderUsers();
  renderLocations();
  renderSelects();
  renderTools();
  renderHistory();
  renderAdmin();
}

async function pridajPouzivatela() {
  if (actualUser?.rola !== 'admin') return alert('Nemáš oprávnenie.');
  const body = { meno: byId('nove-meno').value.trim(), email: byId('novy-email').value.trim(), heslo: byId('nove-heslo').value, rola: byId('nova-rola').value };
  if (!body.meno || !body.heslo) return alert('Zadaj meno a heslo.');
  await api('/api/users', 'POST', body);
  await loadBootstrap();
}

async function pridajLokaciu() {
  if (actualUser?.rola !== 'admin') return alert('Lokácie môže pridávať iba admin.');
  const body = { nazov: byId('lokacia-nazov').value.trim(), typ: byId('lokacia-typ').value, adresa: byId('lokacia-adresa').value.trim(), veduci_meno: byId('lokacia-veduci').value.trim() };
  if (!body.nazov) return alert('Zadaj názov lokácie.');
  await api('/api/locations', 'POST', body);
  await loadBootstrap();
}

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku').files[0];
  if (!file) return alert('Fotka štítku je povinná.');
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = { nazov: byId('naradie-nazov').value.trim(), interne_cislo: byId('naradie-cislo').value.trim(), kategoria: byId('naradie-kategoria').value.trim(), fotka_sitku: e.target.result, aktualna_lokacia_id: loc?._id || '', aktualna_lokacia: loc?.nazov || '', stav: 'dostupne', qr_kod: qr, historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }], poznamky: [], udrzba: [] };
    await api('/api/tools', 'POST', body);
    lastQrText = qr;
    const container = byId('qr-container');
    if (window.QRCode && container) {
      const c = document.createElement('canvas');
      await QRCode.toCanvas(c, qr, { width: 220, margin: 2 });
      lastQrCanvas = c;
      container.innerHTML = '';
      container.appendChild(c);
    }
    await loadBootstrap();
  };
  reader.readAsDataURL(file);
}

function otvorLokaciu(id) {
  const l = data.locations.find(x => String(x._id) === String(id));
  const count = data.tools.filter(n => String(n.aktualna_lokacia_id) === String(id)).length;
  alert(`Lokácia: ${l?.nazov || ''}\nPočet náradia: ${count}`);
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  document.getElementById('detail-content').innerHTML = `<div class="detail-box"><p><strong>Názov:</strong> ${item.nazov}</p><p><strong>QR:</strong> ${item.qr_kod}</p><p><strong>Interné číslo:</strong> ${item.interne_cislo || '-'}</p><p><strong>Kategória:</strong> ${item.kategoria || '-'}</p><p><strong>Stav:</strong> ✓ ${prelozStatus(item.stav)}</p><p><strong>Lokácia:</strong> ${item.aktualna_lokacia || '-'}</p><div class="row"><button class="primary-btn" onclick="presunNaStavbuZDetailu('${item._id}')">✓ Presun na stavbu</button><button class="primary-btn" onclick="otvorUpravu('${item._id}')">Upraviť</button><button class="ghost-btn" onclick="exportNaradiePdf('${item._id}')">PDF</button><button class="ghost-btn" onclick="zatvorModal('detail-modal')">Zavrieť</button></div></div>`;
  document.getElementById('detail-modal').style.display = 'flex';
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');
  const old = item.aktualna_lokacia || '-';
  const update = { aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: novyStatus, historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${old} do ${loc.nazov}` }] };
  const move = { naradie_id: item._id, z_lokacie: old, do_lokacie: loc.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function presunNaStavbuZDetailu(id) {
  const stavba = data.locations.find(l => l.typ === 'stavba');
  if (!stavba) return alert('Nemáš žiadnu stavbu.');
  presunNaradieNaLokaciu(id, stavba._id, 'na_stavbe');
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const opts = data.locations.map(l => `<option value="${l._id}">${l.nazov} (${l.typ})</option>`).join('');
  document.getElementById('edit-content').innerHTML = `<div class="detail-box"><p><strong>${item.nazov}</strong></p><div class="edit-actions"><button class="ghost-btn" onclick="presunASet('${item._id}', 'na_stavbe')">✓ Presun na stavbu</button><button class="ghost-btn" onclick="presunASet('${item._id}', 'dostupne')">✓ Presun do skladu</button><button class="ghost-btn" onclick="presunASet('${item._id}', 'oprava')">✓ Presun do opravy</button><button class="ghost-btn" onclick="oznacAkoStratene('${item._id}')">✓ Stratené</button><button class="ghost-btn" onclick="pridajPoznamku('${item._id}')">✓ Poznámka</button></div><div class="edit-form"><label>Vyber cieľovú lokáciu</label><select id="edit-lokacia">${opts}</select><div class="row"><button class="primary-btn" onclick="presunPodlaVyberu('${item._id}')">Potvrdiť presun</button><button class="ghost-btn" onclick="zatvorModal('edit-modal')">Zavrieť</button></div></div></div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

function presunASet(id, status) {
  const targetType = status === 'dostupne' ? 'sklad' : status === 'oprava' ? 'servis' : 'stavba';
  const target = data.locations.find(l => l.typ === targetType);
  if (!target) return alert(`Nemáš vytvorenú lokáciu typu ${targetType}.`);
  presunNaradieNaLokaciu(id, target._id, status);
}

function presunPodlaVyberu(id) {
  const loc = byId('edit-lokacia').value;
  if (!loc) return alert('Vyber lokáciu.');
  const target = data.locations.find(l => String(l._id) === String(loc));
  const status = target?.typ === 'sklad' ? 'dostupne' : target?.typ === 'servis' ? 'oprava' : 'na_stavbe';
  presunNaradieNaLokaciu(id, loc, status);
  zatvorModal('edit-modal');
}

function oznacAkoStratene(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  api(`/api/tools/${item._id}`, 'PUT', { ...item, stav: 'stratene', historie: [...(item.historie || []), { typ: 'status', datum: new Date().toLocaleString('sk-SK'), popis: 'Označené ako stratené' }] }).then(loadBootstrap);
}

function pridajPoznamku(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Zadaj poznámku:');
  if (!text) return;
  api(`/api/tools/${item._id}`, 'PUT', { ...item, poznamky: [...(item.poznamky || []), { datum: new Date().toLocaleString('sk-SK'), text, autor: actualUser?.meno || '' }], historie: [...(item.historie || []), { typ: 'poznámka', datum: new Date().toLocaleString('sk-SK'), popis: text }] }).then(loadBootstrap);
}

function zatvorModal(id) { byId(id).style.display = 'none'; }

function exportNaradiePdf(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item || !window.jspdf) return alert('PDF knižnica nie je načítaná.');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 14;
  doc.setFontSize(16);
  doc.text(`Náradie: ${item.nazov}`, 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`QR: ${item.qr_kod}`, 14, y); y += 7;
  doc.text(`Interné číslo: ${item.interne_cislo || '-'}`, 14, y); y += 7;
  doc.text(`Kategória: ${item.kategoria || '-'}`, 14, y); y += 7;
  doc.text(`Stav: ${prelozStatus(item.stav)}`, 14, y); y += 7;
  doc.text(`Lokácia: ${item.aktualna_lokacia || '-'}`, 14, y); y += 10;
  doc.setFontSize(13);
  doc.text('História', 14, y); y += 7;
  (item.historie || []).slice(-15).forEach(h => {
    const lines = doc.splitTextToSize(`${h.datum} - ${h.popis}`, 180);
    doc.setFontSize(10);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
    if (y > 280) { doc.addPage(); y = 14; }
  });
  doc.save(`${item.nazov.replace(/\s+/g, '_')}.pdf`);
}

function exportVsetkyNaradiaPdf() {
  if (!window.jspdf) return alert('PDF knižnica nie je načítaná.');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 14;
  const grouped = {};
  data.tools.forEach(n => {
    const loc = data.locations.find(l => String(l._id) === String(n.aktualna_lokacia_id));
    const veduci = loc?.veduci_meno || 'Nepriradený vedúci';
    if (!grouped[veduci]) grouped[veduci] = [];
    grouped[veduci].push({ item: n, loc });
  });
  doc.setFontSize(16);
  doc.text('Export náradia podľa vedúcich', 14, y);
  y += 10;
  Object.entries(grouped).forEach(([veduci, items]) => {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFontSize(14);
    doc.text(veduci, 14, y);
    y += 7;
    items.forEach(({ item, loc }) => {
      const text = `- ${item.nazov} | ${prelozStatus(item.stav)} | ${loc?.nazov || item.aktualna_lokacia || '-'}`;
      const lines = doc.splitTextToSize(text, 180);
      doc.setFontSize(10);
      doc.text(lines, 18, y);
      y += lines.length * 5 + 2;
      if (y > 280) { doc.addPage(); y = 14; }
    });
    y += 4;
  });
  doc.save('export_naradia_podla_veducich.pdf');
}

async function getBackCameraDeviceId() {
  try {
    const devices = await Html5Qrcode.getCameras();
    if (!devices || !devices.length) return null;
    const back = devices.find(d => { const label = (d.label || '').toLowerCase(); return label.includes('back') || label.includes('rear') || label.includes('environment'); });
    return back ? back.id : devices[0].id;
  } catch {
    return null;
  }
}

async function safeStopScanner() {
  try { if (qrScanner) { await qrScanner.stop(); await qrScanner.clear(); qrScanner = null; } } catch (e) { console.warn(e); }
}

async function startScanner(mode) {
  await safeStopScanner();
  const elementId = mode === 'ranny' ? 'scanner-ranny' : mode === 'vecerny' ? 'scanner-vecerny' : mode === 'presun' ? 'scanner-presun' : 'scanner-vyhladavanie';
  const statusId = mode === 'ranny' ? 'ranny-scanner-status' : mode === 'vecerny' ? 'vecerny-scanner-status' : mode === 'presun' ? 'presun-scanner-status' : 'vyhladavanie-status';
  const wrapper = byId(elementId);
  const status = byId(statusId);
  if (!wrapper) return;
  wrapper.style.display = 'block';
  wrapper.innerHTML = `<div id="${elementId}-reader"></div>`;
  const scanner = new Html5Qrcode(`${elementId}-reader`);
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  try {
    if (status) status.textContent = 'Pripravujem kameru...';
    try {
      await scanner.start({ facingMode: { exact: 'environment' } }, config, decodedText => onScanSuccess(decodedText, mode), () => {});
    } catch (e1) {
      const camId = await getBackCameraDeviceId();
      if (!camId) throw e1;
      await scanner.start({ deviceId: { exact: camId } }, config, decodedText => onScanSuccess(decodedText, mode), () => {});
    }
    qrScanner = scanner;
    qrMode = mode;
    if (status) status.textContent = 'Kamera je spustená.';
  } catch (e) {
    if (status) status.textContent = `Nejde spustiť kameru: ${e?.message || e}`;
    wrapper.innerHTML = `<div class="info-box">Nejde spustiť kameru. ${e?.message || e}</div>`;
  }
}

function onScanSuccess(decodedText, mode) {
  if (mode === 'ranny') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    if (uzNaskenovaneRano.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneRano.add(item.qr_kod);
    rannySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    renderRannyZoznam();
    item.historie = item.historie || [];
    item.historie.push({ typ: 'ranny_sken', datum: new Date().toLocaleString('sk-SK'), popis: 'Ranný sken' });
    api(`/api/tools/${item._id}`, 'PUT', item).then(loadBootstrap);
    return;
  }
  if (mode === 'vecerny') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    if (uzNaskenovaneVecer.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneVecer.add(item.qr_kod);
    vecernySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    renderVecernyZoznam();
    item.historie = item.historie || [];
    item.historie.push({ typ: 'vecerny_sken', datum: new Date().toLocaleString('sk-SK'), popis: 'Večerný sken' });
    api(`/api/tools/${item._id}`, 'PUT', item).then(loadBootstrap);
    return;
  }
  if (mode === 'presun') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    vybrateNaradieId = item._id;
    byId('info-presun').textContent = `Vybraté náradie: ${item.nazov}`;
    byId('potvrdi-presun').disabled = false;
    return;
  }
  if (mode === 'search') {
    byId('filter-qr').value = decodedText;
    byId('vyhladavanie-status').textContent = `Nájdené: ${decodedText}`;
    renderTools();
  }
}

function renderRannyZoznam() {
  const el = byId('ranny-zoznam');
  if (!el) return;
  el.innerHTML = rannySkenList.length ? rannySkenList.map(i => `<div>${i.nazov} <button class="ghost-btn" onclick="odstranZRanneho('${i.qr_kod}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>';
}

function renderVecernyZoznam() {
  const el = byId('vecerny-zoznam');
  if (!el) return;
  el.innerHTML = vecernySkenList.length ? vecernySkenList.map(i => `<div>${i.nazov} <button class="ghost-btn" onclick="odstranZVecerneho('${i.qr_kod}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>';
}

function odstranZRanneho(qr) { rannySkenList = rannySkenList.filter(i => i.qr_kod !== qr); uzNaskenovaneRano.delete(qr); renderRannyZoznam(); }
function odstranZVecerneho(qr) { vecernySkenList = vecernySkenList.filter(i => i.qr_kod !== qr); uzNaskenovaneVecer.delete(qr); renderVecernyZoznam(); }

function otvorRannySken() { startScanner('ranny'); }
function zrusRannySken() { safeStopScanner(); byId('scanner-ranny').style.display = 'none'; }
function otvorVecernySken() { startScanner('vecerny'); }
function zrusVecernySken() { safeStopScanner(); byId('scanner-vecerny').style.display = 'none'; }
function spustiPresunSken() { startScanner('presun'); }
function zrusPresunSken() { safeStopScanner(); byId('scanner-presun').style.display = 'none'; }
function spustiVyhladavaciSken() { startScanner('search'); }

async function ulozRannySken() {
  const lokaciaId = byId('ranna-lokacia').value;
  if (!lokaciaId) return alert('Vyber stavbu.');
  await api('/api/scans', 'POST', { uzivatel: actualUser?.meno || '', lokacia_id: lokaciaId, lokacia_nazov: data.locations.find(l => String(l._id) === String(lokaciaId))?.nazov || '', typ: 'ranny_sken', data: [...rannySkenList], datum_cas: new Date().toLocaleString('sk-SK') });
  alert('Ranný sken uložený.');
  await loadBootstrap();
}

async function porovnajVecernySken() {
  const lokaciaId = byId('vecerna-lokacia').value;
  if (!lokaciaId) return alert('Vyber stavbu.');
  const chybajuce = rannySkenList.filter(i => !vecernySkenList.some(v => v.qr_kod === i.qr_kod));
  if (chybajuce.length > 0) return alert('Chýba náradie:\n' + chybajuce.map(i => i.nazov).join('\n'));
  await api('/api/scans', 'POST', { uzivatel: actualUser?.meno || '', lokacia_id: lokaciaId, lokacia_nazov: data.locations.find(l => String(l._id) === String(lokaciaId))?.nazov || '', typ: 'vecerny_sken', data: [...vecernySkenList], datum_cas: new Date().toLocaleString('sk-SK') });
  alert('Večerný sken sedí s ranným.');
  await loadBootstrap();
}

async function potvrdiPresun() {
  const cielId = byId('ciel-lokacia').value;
  if (!vybrateNaradieId) return alert('Najprv naskenuj náradie.');
  if (!cielId) return alert('Vyber cieľovú lokáciu.');
  const target = data.locations.find(l => String(l._id) === String(cielId));
  if (!target) return alert('Cieľová lokácia sa nenašla.');
  const item = data.tools.find(n => String(n._id) === String(vybrateNaradieId));
  if (!item) return alert('Náradie sa nenašlo.');
  const oldLoc = item.aktualna_lokacia || '-';
  const update = { ...item, aktualna_lokacia_id: target._id, aktualna_lokacia: target.nazov, stav: 'presunute', historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${oldLoc} do ${target.nazov}` }] };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', { naradie_id: item._id, z_lokacie: oldLoc, do_lokacie: target.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' });
  vybrateNaradieId = null;
  byId('potvrdi-presun').disabled = true;
  byId('info-presun').textContent = 'Presun dokončený.';
  await loadBootstrap();
}

async function exportujCSV() {
  const rows = [['nazov', 'qr_kod', 'stav', 'lokacia', 'kategoria', 'interne_cislo', 'datum']];
  data.tools.forEach(n => rows.push([n.nazov, n.qr_kod, n.stav || '', n.aktualna_lokacia || '', n.kategoria || '', n.interne_cislo || '', n.createdAt || '']));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'naradie_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportujDennyReport() {
  const report = { datum: new Date().toLocaleDateString('sk-SK'), veduci: actualUser ? actualUser.meno : '', stavby: data.locations.map(l => l.nazov), naradie: data.tools.map(n => n.nazov), pocet_naradia: data.tools.length, rano: rannySkenList, vecer: vecernySkenList, presuny: data.moves.slice(-20) };
  localStorage.setItem('dennyReport', JSON.stringify(report));
  byId('report-info').textContent = 'Report pripravený na export.';
  alert('Report uložený.');
}

function ulozAktualnuLokaciuVeduceho() {
  const val = byId('veduci-aktualna-lokacia').value;
  localStorage.setItem('veduciLokaciaId', val || '');
  alert(val ? `Uložené: ${data.locations.find(l => String(l._id) === String(val))?.nazov || ''}` : 'Nastavené na Žiadna.');
}

window.addEventListener('storage', async e => { if (e.key === 'kk_user') await loadBootstrap(); });

document.addEventListener('DOMContentLoaded', async () => {
  await loadBootstrap();
  if (actualUser) showApp();
  else showLogin();
});
'''

(base/'server.js').write_text(server_js, encoding='utf-8')
(base/'index.html').write_text(index_html, encoding='utf-8')
(base/'style.css').write_text(style_css, encoding='utf-8')
(base/'app.js').write_text(app_js, encoding='utf-8')
print('saved all')