from pathlib import Path
base = Path('output/kk_solartech_files')
base.mkdir(parents=True, exist_ok=True)

index_html = '''<!DOCTYPE html>
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
        <div class="section-head"><h3>Náradie</h3><p>Vyhľadávanie podľa názvu aj QR kódu.</p></div>
        <div class="filters"><input id="filter-hladaj" placeholder="Hľadať náradie" oninput="renderAll()"><input id="filter-qr" placeholder="Hľadať QR kód" oninput="renderAll()"><select id="filter-status" onchange="renderAll()"><option value="">Všetky statusy</option><option value="dostupne">Dostupné</option><option value="na_stavbe">Na stavbe</option><option value="oprava">Oprava</option><option value="stratene">Stratené</option><option value="presunute">Presunuté</option></select><select id="filter-lokacia" onchange="renderAll()"></select></div>
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

style_css = '''*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f4f7fb;color:#18304b}a{text-decoration:none;color:inherit}.muted{color:#667}.small-muted{font-size:12px;color:#667}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#0d2b45,#1f5f8b)}.login-card,.panel,.card,.stat-card,.modal-box,.info-box,.list-box{background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(11,33,61,.08)}.login-card{width:min(420px,100%);padding:28px}.brand-inline{display:flex;gap:12px;align-items:center}.brand-inline.large{transform:scale(1.05);transform-origin:left center}.brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#0d2b45,#1f5f8b);position:relative;overflow:hidden}.brand-sun{position:absolute;width:16px;height:16px;border-radius:50%;background:#ffd34d;top:8px;left:8px}.brand-grid{position:absolute;inset:auto 6px 6px 6px;height:18px;border:2px solid rgba(255,255,255,.85);border-top:none;border-radius:0 0 10px 10px}.brand-name{font-weight:900;letter-spacing:.5px}.brand-name span{color:#1f5f8b}.brand-sub{font-size:12px;color:#667}.topbar,.navbar{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:#fff}.topbar{border-bottom:1px solid #e8eef5}.topbar-contact,.topbar-right,.nav-links{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.navbar{box-shadow:0 6px 20px rgba(11,33,61,.05)}.hero{position:relative;min-height:220px;background:linear-gradient(135deg,#0d2b45,#1f5f8b);overflow:hidden}.hero-overlay{position:absolute;inset:0;background:url('') center/cover no-repeat;opacity:.08}.hero-content{position:relative;z-index:1;color:#fff;padding:40px 24px;max-width:900px}.hero h2{margin:0 0 10px;font-size:32px}.content{padding:24px;display:grid;gap:20px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.stat-card{padding:18px}.stat-card span{display:block;color:#667;margin-bottom:6px}.stat-card strong{font-size:30px}.panel{padding:18px}.section-head h3,.card h4{margin:0 0 6px}.section-head p{margin:0 0 12px;color:#667}.card{padding:16px}.card input,.card select,.login-card input,.login-card select,.filters input,.filters select,.edit-form select{width:100%;padding:12px 14px;border:1px solid #d7e1ec;border-radius:12px;margin:6px 0 10px;font:inherit;background:#fff}.primary-btn,.ghost-btn{border:none;border-radius:12px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer}.primary-btn{background:#1f5f8b;color:#fff}.ghost-btn{background:#eef4fa;color:#1f5f8b}.badge{display:inline-block;background:#e8f5ee;color:#20744b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}.list-box{padding:12px;display:grid;gap:10px;margin-top:12px}.pouzitvatel-item,.lokacia-item,.naradie-item,.history-item{padding:12px;border:1px solid #e8eef5;border-radius:14px;background:#fbfdff}.qr-box,.scanner-box,.info-box{padding:12px;margin-top:12px}.scanner-box{min-height:240px}.modal{position:fixed;inset:0;background:rgba(8,20,34,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:999}.modal-box{width:min(720px,100%);padding:18px}.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.detail-box{display:grid;gap:8px}.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}img{max-width:100%;border-radius:12px;margin-top:10px}@media (max-width:1000px){.grid-3,.stats-grid,.filters{grid-template-columns:1fr}.topbar,.navbar,.row{flex-direction:column;align-items:flex-start}}'''

(base / 'index.html').write_text(index_html, encoding='utf-8')
(base / 'style.css').write_text(style_css, encoding='utf-8')
print('Updated index.html and style.css')