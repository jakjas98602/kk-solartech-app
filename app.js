let actualUser = null;
let data = { users: [], locations: [], tools: [], moves: [], scans: [] };
let qrScanner = null;
let qrMode = null;
let vybrateNaradieId = null;
let rannySkenList = [];
let vecernySkenList = [];
let osobneNaradieBuffer = [];
let uzNaskenovaneRano = new Set();
let uzNaskenovaneVecer = new Set();
let bootstrapLoaded = false;
let currentSection = 'home-section';

const byId = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function api(path, method = 'GET', body = null) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function isAdmin() {
  return actualUser?.rola === 'admin';
}

function isVeduci() {
  return actualUser?.rola === 'veduci_stavby';
}

function showLogin() {
  byId('login-screen').style.display = 'flex';
  byId('main-app').style.display = 'none';
}

function showApp() {
  byId('login-screen').style.display = 'none';
  byId('main-app').style.display = 'block';
  byId('meno-uzivatela').textContent = `${actualUser.meno} (${actualUser.rola})`;
  byId('admin-panel').style.display = isAdmin() ? 'block' : 'none';
}

function saveSession() {
  if (actualUser) localStorage.setItem('kk_user', JSON.stringify({ _id: actualUser._id, meno: actualUser.meno, rola: actualUser.rola }));
  else localStorage.removeItem('kk_user');
}

function prelozStatus(status) {
  return ({ dostupne: 'Dostupné', na_stavbe: 'Na stavbe', oprava: 'Oprava', stratene: 'Stratené', presunute: 'Presunuté' }[status] || status || 'Nezadané');
}

function toolQrDataUrl(text) {
  if (!text || typeof QRCode === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, String(text), { width: 260, margin: 2 });
    return canvas.toDataURL('image/png');
  } catch {
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
      ${img ? `<img src="${img}" alt="QR" class="qr-image">` : ''}
    </div>` : '';
}

async function loadBootstrap() {
  data = await api('/api/all');
  bootstrapLoaded = true;
  const saved = JSON.parse(localStorage.getItem('kk_user') || 'null');
  actualUser = saved ? data.users.find(u => String(u._id) === String(saved._id)) || null : null;
  renderAll();
}

function renderAll() {
  if (!actualUser) {
    showLogin();
    return;
  }
  showApp();
  renderStats();
  renderLocations();
  renderSelects();
  renderTools();
  renderHistory();
  renderHome();
  renderUsers();
  renderSkensOverview();
  showSection(currentSection);
}

async function prihlasSa() {
  await ensureBootstrap();
  const meno = (byId('login-meno').value || '').trim().toLowerCase();
  const heslo = byId('login-heslo').value || '';
  const u = data.users.find(x => String(x.meno).trim().toLowerCase() === meno && String(x.heslo) === heslo);
  if (!u) return alert('Nesprávne meno alebo heslo.');
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

function setActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const map = { 'home-section': 0, 'stavby-section': 1, 'sklady-section': 2, 'naradie-section': 3, 'presuny-section': 4, 'skeny-section': 5, 'nastavenia-section': 6 };
  const idx = map[sectionId];
  if (typeof idx === 'number') document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
}

function showSection(sectionId) {
  currentSection = sectionId;
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('visible'));
  byId(sectionId)?.classList.add('visible');
  setActiveNav(sectionId);
  if (sectionId === 'home-section') renderHome();
  if (sectionId === 'stavby-section') { renderLocations(); renderSelects(); renderStavbyAdminUi(); }
  if (sectionId === 'sklady-section') { renderLocations(); renderSelects(); renderSkladyAdminUi(); }
  if (sectionId === 'naradie-section') { renderTools(); renderSelects(); }
  if (sectionId === 'presuny-section') renderHistory();
  if (sectionId === 'skeny-section') { renderOsobneNaradie(); renderRannyZoznam(); renderVecernyZoznam(); renderSkensOverview(); }
  if (sectionId === 'nastavenia-section') renderSettings();
}

function currentUserLocation() {
  return data.locations.find(l => String(l._id) === String(actualUser?.stavba_id || '')) || null;
}

function renderStats() {
  byId('stat-lokacie').textContent = data.locations.length;
  byId('stat-naradie').textContent = data.tools.length;
  byId('stat-presuny').textContent = data.moves.length;
  byId('stat-skeny').textContent = data.scans.length;
}

function renderHome() {
  const loc = currentUserLocation();
  const myScanned = data.scans.filter(s => String(s.uzivatel || '').toLowerCase() === String(actualUser?.meno || '').toLowerCase()).reduce((sum, s) => sum + ((s.data || []).length || 0), 0);
  byId('home-naradie').textContent = myScanned;
  byId('home-stavba').textContent = loc ? loc.nazov : '-';
  byId('home-title').textContent = isAdmin() ? 'Administrátorský prehľad' : 'Prehľad stavby';
  byId('home-subtitle').textContent = isAdmin() ? 'Správa stavieb, skladov, náradia a pohybov.' : 'Tu uvidíš priradenú stavbu, skeny a presuny.';
  byId('moj-stav').innerHTML = loc ? `<strong>Aktuálna stavba:</strong> ${esc(loc.nazov)}<br><span class="small-muted">${esc(loc.adresa || '')}</span>` : 'Zatiaľ nie si priradený k žiadnej stavbe.';
  byId('home-actions').innerHTML = `
    <div class="row-actions">
      <button class="primary-btn" type="button" onclick="spustiRannySken()">Ranný sken</button>
      <button class="primary-btn" type="button" onclick="spustiVecernySken()">Večerný sken</button>
      <button class="ghost-btn" type="button" onclick="otvorPridanieOsobnehoNaradia()">Pridať náradie QR</button>
      <button class="ghost-btn" type="button" onclick="spustiPresunSken()">Presun náradia</button>
    </div>`;
}

function renderUsers() {
  const el = byId('zoznam-pouzivatelov');
  if (!el) return;
  el.innerHTML = isAdmin() ? data.users.map(u => `
    <div class="pouzitvatel-item">
      <strong>${esc(u.meno)}</strong> (${esc(u.rola)})<br>
      ${esc(u.email || '')}
    </div>`).join('') : '';
}

function renderLocations() {
  const el = byId('zoznam-lokacii');
  if (!el) return;
  el.innerHTML = data.locations.length ? data.locations.map(l => `
    <div class="lokacia-item">
      <strong>${esc(l.nazov)}</strong> <span class="badge">${esc(l.typ)}</span><br>
      ${esc(l.adresa || '')}
      <div class="small-muted">Náradie: ${data.tools.filter(t => String(t.aktualna_lokacia_id) === String(l._id)).length}</div>
      <div class="row-actions">
        <button class="ghost-btn" onclick="otvorLokaciu('${l._id}')">Detail</button>
      </div>
    </div>`).join('') : '<p>Žiadne lokácie.</p>';
}

function renderSelects() {
  const opts = data.locations.map(l => `<option value="${l._id}">${esc(l.nazov)}</option>`).join('');
  if (byId('filter-lokacia')) byId('filter-lokacia').innerHTML = `<option value="">Všetky lokácie</option>${opts}`;
  ['aktualna-lokacia', 'ciel-lokacia', 'moj-stavba-select'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.innerHTML = `<option value="">Vyber lokáciu</option>${id === 'moj-stavba-select' ? data.locations.filter(l => l.typ === 'stavba').map(l => `<option value="${l._id}">${esc(l.nazov)}</option>`).join('') : opts}`;
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
    const hay = `${n.nazov || ''} ${n.qr_kod || ''} ${n.kategoria || ''} ${n.interne_cislo || ''}`.toLowerCase();
    return (!q || hay.includes(q)) && (!qr || String(n.qr_kod || '').toLowerCase().includes(qr)) && (!st || n.stav === st) && (!loc || String(n.aktualna_lokacia_id) === String(loc));
  });
  el.innerHTML = list.length ? list.map(n => `
    <div class="naradie-item">
      <strong>${esc(n.nazov)}</strong> <span class="badge">${esc(prelozStatus(n.stav))}</span><br>
      QR: ${esc(n.qr_kod)}<br>
      <div class="row-actions">
        <button class="ghost-btn" onclick="otvorDetail('${n._id}')">Detail</button>
        <button class="ghost-btn" onclick="otvorUpravu('${n._id}')">Upraviť</button>
      </div>
    </div>`).join('') : '<p>Žiadne náradie nespĺňa filter.</p>';
}

function renderHistory() {
  const el = byId('zoznam-presunov');
  if (!el) return;
  el.innerHTML = data.moves.length ? data.moves.slice().reverse().map(p => `
    <div class="history-item">
      <strong>${esc(p.datum_cas || '')}</strong><br>
      ${esc(p.kto_spravil || '')} presunul náradie <strong>${esc(p.nazov_naradia || p.qr_kod || '-')}</strong>
      z <strong>${esc(p.z_lokacie || '-')}</strong> do <strong>${esc(p.do_lokacie || '-')}</strong>
    </div>`).join('') : '<p>Žiadna história presunov.</p>';
}

function renderSettings() {
  if (byId('moj-stav')) byId('moj-stav').innerHTML = currentUserLocation() ? `<strong>Aktuálna stavba:</strong> ${esc(currentUserLocation().nazov)}` : 'Zatiaľ nie si priradený k žiadnej stavbe.';
}

async function ensureBootstrap() {
  if (!bootstrapLoaded) await loadBootstrap();
}

async function zmenHeslo() {
  const me = data.users.find(u => String(u._id) === String(actualUser?._id));
  if (!me) return;
  if (me.heslo !== byId('stare-heslo').value) return alert('Staré heslo nesedí.');
  if (byId('nove-heslo-zmena').value !== byId('potvrdit-heslo-zmena').value) return alert('Heslá sa nezhodujú.');
  await api(`/api/users/${me._id}`, 'PUT', { ...me, heslo: byId('nove-heslo-zmena').value });
  alert('Heslo bolo zmenené.');
  await loadBootstrap();
}

async function pridajSaNaStavbu() {
  const loc = byId('moj-stavba-select').value;
  if (!loc) return alert('Vyber stavbu.');
  await api(`/api/users/${actualUser._id}`, 'PUT', { ...actualUser, stavba_id: loc });
  actualUser.stavba_id = loc;
  saveSession();
  await loadBootstrap();
  alert('Bol si priradený k stavbe.');
}

function otvorLokaciu(id) {
  const l = data.locations.find(x => String(x._id) === String(id));
  if (!l) return;
  const tools = data.tools.filter(n => String(n.aktualna_lokacia_id) === String(id));
  byId('detail-content').innerHTML = `
    <div class="detail-box">
      <h4>${esc(l.nazov)}</h4>
      <p><strong>Typ:</strong> ${esc(l.typ)}</p>
      <p><strong>Adresa:</strong> ${esc(l.adresa || '-')}</p>
      <div class="card">
        <strong>Náradie na tejto lokácii</strong>
        <div class="tools-grid">
          ${tools.map(t => {
            const qrImg = toolQrDataUrl(t.qr_kod);
            return `<div class="tool-card"><strong>${esc(t.nazov)}</strong><div>QR: ${esc(t.qr_kod)}</div>${qrImg ? `<img src="${qrImg}" class="qr-image" alt="QR">` : ''}</div>`;
          }).join('') || '<p>Žiadne náradie</p>'}
        </div>
      </div>
    </div>`;
  byId('detail-modal').style.display = 'flex';
}

async function otvorPridanieOsobnehoNaradia() {
  osobneNaradieBuffer = [];
  byId('scanner-osobne').style.display = 'block';
  byId('osobne-info').textContent = 'Skenuj QR kódy náradia.';
  await startScanner('osobne');
}

function renderOsobneNaradie() {
  const el = byId('osobne-zoznam');
  if (!el) return;
  el.innerHTML = osobneNaradieBuffer.length ? osobneNaradieBuffer.map((i, idx) => `
    <div class="naradie-item">
      <strong>${esc(i.nazov)}</strong><br>
      QR: ${esc(i.qr_kod)}
      <div class="row-actions">
        <button class="ghost-btn" onclick="odstranOsobneNaradie(${idx})">Odstrániť</button>
      </div>
    </div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>';
}

function odstranOsobneNaradie(index) {
  osobneNaradieBuffer.splice(index, 1);
  renderOsobneNaradie();
}

async function potvrdiOsobneNaradie() {
  if (!osobneNaradieBuffer.length) return alert('Najprv naskenuj aspoň jedno náradie.');
  const loc = currentUserLocation();
  if (!loc) return alert('Najprv si priraď stavbu.');
  for (const item of osobneNaradieBuffer) {
    const tool = data.tools.find(t => String(t._id) === String(item._id));
    if (!tool) continue;
    await api(`/api/tools/${tool._id}`, 'PUT', { ...tool, vlastnik_meno: actualUser.meno, aktualna_lokacia_id: loc._id, aktualna_lokacia: loc.nazov, stav: 'na_stavbe' });
  }
  osobneNaradieBuffer = [];
  renderOsobneNaradie();
  await loadBootstrap();
}

async function pridajNaradie() {
  const file = byId('fotka-sitku')?.files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await api('/api/tools', 'POST', {
      nazov: byId('naradie-nazov').value.trim(),
      interne_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: file ? e.target.result : '',
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr
    });
    renderQrPreview('qr-container', qr);
    await loadBootstrap();
  };
  if (file) reader.readAsDataURL(file);
  else reader.onload({ target: { result: '' } });
}

function otvorDetail(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const qrImg = toolQrDataUrl(item.qr_kod);
  byId('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${esc(item.nazov)}</p>
      <p><strong>QR text:</strong> ${esc(item.qr_kod)}</p>
      <p><strong>Interné číslo:</strong> ${esc(item.interne_cislo || '-')}</p>
      <p><strong>Kategória:</strong> ${esc(item.kategoria || '-')}</p>
      <p><strong>Stav:</strong> ${esc(prelozStatus(item.stav))}</p>
      <p><strong>Lokácia:</strong> ${esc(item.aktualna_lokacia || '-')}</p>
      ${qrImg ? `<img src="${qrImg}" class="qr-image" alt="QR">` : ''}
    </div>`;
  byId('detail-modal').style.display = 'flex';
}

function otvorUpravu(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  byId('edit-content').innerHTML = `
    <div class="detail-box">
      <h4>Upraviť náradie</h4>
      <input id="edit-nazov" value="${esc(item.nazov || '')}">
      <input id="edit-interne" value="${esc(item.interne_cislo || '')}">
      <input id="edit-kategoria" value="${esc(item.kategoria || '')}">
      <input id="edit-qr" value="${esc(item.qr_kod || '')}">
      <div class="row-actions">
        <button class="primary-btn" type="button" onclick="ulozitUpravuNaradia('${item._id}')">Uložiť</button>
        <button class="ghost-btn" type="button" onclick="zatvorModal('edit-modal')">Zavrieť</button>
      </div>
    </div>`;
  byId('edit-modal').style.display = 'flex';
}

async function ulozitUpravuNaradia(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  await api(`/api/tools/${id}`, 'PUT', {
    ...item,
    nazov: byId('edit-nazov').value.trim(),
    interne_cislo: byId('edit-interne').value.trim(),
    kategoria: byId('edit-kategoria').value.trim(),
    qr_kod: byId('edit-qr').value.trim() || item.qr_kod
  });
  await loadBootstrap();
  zatvorModal('edit-modal');
}

function stiahniQr(qr) {
  const img = toolQrDataUrl(qr);
  const a = document.createElement('a');
  a.href = img;
  a.download = `${qr}.png`;
  a.click();
}

function vytlacitQr(qr) {
  const img = toolQrDataUrl(qr);
  const w = window.open('', '_blank');
  w.document.write(`<img src="${img}" style="width:320px;height:320px;">`);
  w.document.close();
  w.print();
}

function zatvorModal(id) {
  byId(id).style.display = 'none';
}

async function safeStopScanner() {
  try {
    if (qrScanner) {
      await qrScanner.stop();
      await qrScanner.clear();
      qrScanner = null;
    }
  } catch {}
}

function zrusScanner() {
  safeStopScanner();
  ['scanner-ranny', 'scanner-vecerny', 'scanner-presun', 'scanner-osobne', 'scanner-vyhladavanie'].forEach(id => {
    const el = byId(id);
    if (el) el.style.display = 'none';
  });
  qrMode = null;
}

async function getBackCameraDeviceId() {
  try {
    const devices = await Html5Qrcode.getCameras();
    if (!devices || !devices.length) return null;
    const back = devices.find(d => (d.label || '').toLowerCase().includes('back') || (d.label || '').toLowerCase().includes('rear') || (d.label || '').toLowerCase().includes('environment'));
    return back ? back.id : devices[0].id;
  } catch {
    return null;
  }
}

async function startScanner(mode) {
  await safeStopScanner();
  const elementId = mode === 'ranny' ? 'ranny-scanner-reader' : mode === 'vecerny' ? 'vecerny-scanner-reader' : mode === 'presun' ? 'presun-scanner-reader' : mode === 'osobne' ? 'osobne-scanner-reader' : 'vyhladavanie-scanner-reader';
  const statusId = mode === 'ranny' ? 'ranny-scanner-status' : mode === 'vecerny' ? 'vecerny-scanner-status' : mode === 'presun' ? 'presun-scanner-status' : mode === 'osobne' ? 'osobne-scanner-status' : 'vyhladavanie-status';
  const wrapper = byId(elementId);
  const status = byId(statusId);
  if (!wrapper) return;

  wrapper.innerHTML = '';
  wrapper.style.minHeight = '320px';

  const scanner = new Html5Qrcode(elementId);
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  try {
    if (status) status.textContent = 'Pripravujem kameru...';
    try {
      await scanner.start({ facingMode: { exact: 'environment' } }, config, text => onScanSuccess(text, mode), () => {});
    } catch {
      const camId = await getBackCameraDeviceId();
      if (!camId) throw new Error('Nie je dostupná kamera.');
      await scanner.start({ deviceId: { exact: camId } }, config, text => onScanSuccess(text, mode), () => {});
    }
    qrScanner = scanner;
    qrMode = mode;
    if (status) status.textContent = 'Kamera je spustená.';
  } catch (e) {
    if (status) status.textContent = `Kamera sa nepodarilo spustiť: ${e?.message || e}`;
    wrapper.innerHTML = `<div class="info-box">Kamera sa nepodarilo spustiť.</div>`;
  }
}

function onScanSuccess(decodedText, mode) {
  const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
  if (!item) return;

  if (mode === 'osobne') {
    if (osobneNaradieBuffer.some(i => i.qr_kod === item.qr_kod)) return;
    osobneNaradieBuffer.push({ _id: item._id, nazov: item.nazov, qr_kod: item.qr_kod });
    renderOsobneNaradie();
    return;
  }

  if (mode === 'ranny') {
    if (uzNaskenovaneRano.has(item.qr_kod)) return;
    uzNaskenovaneRano.add(item.qr_kod);
    rannySkenList.push({ _id: item._id, qr_kod: item.qr_kod, nazov: item.nazov });
    renderRannyZoznam();
    return;
  }

  if (mode === 'vecerny') {
    if (uzNaskenovaneVecer.has(item.qr_kod)) return;
    uzNaskenovaneVecer.add(item.qr_kod);
    vecernySkenList.push({ _id: item._id, qr_kod: item.qr_kod, nazov: item.nazov });
    renderVecernyZoznam();
    return;
  }

  if (mode === 'presun') {
    vybrateNaradieId = item._id;
    byId('info-presun').textContent = `Vybraté náradie: ${item.nazov}`;
    byId('potvrdi-presun').disabled = false;
    return;
  }

  if (mode === 'search') {
    byId('filter-qr').value = decodedText;
    renderTools();
  }
}

function renderRannyZoznam() {
  const el = byId('ranny-zoznam');
  if (el) el.innerHTML = rannySkenList.length ? rannySkenList.map(i => `<div>${esc(i.nazov)}</div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>';
  renderSkensOverview();
}

function renderVecernyZoznam() {
  const el = byId('vecerny-zoznam');
  if (el) el.innerHTML = vecernySkenList.length ? vecernySkenList.map(i => `<div>${esc(i.nazov)}</div>`).join('') : '<p class="muted">Zatiaľ nič naskenované.</p>';
  renderSkensOverview();
}

function renderSkensOverview() {
  if (byId('ranny-info')) byId('ranny-info').textContent = `Naskenované: ${rannySkenList.length}`;
  if (byId('vecerny-info')) byId('vecerny-info').textContent = `Naskenované: ${vecernySkenList.length}`;
}

function spustiRannySken() {
  zrusScanner();
  byId('scanner-ranny').style.display = 'block';
  startScanner('ranny');
}

function spustiVecernySken() {
  zrusScanner();
  byId('scanner-vecerny').style.display = 'block';
  startScanner('vecerny');
}

function spustiPresunSken() {
  zrusScanner();
  byId('scanner-presun').style.display = 'block';
  startScanner('presun');
}

function spustiVyhladavaciSken() {
  zrusScanner();
  byId('scanner-vyhladavanie').style.display = 'block';
  startScanner('search');
}

function zrusRannySken() { zrusScanner(); }
function zrusVecernySken() { zrusScanner(); }
function zrusPresunSken() { zrusScanner(); vybrateNaradieId = null; byId('potvrdi-presun').disabled = true; }
function zrusPridavanieOsobnehoNadia() { zrusScanner(); }

async function ulozRannySken() {
  const locId = actualUser?.stavba_id || '';
  if (!locId) return alert('Najprv si priraď stavbu.');
  await api('/api/scans', 'POST', { uzivatel: actualUser.meno, lokacia_id: locId, lokacia_nazov: currentUserLocation()?.nazov || '', typ: 'ranny_sken', data: rannySkenList, datum_cas: new Date().toLocaleString('sk-SK') });
  alert('Ranný sken uložený.');
  await loadBootstrap();
}

async function porovnajVecernySken() {
  const locId = actualUser?.stavba_id || '';
  if (!locId) return alert('Najprv si priraď stavbu.');
  const chybajuce = rannySkenList.filter(i => !vecernySkenList.some(v => v.qr_kod === i.qr_kod));
  if (chybajuce.length) return alert('Chýba náradie:\n' + chybajuce.map(i => i.nazov).join('\n'));
  await api('/api/scans', 'POST', { uzivatel: actualUser.meno, lokacia_id: locId, lokacia_nazov: currentUserLocation()?.nazov || '', typ: 'vecerny_sken', data: vecernySkenList, datum_cas: new Date().toLocaleString('sk-SK') });
  alert('Večerný sken je v poriadku.');
  await loadBootstrap();
}

async function potvrdiPresun() {
  const cielId = byId('ciel-lokacia').value;
  if (!vybrateNaradieId) return alert('Najprv naskenuj náradie.');
  const target = data.locations.find(l => String(l._id) === String(cielId));
  const item = data.tools.find(n => String(n._id) === String(vybrateNaradieId));
  if (!target || !item) return alert('Chýba lokácia alebo náradie.');
  const oldLoc = item.aktualna_lokacia || '-';
  await api(`/api/tools/${item._id}`, 'PUT', { ...item, aktualna_lokacia_id: target._id, aktualna_lokacia: target.nazov, stav: 'presunute' });
  await api('/api/moves', 'POST', { naradie_id: item._id, nazov_naradia: item.nazov, qr_kod: item.qr_kod, z_lokacie: oldLoc, do_lokacie: target.nazov, datum_cas: new Date().toLocaleString('sk-SK'), kto_spravil: actualUser.meno, stav_presunu: 'dorucene', typ: 'presun' });
  alert('Presun uložený.');
  await loadBootstrap();
}

function renderStavbyAdminUi() {
  const box = byId('stavby-admin-box');
  if (box) box.innerHTML = isAdmin() ? `
    <h3>Pridať stavbu</h3>
    <input id="stavba-nazov" type="text" placeholder="Názov stavby" />
    <input id="stavba-adresa" type="text" placeholder="Adresa" />
    <button class="primary-btn" type="button" onclick="pridajStavbu()">Pridať stavbu</button>
  ` : '';
}

function renderSkladyAdminUi() {
  const box = byId('sklady-admin-box');
  if (box) box.innerHTML = isAdmin() ? `
    <h3>Pridať sklad</h3>
    <input id="sklad-nazov" type="text" placeholder="Názov skladu" />
    <input id="sklad-adresa" type="text" placeholder="Adresa" />
    <button class="primary-btn" type="button" onclick="pridajSklad()">Pridať sklad</button>
  ` : '';
}

async function pridajStavbu() {
  await api('/api/locations', 'POST', { nazov: byId('stavba-nazov').value.trim(), typ: 'stavba', adresa: byId('stavba-adresa').value.trim() });
  await loadBootstrap();
}

async function pridajSklad() {
  await api('/api/locations', 'POST', { nazov: byId('sklad-nazov').value.trim(), typ: 'sklad', adresa: byId('sklad-adresa').value.trim() });
  await loadBootstrap();
}

document.addEventListener('DOMContentLoaded', async () => {
  byId('login-btn').addEventListener('click', prihlasSa);
  try {
    await loadBootstrap();
    if (actualUser) showApp();
    else showLogin();
  } catch {
    showLogin();
  }
});