const API = '';

let aktualnyUzivatel = null;
let data = { users: [], locations: [], tools: [], moves: [], scans: [] };
let pendingScanCode = null;
let lastQrCanvas = null;
let lastQrText = '';
let rannySkenList = [];
let vecernySkenList = [];
let uzNaskenovaneRano = new Set();
let uzNaskenovaneVecer = new Set();
let vybrateNaradieId = null;
let scannerInstance = null;
let scannerMode = null;

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
  return (
    {
      dostupne: 'Dostupné',
      na_stavbe: 'Na stavbe',
      oprava: 'Oprava',
      stratene: 'Stratené',
      presunute: 'Presunuté'
    }[status] || status || 'Nezadané'
  );
}

function showLogin() {
  byId('login-screen').style.display = 'flex';
  byId('main-app').style.display = 'none';
}

function showApp() {
  byId('login-screen').style.display = 'none';
  byId('main-app').style.display = 'block';
  if (aktualnyUzivatel) {
    byId('meno-uzivatela').textContent = `${aktualnyUzivatel.meno} (${aktualnyUzivatel.rola})`;
  }
}

function saveSession() {
  localStorage.setItem('aktualnyUzivatel', JSON.stringify(aktualnyUzivatel));
}

async function loadBootstrap() {
  data = await api('/api/all');
  aktualnyUzivatel = JSON.parse(localStorage.getItem('aktualnyUzivatel') || 'null');
  if (!aktualnyUzivatel && data.users.length) {
    aktualnyUzivatel = data.users.find(u => u.rola === 'admin') || data.users[0];
  }
  renderAll();
}

async function prihlasSa() {
  const meno = byId('login-meno').value.trim();
  const heslo = byId('login-heslo').value;
  const u = data.users.find(x => x.meno === meno && x.heslo === heslo);
  if (!u) return alert('Nesprávne meno alebo heslo');
  aktualnyUzivatel = u;
  saveSession();
  showApp();
  renderAll();
}

async function odhlasSa() {
  aktualnyUzivatel = null;
  localStorage.removeItem('aktualnyUzivatel');
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
  el.innerHTML = data.users.length
    ? data.users
        .map(
          u => `<div class="pouzitvatel-item"><strong>${u.meno}</strong> (${u.rola})<br>${u.email || ''}</div>`
        )
        .join('')
    : '<p>Žiadni používatelia.</p>';
}

function renderLocations() {
  const el = byId('zoznam-lokacii');
  if (!el) return;
  el.innerHTML = data.locations.length
    ? data.locations
        .map(l => {
          const tools = data.tools.filter(t => String(t.aktualna_lokacia_id) === String(l._id));
          return `
            <div class="lokacia-item">
              <strong>${l.nazov}</strong> <span class="badge">${l.typ}</span><br>
              ${l.adresa || ''}
              <div class="small-muted">Vedúci: ${l.veduci_meno || '-'}</div>
              <div class="small-muted">Náradie: ${tools.length}</div>
              <div class="row-actions">
                <button class="ghost-btn" onclick="otvorLokaciu('${l._id}')">Otvoriť</button>
              </div>
            </div>
          `;
        })
        .join('')
    : '<p>Žiadne lokácie.</p>';
}

function renderSelects() {
  const opts = data.locations.map(l => `<option value="${l._id}">${l.nazov}</option>`).join('');
  [
    'aktualna-lokacia',
    'ciel-lokacia',
    'ranna-lokacia',
    'vecerna-lokacia',
    'veduci-aktualna-lokacia',
    'filter-lokacia'
  ].forEach(id => {
    const el = byId(id);
    if (!el) return;
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
    const hay = `${n.nazov} ${n.qr_kod} ${n.kategoria || ''} ${n.interné_cislo || ''}`.toLowerCase();
    return (
      (!q || hay.includes(q)) &&
      (!qr || String(n.qr_kod).toLowerCase().includes(qr)) &&
      (!st || n.stav === st) &&
      (!loc || String(n.aktualna_lokacia_id) === String(loc))
    );
  });

  el.innerHTML = list.length
    ? list
        .map(
          n => `
            <div class="naradie-item">
              <strong>${n.nazov}</strong> <span class="badge">✓ ${prelozStatus(n.stav)}</span><br>
              QR: ${n.qr_kod}<br>
              Interné číslo: ${n.interné_cislo || '-'}<br>
              Kategória: ${n.kategoria || '-'}<br>
              <div class="lokacia-label">
                Nachádza sa: <strong>${n.aktualna_lokacia || '-'}</strong>
              </div>
              <div class="row-actions">
                <button class="ghost-btn" onclick="otvorDetail('${n._id}')">Detail</button>
                <button class="ghost-btn" onclick="otvorUpravu('${n._id}')">Upraviť</button>
                <button class="ghost-btn" onclick="exportNaradiePdf('${n._id}')">PDF</button>
              </div>
              ${n.fotka_sitku ? `<img src="${n.fotka_sitku}" alt="Fotka štítku">` : ''}
            </div>
          `
        )
        .join('')
    : '<p>Žiadne náradie nespĺňa filter.</p>';
}

function renderHistory() {
  const el = byId('zoznam-presunov');
  if (!el) return;
  el.innerHTML = data.moves.length
    ? data.moves
        .slice()
        .reverse()
        .map(
          p => `
            <div class="history-item">
              <strong>${p.datum_cas || ''}</strong><br>
              ${p.kto_spravil || ''} presunul náradie z <strong>${p.z_lokacie || '-'}</strong> do <strong>${p.do_lokacie || '-'}</strong>
            </div>
          `
        )
        .join('')
    : '<p>Žiadna história presunov.</p>';
}

function renderAdmin() {
  if (byId('admin-panel')) byId('admin-panel').style.display = aktualnyUzivatel?.rola === 'admin' ? 'block' : 'none';
  if (byId('veduci-panel')) byId('veduci-panel').style.display = 'block';
  if (aktualnyUzivatel?.rola === 'admin') renderUsers();
}

function renderAll() {
  if (!aktualnyUzivatel) {
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
  if (aktualnyUzivatel?.rola !== 'admin') return alert('Nemáš oprávnenie.');
  const body = {
    meno: byId('nove-meno').value.trim(),
    email: byId('novy-email').value.trim(),
    heslo: byId('nove-heslo').value,
    rola: byId('nova-rola').value
  };
  if (!body.meno || !body.heslo) return alert('Zadaj meno a heslo.');
  await api('/api/users', 'POST', body);
  await loadBootstrap();
}

async function pridajLokaciu() {
  if (aktualnyUzivatel?.rola !== 'admin') return alert('Lokácie môže pridávať iba admin.');
  const body = {
    nazov: byId('lokacia-nazov').value.trim(),
    typ: byId('lokacia-typ').value,
    adresa: byId('lokacia-adresa').value.trim(),
    veduci_meno: byId('lokacia-veduci').value.trim()
  };
  if (!body.nazov) return alert('Zadaj názov lokácie.');
  await api('/api/locations', 'POST', body);
  await loadBootstrap();
}

async function pridajNaradie() {
  if (aktualnyUzivatel?.rola !== 'admin') return alert('Náradie môže pridávať iba admin.');
  const file = byId('fotka-sitku').files[0];
  if (!file) return alert('Fotka štítku je povinná.');

  const reader = new FileReader();
  reader.onload = async e => {
    const loc = data.locations.find(l => String(l._id) === String(byId('aktualna-lokacia').value));
    const qr = `QR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const body = {
      nazov: byId('naradie-nazov').value.trim(),
      interné_cislo: byId('naradie-cislo').value.trim(),
      kategoria: byId('naradie-kategoria').value.trim(),
      fotka_sitku: e.target.result,
      aktualna_lokacia_id: loc?._id || '',
      aktualna_lokacia: loc?.nazov || '',
      stav: 'dostupne',
      qr_kod: qr,
      historie: [
        {
          typ: 'vytvorenie',
          datum: new Date().toLocaleString('sk-SK'),
          popis: 'Náradie vytvoril admin'
        }
      ],
      poznamky: [],
      udrzba: []
    };

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
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-box">
      <p><strong>Názov:</strong> ${item.nazov}</p>
      <p><strong>QR:</strong> ${item.qr_kod}</p>
      <p><strong>Interné číslo:</strong> ${item.interné_cislo || '-'}</p>
      <p><strong>Kategória:</strong> ${item.kategoria || '-'}</p>
      <p><strong>Stav:</strong> ✓ ${prelozStatus(item.stav)}</p>
      <p><strong>Lokácia:</strong> ${item.aktualna_lokacia || '-'}</p>
      <div class="row">
        <button class="primary-btn" onclick="presunNaStavbuZDetailu('${item._id}')">✓ Presun na stavbu</button>
        <button class="primary-btn" onclick="otvorUpravu('${item._id}')">Upraviť</button>
        <button class="ghost-btn" onclick="exportNaradiePdf('${item._id}')">PDF</button>
        <button class="ghost-btn" onclick="zatvorModal('detail-modal')">Zavrieť</button>
      </div>
    </div>
  `;
  document.getElementById('detail-modal').style.display = 'flex';
}

async function presunNaradieNaLokaciu(id, lokaciaId, novyStatus) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const loc = data.locations.find(l => String(l._id) === String(lokaciaId));
  if (!loc) return alert('Lokácia sa nenašla.');

  const old = item.aktualna_lokacia || '-';
  const update = {
    aktualna_lokacia_id: loc._id,
    aktualna_lokacia: loc.nazov,
    stav: novyStatus,
    historie: [
      ...(item.historie || []),
      {
        typ: 'presun',
        datum: new Date().toLocaleString('sk-SK'),
        popis: `Presun z ${old} do ${loc.nazov}`
      }
    ]
  };

  const move = {
    naradie_id: item._id,
    z_lokacie: old,
    do_lokacie: loc.nazov,
    datum_cas: new Date().toLocaleString('sk-SK'),
    kto_spravil: aktualnyUzivatel?.meno || '',
    stav_presunu: 'dorucene'
  };

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
  document.getElementById('edit-content').innerHTML = `
    <div class="detail-box">
      <p><strong>${item.nazov}</strong></p>
      <div class="edit-actions">
        <button class="ghost-btn" onclick="presunASet('${item._id}', 'na_stavbe')">✓ Presun na stavbu</button>
        <button class="ghost-btn" onclick="presunASet('${item._id}', 'dostupne')">✓ Presun do skladu</button>
        <button class="ghost-btn" onclick="presunASet('${item._id}', 'oprava')">✓ Presun do opravy</button>
        <button class="ghost-btn" onclick="oznacAkoStratene('${item._id}')">✓ Stratené</button>
        <button class="ghost-btn" onclick="pridajPoznamku('${item._id}')">✓ Poznámka</button>
      </div>
      <div class="edit-form">
        <label>Vyber cieľovú lokáciu</label>
        <select id="edit-lokacia">${opts}</select>
        <div class="row">
          <button class="primary-btn" onclick="presunPodlaVyberu('${item._id}')">Potvrdiť presun</button>
          <button class="ghost-btn" onclick="zatvorModal('edit-modal')">Zavrieť</button>
        </div>
      </div>
    </div>
  `;
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
  api(`/api/tools/${item._id}`, 'PUT', {
    ...item,
    stav: 'stratene',
    historie: [
      ...(item.historie || []),
      {
        typ: 'status',
        datum: new Date().toLocaleString('sk-SK'),
        popis: 'Označené ako stratené'
      }
    ]
  }).then(loadBootstrap);
}

function pridajPoznamku(id) {
  const item = data.tools.find(n => String(n._id) === String(id));
  if (!item) return;
  const text = prompt('Zadaj poznámku:');
  if (!text) return;
  api(`/api/tools/${item._id}`, 'PUT', {
    ...item,
    poznamky: [
      ...(item.poznamky || []),
      {
        datum: new Date().toLocaleString('sk-SK'),
        text,
        autor: aktualnyUzivatel?.meno || ''
      }
    ],
    historie: [
      ...(item.historie || []),
      {
        typ: 'poznámka',
        datum: new Date().toLocaleString('sk-SK'),
        popis: text
      }
    ]
  }).then(loadBootstrap);
}

function zatvorModal(id) {
  byId(id).style.display = 'none';
}

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
  doc.text(`Interné číslo: ${item.interné_cislo || '-'}`, 14, y); y += 7;
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
    if (y > 280) {
      doc.addPage();
      y = 14;
    }
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
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    doc.setFontSize(14);
    doc.text(veduci, 14, y);
    y += 7;

    items.forEach(({ item, loc }) => {
      const text = `- ${item.nazov} | ${prelozStatus(item.stav)} | ${loc?.nazov || item.aktualna_lokacia || '-'}`;
      const lines = doc.splitTextToSize(text, 180);
      doc.setFontSize(10);
      doc.text(lines, 18, y);
      y += lines.length * 5 + 2;
      if (y > 280) {
        doc.addPage();
        y = 14;
      }
    });

    y += 4;
  });

  doc.save('export_naradia_podla_veducich.pdf');
}

async function getBackCameraDeviceId() {
  try {
    const devices = await Html5Qrcode.getCameras();
    if (!devices || !devices.length) return null;
    const back = devices.find(d => {
      const label = (d.label || '').toLowerCase();
      return label.includes('back') || label.includes('rear') || label.includes('environment');
    });
    return back ? back.id : devices[0].id;
  } catch {
    return null;
  }
}

async function safeStopScanner() {
  try {
    if (scannerInstance) {
      await scannerInstance.stop();
      await scannerInstance.clear();
      scannerInstance = null;
    }
  } catch (e) {
    console.warn(e);
  }
}

async function startScanner(mode) {
  await safeStopScanner();

  const elementId =
    mode === 'ranny'
      ? 'scanner-ranny'
      : mode === 'vecerny'
      ? 'scanner-vecerny'
      : 'scanner-presun';

  const statusId =
    mode === 'ranny'
      ? 'ranny-scanner-status'
      : mode === 'vecerny'
      ? 'vecerny-scanner-status'
      : 'presun-scanner-status';

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
      await scanner.start(
        { facingMode: { exact: 'environment' } },
        config,
        decodedText => onScanSuccess(decodedText, mode),
        () => {}
      );
    } catch (e1) {
      const camId = await getBackCameraDeviceId();
      if (!camId) throw e1;
      await scanner.start({ deviceId: { exact: camId } }, config, decodedText => onScanSuccess(decodedText, mode), () => {});
    }

    scannerInstance = scanner;
    scannerMode = mode;
    if (status) status.textContent = 'Kamera je spustená.';
  } catch (e) {
    console.error(e);
    if (status) status.textContent = `Nejde spustiť kameru: ${e?.message || e}`;
    wrapper.innerHTML = `<div class="info-box">Nejde spustiť kameru. ${e?.message || e}</div>`;
  }
}

function onScanSuccess(decodedText, mode) {
  pendingScanCode = decodedText;
  const statusId =
    mode === 'ranny'
      ? 'ranny-scanner-status'
      : mode === 'vecerny'
      ? 'vecerny-scanner-status'
      : 'presun-scanner-status';

  const status = byId(statusId);
  if (status) status.textContent = `Nájdený QR: ${decodedText}`;

  const qrInput = byId('filter-qr');
  if (qrInput) {
    qrInput.value = decodedText;
    renderTools();
  }

  if (mode === 'presun') spracujSken(decodedText, mode);
}

function spracujSken(decodedText, mode) {
  const item = data.tools.find(n => n.qr_kod === decodedText || String(n._id) === decodedText);
  if (!item) return alert('QR kód nepatrí žiadnemu náradiu.');

  if (mode === 'ranny') {
    if (uzNaskenovaneRano.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneRano.add(item.qr_kod);
    rannySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    item.historie = item.historie || [];
    item.historie.push({
      typ: 'ranny_sken',
      datum: new Date().toLocaleString('sk-SK'),
      popis: 'Ranný sken'
    });
    api(`/api/tools/${item._id}`, 'PUT', item).then(loadBootstrap);
    renderRannyZoznam();
    return;
  }

  if (mode === 'vecerny') {
    if (uzNaskenovaneVecer.has(item.qr_kod)) return alert('Toto náradie už bolo naskenované.');
    uzNaskenovaneVecer.add(item.qr_kod);
    vecernySkenList.push({ qr_kod: item.qr_kod, nazov: item.nazov });
    item.historie = item.historie || [];
    item.historie.push({
      typ: 'vecerny_sken',
      datum: new Date().toLocaleString('sk-SK'),
      popis: 'Nočný sken'
    });
    api(`/api/tools/${item._id}`, 'PUT', item).then(loadBootstrap);
    renderVecernyZoznam();
    return;
  }

  if (mode === 'presun') {
    vybrateNaradieId = item._id;
    const btn = byId('potvrdi-presun');
    if (btn) btn.disabled = false;
    const info = byId('info-presun');
    if (info) info.textContent = `Vybraté náradie: ${item.nazov}`;
  }
}

function renderRannyZoznam() {
  const el = byId('ranny-zoznam');
  if (!el) return;
  el.innerHTML = rannySkenList.length
    ? rannySkenList.map(i => `<div>${i.nazov} <button class="ghost-btn" onclick="odstranZRanneho('${i.qr_kod}')">Odstrániť</button></div>`).join('')
    : '<p class="muted">Zatiaľ nič naskenované.</p>';
}

function renderVecernyZoznam() {
  const el = byId('vecerny-zoznam');
  if (!el) return;
  el.innerHTML = vecernySkenList.length
    ? vecernySkenList.map(i => `<div>${i.nazov} <button class="ghost-btn" onclick="odstranZVecerneho('${i.qr_kod}')">Odstrániť</button></div>`).join('')
    : '<p class="muted">Zatiaľ nič naskenované.</p>';
}

function odstranZRanneho(qr) {
  rannySkenList = rannySkenList.filter(i => i.qr_kod !== qr);
  uzNaskenovaneRano.delete(qr);
  renderRannyZoznam();
}

function odstranZVecerneho(qr) {
  vecernySkenList = vecernySkenList.filter(i => i.qr_kod !== qr);
  uzNaskenovaneVecer.delete(qr);
  renderVecernyZoznam();
}

async function ulozRannySken() {
  const lokaciaId = byId('ranna-lokacia').value;
  if (!lokaciaId) return alert('Vyber stavbu.');
  await api('/api/scans', 'POST', {
    uzivatel: aktualnyUzivatel?.meno || '',
    lokacia_id: lokaciaId,
    lokacia_nazov: data.locations.find(l => String(l._id) === String(lokaciaId))?.nazov || '',
    typ: 'ranny_sken',
    data: [...rannySkenList],
    datum_cas: new Date().toLocaleString('sk-SK')
  });
  alert('Ranný sken uložený.');
  await loadBootstrap();
}

async function porovnajVecernySken() {
  const lokaciaId = byId('vecerna-lokacia').value;
  if (!lokaciaId) return alert('Vyber stavbu.');

  const chybajuce = rannySkenList.filter(i => !vecernySkenList.some(v => v.qr_kod === i.qr_kod));
  if (chybajuce.length > 0) return alert('Chýba náradie:\n' + chybajuce.map(i => i.nazov).join('\n'));

  await api('/api/scans', 'POST', {
    uzivatel: aktualnyUzivatel?.meno || '',
    lokacia_id: lokaciaId,
    lokacia_nazov: data.locations.find(l => String(l._id) === String(lokaciaId))?.nazov || '',
    typ: 'vecerny_sken',
    data: [...vecernySkenList],
    datum_cas: new Date().toLocaleString('sk-SK')
  });

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
  const update = {
    ...item,
    aktualna_lokacia_id: target._id,
    aktualna_lokacia: target.nazov,
    stav: 'presunute',
    historie: [
      ...(item.historie || []),
      {
        typ: 'presun',
        datum: new Date().toLocaleString('sk-SK'),
        popis: `Presun z ${oldLoc} do ${target.nazov}`
      }
    ]
  };

  await api(`/api/tools/${item._id}`, 'PUT', update);
  await api('/api/moves', 'POST', {
    naradie_id: item._id,
    z_lokacie: oldLoc,
    do_lokacie: target.nazov,
    datum_cas: new Date().toLocaleString('sk-SK'),
    kto_spravil: aktualnyUzivatel?.meno || '',
    stav_presunu: 'dorucene'
  });

  vybrateNaradieId = null;
  byId('potvrdi-presun').disabled = true;
  byId('info-presun').textContent = 'Presun dokončený.';
  await loadBootstrap();
}

async function exportujCSV() {
  const rows = [['nazov', 'qr_kod', 'stav', 'lokacia', 'kategoria', 'interné_cislo', 'datum']];
  data.tools.forEach(n =>
    rows.push([n.nazov, n.qr_kod, n.stav || '', n.aktualna_lokacia || '', n.kategoria || '', n.interné_cislo || '', n.createdAt || ''])
  );
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
  const report = {
    datum: new Date().toLocaleDateString('sk-SK'),
    veduci: aktualnyUzivatel ? aktualnyUzivatel.meno : '',
    stavby: data.locations.map(l => l.nazov),
    naradie: data.tools.map(n => n.nazov),
    pocet_naradia: data.tools.length,
    rano: rannySkenList,
    vecer: vecernySkenList,
    presuny: data.moves.slice(-20)
  };
  localStorage.setItem('dennyReport', JSON.stringify(report));
  byId('report-info').textContent = 'Report pripravený na export.';
  alert('Report uložený.');
}

function ulozAktualnuLokaciuVeduceho() {
  const val = byId('veduci-aktualna-lokacia').value;
  localStorage.setItem('veduciLokaciaId', val || '');
  alert(val ? `Uložené: ${data.locations.find(l => String(l._id) === String(val))?.nazov || ''}` : 'Nastavené na Žiadna.');
}

window.addEventListener('storage', async e => {
  if (e.key === 'aktualnyUzivatel') {
    await loadBootstrap();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadBootstrap();
  if (aktualnyUzivatel) showApp();
  else showLogin();
});