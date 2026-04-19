let actualUser = null;
let data = { users: [], locations: [], tools: [], moves: [], scans: [] };
let qrScanner = null;
let qrMode = null;
let vybrateNaradieId = null;
let rannySkenList = [];
let vecernySkenList = [];
let uzNaskenovaneRano = new Set();
let uzNaskenovaneVecer = new Set();
let veduciStavbyLokaciaId = '';
let osobneNaradieBuffer = [];
let bootstrapLoaded = false;
let currentSection = 'home-section';

const byId = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function api(path, method = 'GET', body = null) {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : null });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function showLogin() { if (byId('login-screen')) byId('login-screen').style.display = 'flex'; if (byId('main-app')) byId('main-app').style.display = 'none'; }
function showApp() { if (byId('login-screen')) byId('login-screen').style.display = 'none'; if (byId('main-app')) byId('main-app').style.display = 'block'; if (actualUser && byId('meno-uzivatela')) byId('meno-uzivatela').textContent = `${actualUser.meno} (${actualUser.rola})`; }
function saveSession() { if (actualUser) localStorage.setItem('kk_user', JSON.stringify({ meno: actualUser.meno, rola: actualUser.rola })); else localStorage.removeItem('kk_user'); }
function prelozStatus(status) { return ({ dostupne: 'Dostupné', na_stavbe: 'Na stavbe', oprava: 'Oprava', stratene: 'Stratené', presunute: 'Presunuté' }[status] || status || 'Nezadané'); }

function toolQrDataUrl(text) {
  if (!text || typeof QRCode === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, String(text), { width: 260, margin: 2 });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error(e);
    return '';
  }
}

function renderQrPreview(containerId, qrText) {
  const el = byId(containerId);
  if (!el) return;
  const img = toolQrDataUrl(qrText);
  el.innerHTML = qrText ? `
    <div class="info-box">
      <strong>QR kód:</strong> ${esc(qrText)}<br>
      ${img ? `<img src="${img}" alt="QR" style="width:220px;height:220px;margin-top:10px;display:block;">` : '<div class="muted">QR obrázok sa nepodarilo vygenerovať.</div>'}
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="stiahniQr('${esc(qrText)}')">Stiahnuť QR</button>
        <button class="ghost-btn" type="button" onclick="vytlacitQr('${esc(qrText)}')">Vytlačiť QR</button>
      </div>
    </div>` : '';
}

async function loadBootstrap() {
  data = await api('/api/all');
  bootstrapLoaded = true;
  const saved = JSON.parse(localStorage.getItem('kk_user') || 'null');
  actualUser = saved ? data.users.find(u => u.meno === saved.meno && u.rola === saved.rola) || null : null;
  if (actualUser?.rola === 'veduci_stavby') veduciStavbyLokaciaId = actualUser.stavba_id || localStorage.getItem('veduciLokaciaId') || '';
  renderAll();
}

async function ensureBootstrap() { if (!bootstrapLoaded) await loadBootstrap(); }

async function prihlasSa() {
  try {
    await ensureBootstrap();
    const meno = (byId('login-meno')?.value || '').trim();
    const heslo = byId('login-heslo')?.value || '';
    if (!meno || !heslo) return alert('Zadaj meno a heslo.');
    const u = data.users.find(x => String(x.meno).trim().toLowerCase() === meno.toLowerCase() && String(x.heslo) === heslo);
    if (!u) return alert('Nesprávne meno alebo heslo.');
    actualUser = u;
    saveSession();
    showApp();
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Prihlásenie zlyhalo.');
  }
}
function odhlasSa() { actualUser = null; saveSession(); showLogin(); }

function setActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const map = { 'home-section': 0, 'stavby-section': 1, 'sklady-section': 2, 'naradie-section': 3, 'presuny-section': 4, 'skeny-section': 5, 'admin-section': 6 };
  const idx = map[sectionId];
  if (typeof idx === 'number') document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
}

function showSection(sectionId) {
  currentSection = sectionId;
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('visible'));
  const sec = byId(sectionId);
  if (sec) sec.classList.add('visible');
  setActiveNav(sectionId);
  if (sectionId === 'home-section') renderHome();
  if (sectionId === 'stavby-section') { renderLocations(); renderSelects(); }
  if (sectionId === 'sklady-section') { renderLocations(); }
  if (sectionId === 'naradie-section') { renderTools(); renderSelects(); }
  if (sectionId === 'presuny-section') renderHistory();
  if (sectionId === 'skeny-section') { renderOsobneNaradie(); renderRannyZoznam(); renderVecernyZoznam(); }
  if (sectionId === 'admin-section') { renderAdmin(); renderUsers(); }
}

function renderStats() { if (byId('stat-lokacie')) byId('stat-lokacie').textContent = data.locations.length; if (byId('stat-naradie')) byId('stat-naradie').textContent = data.tools.length; if (byId('stat-presuny')) byId('stat-presuny').textContent = data.moves.length; if (byId('stat-skeny')) byId('stat-skeny').textContent = data.scans.length; }
function renderUsers() { const el = byId('zoznam-pouzitvatelov'); if (!el) return; if (actualUser?.rola !== 'admin') { el.innerHTML = '<p>Prístup len pre admina.</p>'; return; } el.innerHTML = data.users.length ? data.users.map(u => `<div class="pouzitvatel-item"><strong>${esc(u.meno)}</strong> (${esc(u.rola)})<br>${esc(u.email || '')}${u.rola === 'veduci_stavby' && u.stavba_id ? `<br><span class="small-muted">Stavba: ${esc(data.locations.find(l => String(l._id) === String(u.stavba_id))?.nazov || '-')}</span>` : ''}<div class="row-actions"><button class="ghost-btn" onclick="upravUserPasswordAdmin('${u._id}')">Zmeniť heslo</button></div></div>`).join('') : '<p>Žiadni používatelia.</p>'; }
function renderLocations() { const el = byId('zoznam-lokacii'); if (!el) return; el.innerHTML = data.locations.length ? data.locations.map(l => `<div class="lokacia-item"><strong>${esc(l.nazov)}</strong> <span class="badge">${esc(l.typ)}</span><br>${esc(l.adresa || '')}<div class="small-muted">Vedúci: ${esc(l.veduci_meno || '-')}</div></div>`).join('') : '<p>Žiadne lokácie.</p>'; }
function renderSelects() { const opts = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)}</option>`).join(''); ['aktualna-lokacia', 'ciel-lokacia', 'ranna-lokacia', 'vecerna-lokacia', 'filter-lokacia', 'moj-stavba-select'].forEach(id => { const el = byId(id); if (!el) return; if (id === 'filter-lokacia') el.innerHTML = `<option value="">Všetky lokácie</option>${opts}`; else if (id === 'moj-stavba-select') el.innerHTML = `<option value="">Vyber stavbu</option>${data.locations.filter(l => l.typ === 'stavba').map(l => `<option value="${l._id}">${esc(l.nazov)}</option>`).join('')}`; else el.innerHTML = `<option value="">Vyber lokáciu</option>${opts}`; }); }
function renderTools() { const el = byId('zoznam-naradia'); if (!el) return; const q = (byId('filter-hladaj')?.value || '').trim().toLowerCase(); const qr = (byId('filter-qr')?.value || '').trim().toLowerCase(); const st = byId('filter-status')?.value || ''; const loc = byId('filter-lokacia')?.value || ''; const list = data.tools.filter(n => { const hay = `${n.nazov} ${n.qr_kod} ${n.kategoria || ''} ${n.interne_cislo || ''}`.toLowerCase(); return (!q || hay.includes(q)) && (!qr || String(n.qr_kod).toLowerCase().includes(qr)) && (!st || n.stav === st) && (!loc || String(n.aktualna_lokacia_id) === String(loc)); }); el.innerHTML = list.length ? list.map(n => `<div class="naradie-item"><strong>${esc(n.nazov)}</strong> <span class="badge">✓ ${esc(prelozStatus(n.stav))}</span><br>QR: ${esc(n.qr_kod)}<br>Interné číslo: ${esc(n.interne_cislo || '-')}<br>Kategória: ${esc(n.kategoria || '-')}<br><div class="lokacia-label">Nachádza sa: <strong>${esc(n.aktualna_lokacia || '-')}</strong></div><div class="row-actions"><button class="ghost-btn" onclick="otvorDetail('${n._id}')">Detail</button><button class="ghost-btn" onclick="otvorUpravu('${n._id}')">Upraviť</button></div></div>`).join('') : '<p>Žiadne náradie nespĺňa filter.</p>'; }
function renderHistory() { const el = byId('zoznam-presunov'); if (!el) return; el.innerHTML = data.moves.length ? data.moves.slice().reverse().map(p => `<div class="history-item"><strong>${esc(p.datum_cas || '')}</strong><br>${esc(p.kto_spravil || '')} presunul náradie z <strong>${esc(p.z_lokacie || '-')}</strong> do <strong>${esc(p.do_lokacie || '-')}</strong></div>`).join('') : '<p>Žiadna história presunov.</p>'; }
function renderAdmin() { if (byId('admin-panel')) byId('admin-panel').style.display = actualUser?.rola === 'admin' ? 'block' : 'none'; if (byId('veduci-panel')) byId('veduci-panel').style.display = actualUser?.rola === 'veduci_stavby' ? 'block' : 'none'; if (byId('password-panel')) byId('password-panel').style.display = actualUser ? 'block' : 'none'; if (byId('my-stavba-section')) byId('my-stavba-section').style.display = actualUser?.rola === 'veduci_stavby' ? 'block' : 'none'; if (actualUser?.rola !== 'admin') { const puz = byId('zoznam-pouzitvatelov'); if (puz) puz.innerHTML = '<p>Prístup len pre admina.</p>'; } }
function renderLeaderArea() { const box = byId('moj-stav'); if (box) { const loc = data.locations.find(l => String(l._id) === String(localStorage.getItem('veduciLokaciaId') || actualUser?.stavba_id || '')); box.innerHTML = loc ? `<strong>Aktuálna stavba:</strong> ${esc(loc.nazov)}<br><span class="small-muted">${esc(loc.adresa || '')}</span>` : 'Zatiaľ nie si priradený k žiadnej stavbe.'; } const list = byId('moje-naradie'); if (list) { const myTools = data.tools.filter(t => String(t.vlastnik_meno || '') === String(actualUser?.meno || '')); list.innerHTML = myTools.length ? myTools.map(t => `<div class="naradie-item"><strong>${esc(t.nazov)}</strong><br>QR: ${esc(t.qr_kod)}<br>Stav: ${esc(prelozStatus(t.stav))}</div>`).join('') : '<p>Nemáš zatiaľ žiadne náradie priradené na meno.</p>'; } }
function renderHome() {
  const loc = data.locations.find(l => String(l._id) === String(localStorage.getItem('veduciLokaciaId') || actualUser?.stavba_id || ''));
  const myScanned = data.scans.filter(s => String(s.uzivatel || '').toLowerCase() === String(actualUser?.meno || '').toLowerCase()).reduce((sum, s) => sum + ((s.data || []).length || 0), 0);
  if (byId('home-naradie')) byId('home-naradie').textContent = myScanned;
  if (byId('home-stavba')) byId('home-stavba').textContent = loc ? loc.nazov : '-';
  if (byId('home-title')) byId('home-title').textContent = actualUser?.rola === 'admin' ? 'Administrátorský prehľad' : 'Prehľad stavby';
  if (byId('home-subtitle')) byId('home-subtitle').textContent = actualUser?.rola === 'admin' ? 'Rýchly vstup do správy náradia a lokácií.' : 'Tu uvidíš svoju priradenú stavbu a prehľad naskenovaného náradia.';
  if (byId('moj-stav')) byId('moj-stav').innerHTML = loc ? `<strong>Aktuálna stavba:</strong> ${esc(loc.nazov)}<br><span class="small-muted">${esc(loc.adresa || '')}</span>` : 'Zatiaľ nie si priradený k žiadnej stavbe.';
}
function renderOsobneNaradie() { const el = byId('osobne-zoznam'); if (!el) return; el.innerHTML = osobneNaradieBuffer.length ? osobneNaradieBuffer.map((i, idx) => `<div class="naradie-item"><strong>${esc(i.nazov)}</strong><br>QR: ${esc(i.qr_kod)}<div class="row-actions"><button class="ghost-btn" onclick="odstranOsobneNaradie(${idx})">Odstrániť</button></div></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>'; }
function renderRannyZoznam() { const el = byId('ranny-zoznam'); if (!el) return; el.innerHTML = rannySkenList.length ? rannySkenList.map(i => `<div>${esc(i.nazov)} <button class="ghost-btn" onclick="odstranZRanneho('${esc(i.qr_kod)}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>'; }
function renderVecernyZoznam() { const el = byId('vecerny-zoznam'); if (!el) return; el.innerHTML = vecernySkenList.length ? vecernySkenList.map(i => `<div>${esc(i.nazov)} <button class="ghost-btn" onclick="odstranZVecerneho('${esc(i.qr_kod)}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>'; }
function renderAll() { if (!actualUser) { showLogin(); return; } showApp(); renderStats(); renderLocations(); renderSelects(); renderTools(); renderHistory(); renderAdmin(); renderLeaderArea(); renderHome(); renderUsers(); renderOsobneNaradie(); renderRannyZoznam(); renderVecernyZoznam(); showSection(currentSection); }

async function zmenHeslo() { const stare = byId('stare-heslo').value; const nove = byId('nove-heslo-zmena').value; const potvrd = byId('potvrdit-heslo-zmena').value; const me = data.users.find(u => u.meno === actualUser?.meno); if (!me) return alert('Používateľ sa nenašiel.'); if (me.heslo !== stare) return alert('Staré heslo nesedí.'); if (!nove || nove.length < 4) return alert('Nové heslo musí mať aspoň 4 znaky.'); if (nove !== potvrd) return alert('Heslá sa nezhodujú.'); await api(`/api/users/${me._id}`, 'PUT', { ...me, heslo: nove }); alert('Heslo bolo zmenené.'); byId('stare-heslo').value = ''; byId('nove-heslo-zmena').value = ''; byId('potvrdit-heslo-zmena').value = ''; }
async function upravUserPasswordAdmin(id) { const u = data.users.find(x => String(x._id) === String(id)); if (!u) return; const nove = prompt(`Zadaj nové heslo pre ${u.meno}:`); if (!nove) return; await api(`/api/users/${u._id}`, 'PUT', { ...u, heslo: nove }); await loadBootstrap(); }
async function pridajPouzivatela() { if (actualUser?.rola !== 'admin') return alert('Nemáš oprávnenie.'); const body = { meno: byId('nove-meno').value.trim(), email: byId('novy-email').value.trim(), heslo: byId('nove-heslo').value, rola: byId('nova-rola').value, stavba_id: '' }; if (!body.meno || !body.heslo) return alert('Zadaj meno a heslo.'); await api('/api/users', 'POST', body); await loadBootstrap(); }
async function pridajSaNaStavbu() { const loc = byId('moj-stavba-select').value; if (!loc) return alert('Vyber stavbu.'); veduciStavbyLokaciaId = loc; localStorage.setItem('veduciLokaciaId', loc); try { await api(`/api/users/${actualUser._id}`, 'PUT', { ...actualUser, stavba_id: loc }); actualUser.stavba_id = loc; renderAll(); alert('Bol si priradený k stavbe.'); } catch (e) { console.error(e); alert('Nepodarilo sa priradiť k stavbe.'); } }
async function otvorPridanieOsobnehoNadia() { if (actualUser?.rola !== 'veduci_stavby') return alert('Toto je len pre vedúceho stavby.'); osobneNaradieBuffer = []; if (byId('scanner-osobne')) byId('scanner-osobne').style.display = 'block'; if (byId('osobne-info')) byId('osobne-info').textContent = 'Skenuj QR kódy náradia.'; await startScanner('osobne'); }
function zrusPridavanieOsobnehoNadia() { safeStopScanner(); if (byId('scanner-osobne')) byId('scanner-osobne').style.display = 'none'; if (byId('osobne-info')) byId('osobne-info').textContent = 'Pridávanie náradia bolo zastavené.'; }
async function potvrdiOsobneNaradie() { if (actualUser?.rola !== 'veduci_stavby') return alert('Toto je len pre vedúceho stavby.'); if (!osobneNaradieBuffer.length) return alert('Najprv naskenuj aspoň jedno náradie.'); const locId = localStorage.getItem('veduciLokaciaId') || actualUser?.stavba_id || ''; const loc = data.locations.find(l => String(l._id) === String(locId)); if (!loc) return alert('Najprv si priraď stavbu.'); for (const item of osobneNaradieBuffer) { const tool = data.tools.find(t => String(t._id) === String(item._id)); if (!tool) continue; await api(`/api/tools/${tool._id}`, 'PUT', { ...tool, vlastnik_meno: actualUser.meno, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: 'na_stavbe', historie: [...(tool.historie || []), { typ: 'priradenie', datum: new Date().toLocaleString('sk-SK'), popis: `Priradené pod ${actualUser.meno}` }] }); } osobneNaradieBuffer = []; renderOsobneNaradie(); if (byId('osobne-info')) byId('osobne-info').textContent = 'Náradie bolo priradené pod tvoje meno.'; await loadBootstrap(); }
function odstranOsobneNaradie(index) { osobneNaradieBuffer.splice(index, 1); renderOsobneNaradie(); }
async function pridajLokaciu() { if (actualUser?.rola !== 'admin') return alert('Lokácie môže pridávať iba admin.'); const body = { nazov: byId('lokacia-nazov')?.value.trim(), typ: byId('lokacia-typ')?.value, adresa: byId('lokacia-adresa')?.value.trim(), veduci_meno: byId('lokacia-veduci')?.value.trim() }; if (!body.nazov) return alert('Zadaj názov lokácie.'); await api('/api/locations', 'POST', body); await loadBootstrap(); }

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      vlastnik_meno: '',
      historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }],
      poznamky: [],
      udrzba: []
    };
    await api('/api/tools', 'POST', body);
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file); else reader.onload({ target: { result: '' } });
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  const hist = (item.historie || []).slice().reverse().map(h => `<li><strong>${esc(h.datum || '')}</strong> – ${esc(h.typ || '')}: ${esc(h.popis || '')}</li>`).join('') || '<li>Bez histórie</li>';
  const notes = (item.poznamky || []).slice().reverse().map(n => `<li><strong>${esc(n.datum || '')}</strong>: ${esc(n.text || '')} ${esc(n.autor || '')}</li>`).join('') || '<li>Bez poznámok</li>';
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${esc(item.nazov)}</p>
      <p><strong>QR text:</strong> ${esc(item.qr_kod)}</p>
      <p><strong>Interné číslo:</strong> ${esc(item.interne_cislo || '-')}</p>
      <p><strong>Kategória:</strong> ${esc(item.kategoria || '-')}</p>
      <p><strong>Stav:</strong> ✓ ${esc(prelozStatus(item.stav))}</p>
      <p><strong>Lokácia:</strong> ${esc(item.aktualna_lokacia || '-')}</p>
      <p><strong>Vlastník:</strong> ${esc(item.vlastnik_meno || '-')}</p>
      <div class="card">
        <strong>QR obrázok:</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : '<div class="muted">QR obrázok sa nepodarilo vygenerovať.</div>'}
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="stiahniQr('${esc(item.qr_kod)}')">Stiahnuť QR</button>
          <button class="ghost-btn" type="button" onclick="vytlacitQr('${esc(item.qr_kod)}')">Vytlačiť QR</button>
        </div>
      </div>
      <div class="card"><strong>História</strong><ul>${hist}</ul></div>
      <div class="card"><strong>Poznámky</strong><ul>${notes}</ul></div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="presunNaVyberLokacie('${item._id}')">Presunúť na lokáciu</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','checkin')">Check-in</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','issue')">Problém</button>
        <button class="ghost-btn" type="button" onclick="pridajPoznamkuKNaradi('${item._id}')">Poznámka</button>
        <button class="ghost-btn" type="button" onclick="reportInspection('${item._id}')">Servis</button>
        <button class="ghost-btn" type="button" onclick="otvorUpravu('${item._id}')">Upraviť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('detail-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('detail-modal').style.display = 'flex';
}

function presunNaVyberLokacie(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const options = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Presun náradia</h4>
      <p><strong>${esc(item.nazov)}</strong></p>
      <select id="presun-ciel">${options}</select>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="potvrditPresunZDetailu('${item._id}')">Presunúť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function potvrditPresunZDetailu(id) {
  const ciel = byId('presun-ciel').value;
  if (!ciel) return alert('Vyber cieľovú lokáciu.');
  await presunNaradieNaLokaciu(id, ciel, 'presunute');
  zatvorModal('edit-modal');
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');
  const old = item.aktualna_lokacia || '-';
  const update = { ...item, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: novyStatus, historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${old} do ${loc.nazov}` }] };
  const move = { naradie_id: item._id, z_lokacie: old, do_lokacie: loc.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Upraviť náradie</h4>
      <label>Názov</label><input id="edit-nazov" value="${esc(item.nazov || '')}" placeholder="Názov">
      <label>Interné číslo</label><input id="edit-interne" value="${esc(item.interne_cislo || '')}" placeholder="Interné číslo">
      <label>Kategória</label><input id="edit-kategoria" value="${esc(item.kategoria || '')}" placeholder="Kategória">
      <label>QR text</label><input id="edit-qr" value="${esc(item.qr_kod || '')}" placeholder="QR text">
      <div class="card">
        <strong>QR obrázok</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : ''}
      </div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="ulozitUpravuNaradia('${item._id}')">Uložiť</button>
        <button class="ghost-btn" type="button" onclick="generateNewToolQr('${item._id}')">Generovať nový QR</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozitUpravuNaradia(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const body = { ...item, nazov: byId('edit-nazov').value.trim(), interne_cislo: byId('edit-interne').value.trim(), kategoria: byId('edit-kategoria').value.trim(), qr_kod: byId('edit-qr').value.trim() || item.qr_kod };
  await api(`/api/tools/${id}`, 'PUT', body);
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function generujNovyQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr });
  await loadBootstrap();
  otvorUpravu(id);
}

function stiahniQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const a = document.createElement('a');
  a.href = img;
  a.download = `${qr}.png`;
  a.click();
}

function vytlacitQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img}" style="width:320px;height:320px;"></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function openToolActionModal(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const locations = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  if (mode === 'checkin') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Check-in / presun</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <select id="action-lokacia">${locations}</select>
        <textarea id="action-poznamka" placeholder="Poznámka / dôvod" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','checkin')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  } else if (mode === 'issue') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Nahlásiť problém</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <input id="action-typ" value="Porucha" placeholder="Typ problému">
        <textarea id="action-poznamka" placeholder="Popis problému" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','issue')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  }
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozAction(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const now = new Date().toLocaleString('sk-SK');
  if (mode === 'checkin') {
    const locId = byId('action-lokacia').value;
    const loc = data.locations.find(l => String(l._id) === String(locId));
    if (!loc) return alert('Vyber lokáciu.');
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      aktualna_lokacia_id: loc._id,
      aktualna_lokacia: loc.nazov,
      stav: 'na_stavbe',
      historie: [...(item.historie || []), { typ: 'checkin', datum: now, popis: `${actualUser?.meno || ''} -> ${loc.nazov}${note ? ` | ${note}` : ''}` }]
    });
    await api('/api/moves', 'POST', { naradie_id: item._id, z_lokacie: item.aktualna_lokacia || '-', do_lokacie: loc.nazov, datum_cas: now, kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' });
  } else if (mode === 'issue') {
    const typ = byId('action-typ').value.trim() || 'Problém';
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      stav: 'oprava',
      poznamky: [...(item.poznamky || []), { typ, text: note, datum: now, autor: actualUser?.meno || '' }],
      historie: [...(item.historie || []), { typ: 'problém', datum: now, popis: `${typ}: ${note}` }]
    });
  }
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function pridajPoznamkuKNaradi(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Poznámka k náradiu:');
  if (!text) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, poznamky: [...(item.poznamky || []), { text, datum: new Date().toLocaleString('sk-SK'), autor: actualUser?.meno || '' }] });
  await loadBootstrap();
}

async function reportInspection(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const note = prompt('Záznam o kontrole / servise:');
  if (!note) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, udrzba: [...(item.udrzba || []), { datum: new Date().toLocaleString('sk-SK'), text: note, autor: actualUser?.meno || '' }], historie: [...(item.historie || []), { typ: 'udrzba', datum: new Date().toLocaleString('sk-SK'), popis: note }] });
  await loadBootstrap();
}

async function generateNewToolQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr, historie: [...(item.historie || []), { typ: 'qr', datum: new Date().toLocaleString('sk-SK'), popis: `Vygenerovaný nový QR: ${newQr}` }] });
  await loadBootstrap();
  otvorUpravu(id);
}

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      vlastnik_meno: '',
      historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }],
      poznamky: [],
      udrzba: []
    };
    await api('/api/tools', 'POST', body);
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file); else reader.onload({ target: { result: '' } });
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  const hist = (item.historie || []).slice().reverse().map(h => `<li><strong>${esc(h.datum || '')}</strong> – ${esc(h.typ || '')}: ${esc(h.popis || '')}</li>`).join('') || '<li>Bez histórie</li>';
  const notes = (item.poznamky || []).slice().reverse().map(n => `<li><strong>${esc(n.datum || '')}</strong>: ${esc(n.text || '')} ${esc(n.autor || '')}</li>`).join('') || '<li>Bez poznámok</li>';
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${esc(item.nazov)}</p>
      <p><strong>QR text:</strong> ${esc(item.qr_kod)}</p>
      <p><strong>Interné číslo:</strong> ${esc(item.interne_cislo || '-')}</p>
      <p><strong>Kategória:</strong> ${esc(item.kategoria || '-')}</p>
      <p><strong>Stav:</strong> ✓ ${esc(prelozStatus(item.stav))}</p>
      <p><strong>Lokácia:</strong> ${esc(item.aktualna_lokacia || '-')}</p>
      <p><strong>Vlastník:</strong> ${esc(item.vlastnik_meno || '-')}</p>
      <div class="card">
        <strong>QR obrázok:</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : '<div class="muted">QR obrázok sa nepodarilo vygenerovať.</div>'}
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="stiahniQr('${esc(item.qr_kod)}')">Stiahnuť QR</button>
          <button class="ghost-btn" type="button" onclick="vytlacitQr('${esc(item.qr_kod)}')">Vytlačiť QR</button>
        </div>
      </div>
      <div class="card"><strong>História</strong><ul>${hist}</ul></div>
      <div class="card"><strong>Poznámky</strong><ul>${notes}</ul></div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="presunNaVyberLokacie('${item._id}')">Presunúť na lokáciu</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','checkin')">Check-in</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','issue')">Problém</button>
        <button class="ghost-btn" type="button" onclick="pridajPoznamkuKNaradi('${item._id}')">Poznámka</button>
        <button class="ghost-btn" type="button" onclick="reportInspection('${item._id}')">Servis</button>
        <button class="ghost-btn" type="button" onclick="otvorUpravu('${item._id}')">Upraviť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('detail-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('detail-modal').style.display = 'flex';
}

function presunNaVyberLokacie(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const options = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Presun náradia</h4>
      <p><strong>${esc(item.nazov)}</strong></p>
      <select id="presun-ciel">${options}</select>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="potvrditPresunZDetailu('${item._id}')">Presunúť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function potvrditPresunZDetailu(id) {
  const ciel = byId('presun-ciel').value;
  if (!ciel) return alert('Vyber cieľovú lokáciu.');
  await presunNaradieNaLokaciu(id, ciel, 'presunute');
  zatvorModal('edit-modal');
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');
  const old = item.aktualna_lokacia || '-';
  const update = { ...item, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: novyStatus, historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${old} do ${loc.nazov}` }] };
  const move = { naradie_id: item._id, z_lokacie: old, do_lokacie: loc.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Upraviť náradie</h4>
      <label>Názov</label><input id="edit-nazov" value="${esc(item.nazov || '')}" placeholder="Názov">
      <label>Interné číslo</label><input id="edit-interne" value="${esc(item.interne_cislo || '')}" placeholder="Interné číslo">
      <label>Kategória</label><input id="edit-kategoria" value="${esc(item.kategoria || '')}" placeholder="Kategória">
      <label>QR text</label><input id="edit-qr" value="${esc(item.qr_kod || '')}" placeholder="QR text">
      <div class="card">
        <strong>QR obrázok</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : ''}
      </div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="ulozitUpravuNaradia('${item._id}')">Uložiť</button>
        <button class="ghost-btn" type="button" onclick="generateNewToolQr('${item._id}')">Generovať nový QR</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozitUpravuNaradia(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const body = { ...item, nazov: byId('edit-nazov').value.trim(), interne_cislo: byId('edit-interne').value.trim(), kategoria: byId('edit-kategoria').value.trim(), qr_kod: byId('edit-qr').value.trim() || item.qr_kod };
  await api(`/api/tools/${id}`, 'PUT', body);
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function generujNovyQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr });
  await loadBootstrap();
  otvorUpravu(id);
}

function stiahniQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const a = document.createElement('a');
  a.href = img;
  a.download = `${qr}.png`;
  a.click();
}

function vytlacitQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img}" style="width:320px;height:320px;"></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function openToolActionModal(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const locations = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  if (mode === 'checkin') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Check-in / presun</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <select id="action-lokacia">${locations}</select>
        <textarea id="action-poznamka" placeholder="Poznámka / dôvod" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','checkin')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  } else if (mode === 'issue') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Nahlásiť problém</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <input id="action-typ" value="Porucha" placeholder="Typ problému">
        <textarea id="action-poznamka" placeholder="Popis problému" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','issue')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  }
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozAction(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const now = new Date().toLocaleString('sk-SK');
  if (mode === 'checkin') {
    const locId = byId('action-lokacia').value;
    const loc = data.locations.find(l => String(l._id) === String(locId));
    if (!loc) return alert('Vyber lokáciu.');
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      aktualna_lokacia_id: loc._id,
      aktualna_lokacia: loc.nazov,
      stav: 'na_stavbe',
      historie: [...(item.historie || []), { typ: 'checkin', datum: now, popis: `${actualUser?.meno || ''} -> ${loc.nazov}${note ? ` | ${note}` : ''}` }]
    });
    await api('/api/moves', 'POST', { naradie_id: item._id, z_lokacie: item.aktualna_lokacia || '-', do_lokacie: loc.nazov, datum_cas: now, kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' });
  } else if (mode === 'issue') {
    const typ = byId('action-typ').value.trim() || 'Problém';
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      stav: 'oprava',
      poznamky: [...(item.poznamky || []), { typ, text: note, datum: now, autor: actualUser?.meno || '' }],
      historie: [...(item.historie || []), { typ: 'problém', datum: now, popis: `${typ}: ${note}` }]
    });
  }
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function pridajPoznamkuKNaradi(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Poznámka k náradiu:');
  if (!text) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, poznamky: [...(item.poznamky || []), { text, datum: new Date().toLocaleString('sk-SK'), autor: actualUser?.meno || '' }] });
  await loadBootstrap();
}

async function reportInspection(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const note = prompt('Záznam o kontrole / servise:');
  if (!note) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, udrzba: [...(item.udrzba || []), { datum: new Date().toLocaleString('sk-SK'), text: note, autor: actualUser?.meno || '' }], historie: [...(item.historie || []), { typ: 'udrzba', datum: new Date().toLocaleString('sk-SK'), popis: note }] });
  await loadBootstrap();
}

async function generateNewToolQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr, historie: [...(item.historie || []), { typ: 'qr', datum: new Date().toLocaleString('sk-SK'), popis: `Vygenerovaný nový QR: ${newQr}` }] });
  await loadBootstrap();
  otvorUpravu(id);
}

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      vlastnik_meno: '',
      historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }],
      poznamky: [],
      udrzba: []
    };
    await api('/api/tools', 'POST', body);
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file); else reader.onload({ target: { result: '' } });
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  const hist = (item.historie || []).slice().reverse().map(h => `<li><strong>${esc(h.datum || '')}</strong> – ${esc(h.typ || '')}: ${esc(h.popis || '')}</li>`).join('') || '<li>Bez histórie</li>';
  const notes = (item.poznamky || []).slice().reverse().map(n => `<li><strong>${esc(n.datum || '')}</strong>: ${esc(n.text || '')} ${esc(n.autor || '')}</li>`).join('') || '<li>Bez poznámok</li>';
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${esc(item.nazov)}</p>
      <p><strong>QR text:</strong> ${esc(item.qr_kod)}</p>
      <p><strong>Interné číslo:</strong> ${esc(item.interne_cislo || '-')}</p>
      <p><strong>Kategória:</strong> ${esc(item.kategoria || '-')}</p>
      <p><strong>Stav:</strong> ✓ ${esc(prelozStatus(item.stav))}</p>
      <p><strong>Lokácia:</strong> ${esc(item.aktualna_lokacia || '-')}</p>
      <p><strong>Vlastník:</strong> ${esc(item.vlastnik_meno || '-')}</p>
      <div class="card">
        <strong>QR obrázok:</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : '<div class="muted">QR obrázok sa nepodarilo vygenerovať.</div>'}
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="stiahniQr('${esc(item.qr_kod)}')">Stiahnuť QR</button>
          <button class="ghost-btn" type="button" onclick="vytlacitQr('${esc(item.qr_kod)}')">Vytlačiť QR</button>
        </div>
      </div>
      <div class="card"><strong>História</strong><ul>${hist}</ul></div>
      <div class="card"><strong>Poznámky</strong><ul>${notes}</ul></div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="presunNaVyberLokacie('${item._id}')">Presunúť na lokáciu</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','checkin')">Check-in</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','issue')">Problém</button>
        <button class="ghost-btn" type="button" onclick="pridajPoznamkuKNaradi('${item._id}')">Poznámka</button>
        <button class="ghost-btn" type="button" onclick="reportInspection('${item._id}')">Servis</button>
        <button class="ghost-btn" type="button" onclick="otvorUpravu('${item._id}')">Upraviť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('detail-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('detail-modal').style.display = 'flex';
}

function presunNaVyberLokacie(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const options = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Presun náradia</h4>
      <p><strong>${esc(item.nazov)}</strong></p>
      <select id="presun-ciel">${options}</select>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="potvrditPresunZDetailu('${item._id}')">Presunúť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function potvrditPresunZDetailu(id) {
  const ciel = byId('presun-ciel').value;
  if (!ciel) return alert('Vyber cieľovú lokáciu.');
  await presunNaradieNaLokaciu(id, ciel, 'presunute');
  zatvorModal('edit-modal');
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');
  const old = item.aktualna_lokacia || '-';
  const update = { ...item, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: novyStatus, historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${old} do ${loc.nazov}` }] };
  const move = { naradie_id: item._id, z_lokacie: old, do_lokacie: loc.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Upraviť náradie</h4>
      <label>Názov</label><input id="edit-nazov" value="${esc(item.nazov || '')}" placeholder="Názov">
      <label>Interné číslo</label><input id="edit-interne" value="${esc(item.interne_cislo || '')}" placeholder="Interné číslo">
      <label>Kategória</label><input id="edit-kategoria" value="${esc(item.kategoria || '')}" placeholder="Kategória">
      <label>QR text</label><input id="edit-qr" value="${esc(item.qr_kod || '')}" placeholder="QR text">
      <div class="card">
        <strong>QR obrázok</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : ''}
      </div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="ulozitUpravuNaradia('${item._id}')">Uložiť</button>
        <button class="ghost-btn" type="button" onclick="generateNewToolQr('${item._id}')">Generovať nový QR</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozitUpravuNaradia(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const body = { ...item, nazov: byId('edit-nazov').value.trim(), interne_cislo: byId('edit-interne').value.trim(), kategoria: byId('edit-kategoria').value.trim(), qr_kod: byId('edit-qr').value.trim() || item.qr_kod };
  await api(`/api/tools/${id}`, 'PUT', body);
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function generujNovyQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr });
  await loadBootstrap();
  otvorUpravu(id);
}

function stiahniQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const a = document.createElement('a');
  a.href = img;
  a.download = `${qr}.png`;
  a.click();
}

function vytlacitQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img}" style="width:320px;height:320px;"></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function openToolActionModal(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const locations = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  if (mode === 'checkin') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Check-in / presun</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <select id="action-lokacia">${locations}</select>
        <textarea id="action-poznamka" placeholder="Poznámka / dôvod" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','checkin')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  } else if (mode === 'issue') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Nahlásiť problém</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <input id="action-typ" value="Porucha" placeholder="Typ problému">
        <textarea id="action-poznamka" placeholder="Popis problému" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','issue')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  }
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozAction(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const now = new Date().toLocaleString('sk-SK');
  if (mode === 'checkin') {
    const locId = byId('action-lokacia').value;
    const loc = data.locations.find(l => String(l._id) === String(locId));
    if (!loc) return alert('Vyber lokáciu.');
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      aktualna_lokacia_id: loc._id,
      aktualna_lokacia: loc.nazov,
      stav: 'na_stavbe',
      historie: [...(item.historie || []), { typ: 'checkin', datum: now, popis: `${actualUser?.meno || ''} -> ${loc.nazov}${note ? ` | ${note}` : ''}` }]
    });
    await api('/api/moves', 'POST', { naradie_id: item._id, z_lokacie: item.aktualna_lokacia || '-', do_lokacie: loc.nazov, datum_cas: now, kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' });
  } else if (mode === 'issue') {
    const typ = byId('action-typ').value.trim() || 'Problém';
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      stav: 'oprava',
      poznamky: [...(item.poznamky || []), { typ, text: note, datum: now, autor: actualUser?.meno || '' }],
      historie: [...(item.historie || []), { typ: 'problém', datum: now, popis: `${typ}: ${note}` }]
    });
  }
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function pridajPoznamkuKNaradi(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Poznámka k náradiu:');
  if (!text) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, poznamky: [...(item.poznamky || []), { text, datum: new Date().toLocaleString('sk-SK'), autor: actualUser?.meno || '' }] });
  await loadBootstrap();
}

async function reportInspection(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const note = prompt('Záznam o kontrole / servise:');
  if (!note) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, udrzba: [...(item.udrzba || []), { datum: new Date().toLocaleString('sk-SK'), text: note, autor: actualUser?.meno || '' }], historie: [...(item.historie || []), { typ: 'udrzba', datum: new Date().toLocaleString('sk-SK'), popis: note }] });
  await loadBootstrap();
}

async function generateNewToolQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr, historie: [...(item.historie || []), { typ: 'qr', datum: new Date().toLocaleString('sk-SK'), popis: `Vygenerovaný nový QR: ${newQr}` }] });
  await loadBootstrap();
  otvorUpravu(id);
}

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      vlastnik_meno: '',
      historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }],
      poznamky: [],
      udrzba: []
    };
    await api('/api/tools', 'POST', body);
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file); else reader.onload({ target: { result: '' } });
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  const hist = (item.historie || []).slice().reverse().map(h => `<li><strong>${esc(h.datum || '')}</strong> – ${esc(h.typ || '')}: ${esc(h.popis || '')}</li>`).join('') || '<li>Bez histórie</li>';
  const notes = (item.poznamky || []).slice().reverse().map(n => `<li><strong>${esc(n.datum || '')}</strong>: ${esc(n.text || '')} ${esc(n.autor || '')}</li>`).join('') || '<li>Bez poznámok</li>';
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${esc(item.nazov)}</p>
      <p><strong>QR text:</strong> ${esc(item.qr_kod)}</p>
      <p><strong>Interné číslo:</strong> ${esc(item.interne_cislo || '-')}</p>
      <p><strong>Kategória:</strong> ${esc(item.kategoria || '-')}</p>
      <p><strong>Stav:</strong> ✓ ${esc(prelozStatus(item.stav))}</p>
      <p><strong>Lokácia:</strong> ${esc(item.aktualna_lokacia || '-')}</p>
      <p><strong>Vlastník:</strong> ${esc(item.vlastnik_meno || '-')}</p>
      <div class="card">
        <strong>QR obrázok:</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : '<div class="muted">QR obrázok sa nepodarilo vygenerovať.</div>'}
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="stiahniQr('${esc(item.qr_kod)}')">Stiahnuť QR</button>
          <button class="ghost-btn" type="button" onclick="vytlacitQr('${esc(item.qr_kod)}')">Vytlačiť QR</button>
        </div>
      </div>
      <div class="card"><strong>História</strong><ul>${hist}</ul></div>
      <div class="card"><strong>Poznámky</strong><ul>${notes}</ul></div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="presunNaVyberLokacie('${item._id}')">Presunúť na lokáciu</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','checkin')">Check-in</button>
        <button class="ghost-btn" type="button" onclick="openToolActionModal('${item._id}','issue')">Problém</button>
        <button class="ghost-btn" type="button" onclick="pridajPoznamkuKNaradi('${item._id}')">Poznámka</button>
        <button class="ghost-btn" type="button" onclick="reportInspection('${item._id}')">Servis</button>
        <button class="ghost-btn" type="button" onclick="otvorUpravu('${item._id}')">Upraviť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('detail-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('detail-modal').style.display = 'flex';
}

function presunNaVyberLokacie(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const options = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Presun náradia</h4>
      <p><strong>${esc(item.nazov)}</strong></p>
      <select id="presun-ciel">${options}</select>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="potvrditPresunZDetailu('${item._id}')">Presunúť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function potvrditPresunZDetailu(id) {
  const ciel = byId('presun-ciel').value;
  if (!ciel) return alert('Vyber cieľovú lokáciu.');
  await presunNaradieNaLokaciu(id, ciel, 'presunute');
  zatvorModal('edit-modal');
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');
  const old = item.aktualna_lokacia || '-';
  const update = { ...item, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: novyStatus, historie: [...(item.historie || []), { typ: 'presun', datum: new Date().toLocaleString('sk-SK'), popis: `Presun z ${old} do ${loc.nazov}` }] };
  const move = { naradie_id: item._id, z_lokacie: old, do_lokacie: loc.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Upraviť náradie</h4>
      <label>Názov</label><input id="edit-nazov" value="${esc(item.nazov || '')}" placeholder="Názov">
      <label>Interné číslo</label><input id="edit-interne" value="${esc(item.interne_cislo || '')}" placeholder="Interné číslo">
      <label>Kategória</label><input id="edit-kategoria" value="${esc(item.kategoria || '')}" placeholder="Kategória">
      <label>QR text</label><input id="edit-qr" value="${esc(item.qr_kod || '')}" placeholder="QR text">
      <div class="card">
        <strong>QR obrázok</strong><br>
        ${qrImg ? `<img src="${qrImg}" alt="QR" style="width:260px;height:260px;margin-top:10px;display:block;">` : ''}
      </div>
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="ulozitUpravuNaradia('${item._id}')">Uložiť</button>
        <button class="ghost-btn" type="button" onclick="generateNewToolQr('${item._id}')">Generovať nový QR</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozitUpravuNaradia(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const body = { ...item, nazov: byId('edit-nazov').value.trim(), interne_cislo: byId('edit-interne').value.trim(), kategoria: byId('edit-kategoria').value.trim(), qr_kod: byId('edit-qr').value.trim() || item.qr_kod };
  await api(`/api/tools/${id}`, 'PUT', body);
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function generateNewToolQr(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const newQr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await api(`/api/tools/${id}`, 'PUT', { ...item, qr_kod: newQr, historie: [...(item.historie || []), { typ: 'qr', datum: new Date().toLocaleString('sk-SK'), popis: `Vygenerovaný nový QR: ${newQr}` }] });
  await loadBootstrap();
  otvorUpravu(id);
}

function stiahniQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const a = document.createElement('a');
  a.href = img;
  a.download = `${qr}.png`;
  a.click();
}

function vytlacitQr(qr) {
  const img = toolQrDataUrl(qr);
  if (!img) return alert('QR sa nepodarilo vygenerovať.');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img}" style="width:320px;height:320px;"></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function openToolActionModal(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const locations = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)} (${esc(l.typ)})</option>`).join('');
  if (mode === 'checkin') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Check-in / presun</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <select id="action-lokacia">${locations}</select>
        <textarea id="action-poznamka" placeholder="Poznámka / dôvod" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','checkin')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  } else if (mode === 'issue') {
    document.getElementById('edit-content').innerHTML = `
      <div class="detail-box">
        <h4>Nahlásiť problém</h4>
        <p><strong>${esc(item.nazov)}</strong></p>
        <input id="action-typ" value="Porucha" placeholder="Typ problému">
        <textarea id="action-poznamka" placeholder="Popis problému" rows="4" style="width:100%;"></textarea>
        <div class="row-actions">
          <button class="primary-btn" type="button" onclick="ulozAction('${item._id}','issue')">Uložiť</button>
          <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>`;
  }
  document.getElementById('edit-modal').style.display = 'flex';
}

async function ulozAction(id, mode) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const now = new Date().toLocaleString('sk-SK');
  if (mode === 'checkin') {
    const locId = byId('action-lokacia').value;
    const loc = data.locations.find(l => String(l._id) === String(locId));
    if (!loc) return alert('Vyber lokáciu.');
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      aktualna_lokacia_id: loc._id,
      aktualna_lokacia: loc.nazov,
      stav: 'na_stavbe',
      historie: [...(item.historie || []), { typ: 'checkin', datum: now, popis: `${actualUser?.meno || ''} -> ${loc.nazov}${note ? ` | ${note}` : ''}` }]
    });
    await api('/api/moves', 'POST', { naradie_id: item._id, z_lokacie: item.aktualna_lokacia || '-', do_lokacie: loc.nazov, datum_cas: now, kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' });
  } else if (mode === 'issue') {
    const typ = byId('action-typ').value.trim() || 'Problém';
    const note = byId('action-poznamka').value.trim();
    await api(`/api/tools/${id}`, 'PUT', {
      ...item,
      stav: 'oprava',
      poznamky: [...(item.poznamky || []), { typ, text: note, datum: now, autor: actualUser?.meno || '' }],
      historie: [...(item.historie || []), { typ: 'problém', datum: now, popis: `${typ}: ${note}` }]
    });
  }
  await loadBootstrap();
  zatvorModal('edit-modal');
}

async function pridajPoznamkuKNaradi(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Poznámka k náradiu:');
  if (!text) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, poznamky: [...(item.poznamky || []), { text, datum: new Date().toLocaleString('sk-SK'), autor: actualUser?.meno || '' }] });
  await loadBootstrap();
}

async function reportInspection(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const note = prompt('Záznam o kontrole / servise:');
  if (!note) return;
  await api(`/api/tools/${id}`, 'PUT', { ...item, udrzba: [...(item.udrzba || []), { datum: new Date().toLocaleString('sk-SK'), text: note, autor: actualUser?.meno || '' }], historie: [...(item.historie || []), { typ: 'udrzba', datum: new Date().toLocaleString('sk-SK'), popis: note }] });
  await loadBootstrap();
}

async function pridajNaradie() {
  if (actualUser?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      vlastnik_meno: '',
      historie: [{ typ: 'vytvorenie', datum: new Date().toLocaleString('sk-SK'), popis: 'Náradie vytvoril admin' }],
      poznamky: [],
      udrzba: []
    };
    await api('/api/tools', 'POST', body);
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file); else reader.onload({ target: { result: '' } });
}

async function pridajLokaciu() {
  if (actualUser?.rola !== 'admin') return alert('Lokácie môže pridávať iba admin.');
  const body = { nazov: byId('lokacia-nazov')?.value.trim(), typ: byId('lokacia-typ')?.value, adresa: byId('lokacia-adresa')?.value.trim(), veduci_meno: byId('lokacia-veduci')?.value.trim() };
  if (!body.nazov) return alert('Zadaj názov lokácie.');
  await api('/api/locations', 'POST', body);
  await loadBootstrap();
}

function otvorLokaciu(id) { const l = data.locations.find(x => String(x._id) === String(id)); const count = data.tools.filter(n => String(n.aktualna_lokacia_id) === String(id)).length; alert(`Lokácia: ${l?.nazov || ''}\nPočet náradia: ${count}`); }

async function upravUserPasswordAdmin(id) { const u = data.users.find(x => String(x._id) === String(id)); if (!u) return; const nove = prompt(`Zadaj nové heslo pre ${u.meno}:`); if (!nove) return; await api(`/api/users/${u._id}`, 'PUT', { ...u, heslo: nove }); await loadBootstrap(); }

async function getBackCameraDeviceId() { try { const devices = await Html5Qrcode.getCameras(); if (!devices || !devices.length) return null; const back = devices.find(d => { const label = (d.label || '').toLowerCase(); return label.includes('back') || label.includes('rear') || label.includes('environment'); }); return back ? back.id : devices[0].id; } catch { return null; } }
async function safeStopScanner() { try { if (qrScanner) { await qrScanner.stop(); await qrScanner.clear(); qrScanner = null; } } catch (e) { console.warn(e); } }

async function startScanner(mode) {
  await safeStopScanner();
  const elementId = mode === 'ranny' ? 'scanner-ranny' : mode === 'vecerny' ? 'scanner-vecerny' : mode === 'presun' ? 'scanner-presun' : mode === 'osobne' ? 'scanner-osobne' : 'scanner-vyhladavanie';
  const statusId = mode === 'ranny' ? 'ranny-scanner-status' : mode === 'vecerny' ? 'vecerny-scanner-status' : mode === 'presun' ? 'presun-scanner-status' : mode === 'osobne' ? 'osobne-scanner-status' : 'vyhladavanie-status';
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
  if (mode === 'osobne') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('Tento QR kód nepatrí žiadnemu existujúcemu náradiu.');
    if (osobneNaradieBuffer.some(i => i.qr_kod === item.qr_kod)) return alert('Toto náradie už je v zozname.');
    osobneNaradieBuffer.push({ _id: item._id, nazov: item.nazov, qr_kod: item.qr_kod });
    renderOsobneNaradie();
    if (byId('osobne-info')) byId('osobne-info').textContent = `Naskenované: ${osobneNaradieBuffer.length} kusov`;
    return;
  }
  if (mode === 'ranny') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    if (uzNaskenovaneRano.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneRano.add(item.qr_kod);
    rannySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    renderRannyZoznam();
    return;
  }
  if (mode === 'vecerny') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    if (uzNaskenovaneVecer.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneVecer.add(item.qr_kod);
    vecernySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    renderVecernyZoznam();
    return;
  }
  if (mode === 'presun') {
    const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
    if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');
    vybrateNaradieId = item._id;
    if (byId('info-presun')) byId('info-presun').textContent = `Vybraté náradie: ${item.nazov}`;
    if (byId('potvrdi-presun')) byId('potvrdi-presun').disabled = false;
    return;
  }
  if (mode === 'search') {
    if (byId('filter-qr')) byId('filter-qr').value = decodedText;
    if (byId('vyhladavanie-status')) byId('vyhladavanie-status').textContent = `Nájdené: ${decodedText}`;
    renderTools();
  }
}

function renderRannyZoznam() { const el = byId('ranny-zoznam'); if (!el) return; el.innerHTML = rannySkenList.length ? rannySkenList.map(i => `<div>${esc(i.nazov)} <button class="ghost-btn" onclick="odstranZRanneho('${esc(i.qr_kod)}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>'; }
function renderVecernyZoznam() { const el = byId('vecerny-zoznam'); if (!el) return; el.innerHTML = vecernySkenList.length ? vecernySkenList.map(i => `<div>${esc(i.nazov)} <button class="ghost-btn" onclick="odstranZVecerneho('${esc(i.qr_kod)}')">Odstrániť</button></div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>'; }
function odstranZRanneho(qr) { rannySkenList = rannySkenList.filter(i => i.qr_kod !== qr); uzNaskenovaneRano.delete(qr); renderRannyZoznam(); }
function odstranZVecerneho(qr) { vecernySkenList = vecernySkenList.filter(i => i.qr_kod !== qr); uzNaskenovaneVecer.delete(qr); renderVecernyZoznam(); }

function zrusRannySken() { safeStopScanner(); if (byId('scanner-ranny')) byId('scanner-ranny').style.display = 'none'; }
function zrusVecernySken() { safeStopScanner(); if (byId('scanner-vecerny')) byId('scanner-vecerny').style.display = 'none'; }
function zrusPresunSken() { safeStopScanner(); if (byId('scanner-presun')) byId('scanner-presun').style.display = 'none'; vybrateNaradieId = null; if (byId('potvrdi-presun')) byId('potvrdi-presun').disabled = true; }
function spustiVyhladavaciSken() { startScanner('search'); }

async function ulozRannySken() {
  const lokaciaId = byId('ranna-lokacia')?.value || byId('moj-stavba-select')?.value || localStorage.getItem('veduciLokaciaId') || '';
  if (!lokaciaId) return alert('Vyber stavbu.');
  await api('/api/scans', 'POST', { uzivatel: actualUser?.meno || '', lokacia_id: lokaciaId, lokacia_nazov: data.locations.find(l => String(l._id) === String(lokaciaId))?.nazov || '', typ: 'ranny_sken', data: [...rannySkenList], datum_cas: new Date().toLocaleString('sk-SK') });
  alert('Ranný sken uložený.');
  await loadBootstrap();
}

async function porovnajVecernySken() {
  const lokaciaId = byId('vecerna-lokacia')?.value || byId('moj-stavba-select')?.value || localStorage.getItem('veduciLokaciaId') || '';
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
  const move = { naradie_id: item._id, z_lokacie: oldLoc, do_lokacie: target.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser?.meno || '', stav_presunu: 'dorucene' };
  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', move);
  await loadBootstrap();
}

function zatvorModal(id) { if (byId(id)) byId(id).style.display = 'none'; }

document.addEventListener('DOMContentLoaded', async () => {
  const loginBtn = document.querySelector('#login-btn');
  if (loginBtn) loginBtn.addEventListener('click', prihlasSa);
  const meno = byId('login-meno');
  const heslo = byId('login-heslo');
  if (meno) meno.addEventListener('keydown', e => { if (e.key === 'Enter') prihlasSa(); });
  if (heslo) heslo.addEventListener('keydown', e => { if (e.key === 'Enter') prihlasSa(); });
  try { await loadBootstrap(); if (actualUser) showApp(); else showLogin(); showSection(currentSection); } catch (e) { console.error(e); showLogin(); alert('Nepodarilo sa načítať dáta zo servera.'); }
});