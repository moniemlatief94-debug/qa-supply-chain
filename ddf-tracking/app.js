(() => {
'use strict';

/* ================= Defaults (editable from Settings) ================= */
const DEF = {
  products: [
    ['Plain 110 G','Pieces'],['Plain 950 G','Pieces'],['Plain 400 G','Pieces'],
    ['Fat 110 G','Pieces'],['Fat 950 G','Pieces'],['Fat 400 G','Pieces'],
    ['Curated Delights 110 g','Pieces'],['Curated Delights 400 g','Pieces'],
    ['Delights Chocolate 110','Pieces'],['Delights Chocolate 400','Pieces'],
    ['UHT Milk 180 ml','Cartons'],['UHT Fat 1000 ml','Cartons'],['UHT Milk 250 ml','Cartons'],
    ['UHT Milk 1000 ml','Cartons'],['UHT Low Fat 1000 ml','Cartons'],['UHT Date Milk 1000 ml','Cartons']
  ],
  operations: ['Loading','Offloading'],
  opTypes: ['Distribution','Transfer','Return','Other'],
  conditions: ['Good','Acceptable','Poor'],
  maxTemp: 6
};
const CHECKS = [
  ['tempLog','Truck temperature log sheet Available ?','ورقة تسجيل حرارة الشاحنة متوفرة؟'],
  ['tempStage','Truck temperature within stage ?','حرارة الشاحنة ضمن الحد المطلوب؟'],
  ['cooling','Cooling Unit functional?','وحدة التبريد تعمل؟'],
  ['lights','Lightings working?','الإضاءة تعمل؟'],
  ['drain','Drain system working?','نظام التصريف يعمل؟'],
  ['odor','No odor?','لا توجد رائحة؟'],
  ['curtains','Curtains Available?','الستائر متوفرة؟'],
  ['dry','Moisture/condensation dry?','جاف بدون رطوبة / تكثف؟'],
  ['door','Door sealing good?','عزل الباب جيد؟'],
  ['stacking','Proper stacking?','التستيف سليم؟']
];

/* ================= Utils ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = n => (Math.round(n * 100) / 100).toString();
const ar = t => t ? ` <i class="ar" dir="rtl">${t}</i>` : '';
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
const pct = (d, q) => num(q) > 0 ? (num(d) / num(q) * 100) : null;
const pctTxt = p => p === null ? '—' : fmt(p) + '%';

/* ================= Database (IndexedDB) ================= */
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ddf-tracking', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('reports', {keyPath:'id', autoIncrement:true});
      d.createObjectStore('meta', {keyPath:'k'});
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const P = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const st = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
const all = s => P(st(s).getAll());
const get = (s, id) => P(st(s).get(id));
const put = (s, o) => P(st(s, 'readwrite').put(o));
const del = (s, id) => P(st(s, 'readwrite').delete(id));

let S = JSON.parse(JSON.stringify(DEF));
async function loadSettings() { const r = await get('meta', 'settings'); if (r) S = {...S, ...r.v}; }
const saveSettings = () => put('meta', {k:'settings', v:S});
async function nextSerial() {
  const y = new Date().getFullYear();
  const r = (await get('meta', 'seq')) || {k:'seq', v:{}};
  r.v[y] = (r.v[y] || 0) + 1;
  await put('meta', r);
  return `DDF-${y}-${String(r.v[y]).padStart(4, '0')}`;
}

/* ================= Report model ================= */
function blankReport() {
  return {serial:'', date:today(), status:'Created', operation:S.operations[0] || 'Loading', driver:'', plate:'', opType:'',
    loadFrom:'', loadDate:today(), recvLocation:'', recvDate:'', offDate:'', timeStart:'', timeEnd:'', tempStart:'', tempEnd:'',
    checks:{}, lines:S.products.map(([name, uom]) => ({name, uom, qty:'', info:'', dmg:'', photos:[]})),
    condition:'', issues:'', rootCause:'', action1:'', action2:'', reportedBy:'', linkedId:null, offloadId:null};
}
const tempBad = v => v !== '' && v != null && num(v) > S.maxTemp;
const usedLines = r => r.lines.filter(l => num(l.qty) > 0 || num(l.dmg) > 0 || (l.info || '').trim() || (l.photos || []).length);
const failedChecks = r => CHECKS.filter(([k]) => r.checks && r.checks[k] === 'No').length;

/* ================= Autosave ================= */
let R = null, dirty = false, saveT = null, chain = Promise.resolve();
const setSv = t => { $('#sv').textContent = t; };
function touch() { dirty = true; setSv('Saving…'); clearTimeout(saveT); saveT = setTimeout(flush, 500); }
function flush() {
  clearTimeout(saveT);
  chain = chain.then(async () => {
    if (!R || !dirty) return;
    dirty = false;
    try {
      if (!R.serial) R.serial = await nextSerial();
      R.updated = Date.now();
      const id = await put('reports', R);
      if (!R.id) { R.id = id; history.replaceState(null, '', '#/report/' + id); }
      setSv('Saved ✓');
      const sn = $('#serial'); if (sn) sn.textContent = R.serial;
    } catch (e) { dirty = true; setSv('Not saved ✗'); toast('Save failed: ' + (e.message || e)); }
  });
  return chain;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', () => flush());

/* ================= Modal + viewer ================= */
function modal(title, body, onSubmit, submitLabel = 'Save') {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<form class="sheet" autocomplete="off">
    <div class="sheet-h"><b>${esc(title)}</b><button type="button" class="x" aria-label="Close">✕</button></div>
    <div class="sheet-b">${body}</div>
    <div class="sheet-f"><button type="button" class="btn cancel">Cancel</button><button class="btn primary">${esc(submitLabel)}</button></div></form>`;
  document.body.appendChild(o);
  const close = () => o.remove();
  $('.x', o).onclick = $('.cancel', o).onclick = close;
  o.addEventListener('mousedown', e => { if (e.target === o) close(); });
  const f = $('form', o);
  f.onsubmit = async e => {
    e.preventDefault();
    try { await onSubmit(Object.fromEntries(new FormData(f)), close); } catch (err) { toast(err.message || 'Error'); }
  };
  return {o, f, close};
}
const urls = new WeakMap();
const urlOf = b => { if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); };
function viewPhoto(li, pi) {
  const b = R.lines[li].photos[pi]; if (!b) return;
  const o = document.createElement('div'); o.className = 'overlay viewer';
  o.innerHTML = `<div class="sheet" style="background:#000;border-radius:0;align-items:center;padding:12px;max-height:100vh">
    <img alt="attachment" src="${urlOf(b)}"><div class="btns" style="margin-top:12px;justify-content:center">
    <button class="btn danger" data-d>Delete · حذف</button><button class="btn" data-c>Close · إغلاق</button></div></div>`;
  document.body.appendChild(o);
  $('[data-c]', o).onclick = () => o.remove();
  $('[data-d]', o).onclick = () => { R.lines[li].photos.splice(pi, 1); o.remove(); drawThumbs(li); touch(); };
}
async function shrink(file, max = 1280, q = 0.72) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return (await new Promise(r => c.toBlob(r, 'image/jpeg', q))) || file;
  } catch { return file; }
}

/* ================= Routing ================= */
const app = $('#app');
let homeFilter = 'all', homeQ = '';
function setHead(title, back) {
  $('#title').textContent = title; $('#back').style.display = back ? 'block' : 'none';
  document.title = title + ' — DDF Tracking';
}
$('#back').onclick = () => { location.hash = '#/'; };
let routeChain = Promise.resolve();
function route() { routeChain = routeChain.then(doRoute).catch(err => toast(err.message || 'Error')); return routeChain; }
async function doRoute() {
  await flush();
  setSv('');
  const h = location.hash || '#/';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.remove('on'));
  let m;
  R = null;
  if (h === '#/new') await renderReport(null);
  else if ((m = h.match(/^#\/report\/(\d+)/))) await renderReport(+m[1]);
  else if (h === '#/summary') { $('[data-nav=summary]').classList.add('on'); await renderSummary(); }
  else if (h === '#/settings') { $('[data-nav=settings]').classList.add('on'); await renderSettings(); }
  else { $('[data-nav=home]').classList.add('on'); await renderHome(); }
}
window.addEventListener('hashchange', () => { scrollTo(0, 0); route(); });

/* ================= Reports list ================= */
let HC = [];
async function renderHome() {
  setHead('DDF Tracking', false);
  HC = await all('reports');
  app.innerHTML = `
    <div class="brand"><img class="logo" src="logo.png" alt="DAL Food — دال الغذائية" width="68" height="74"></div>
    <input id="q" type="search" placeholder="Search serial / plate / driver / batch · بحث" value="${esc(homeQ)}">
    <div class="chips">${['all', ...S.operations].map(k =>
      `<button class="chip ${homeFilter === k ? 'on' : ''}" data-act="filter" data-v="${esc(k)}">${k === 'all' ? 'All · الكل' : esc(k)}</button>`).join('')}</div>
    <div id="list"></div>
    <button class="fab" data-act="new">＋ New report · تقرير جديد</button>`;
  drawList();
  $('#q').oninput = e => { homeQ = e.target.value; drawList(); };
}
function drawList() {
  const q = homeQ.trim().toLowerCase();
  let list = HC.filter(r => homeFilter === 'all' || r.operation === homeFilter);
  if (q) list = list.filter(r => [r.serial, r.plate, r.driver, r.loadFrom, r.recvLocation, r.issues, r.opType,
      ...r.lines.flatMap(l => [l.name, l.info])].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
  $('#list').innerHTML = list.length ? list.map(r => {
    const ls = usedLines(r), q1 = ls.reduce((a, l) => a + num(l.qty), 0), dm = ls.reduce((a, l) => a + num(l.dmg), 0), fc = failedChecks(r);
    const hot = tempBad(r.tempStart) || tempBad(r.tempEnd);
    return `<div class="card click" data-act="open" data-id="${r.id}">
      <div class="row"><b>${esc(r.serial)}</b><span class="badge ${r.status === 'Submitted' ? 'b-ok' : 'b-pri'}">${esc(r.status)}</span></div>
      <div>${esc(r.operation)}${r.plate ? ' · 🚚 ' + esc(r.plate) : ''}${r.driver ? ' · ' + esc(r.driver) : ''}</div>
      <div class="muted">${esc(r.date)}${r.loadFrom ? ' · ' + esc(r.loadFrom) : ''}${r.opType ? ' · ' + esc(r.opType) : ''}</div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge b-pri">QTY ${fmt(q1)}</span>
        ${dm ? `<span class="badge b-bad">Damage ${fmt(dm)} (${pctTxt(pct(dm, q1))})</span>` : ''}
        ${fc ? `<span class="badge b-bad">${fc} check${fc > 1 ? 's' : ''} = No</span>` : ''}
        ${hot ? `<span class="badge b-bad">Temp &gt; ${S.maxTemp}°</span>` : ''}
        ${r.linkedId ? '<span class="badge b-warn">linked</span>' : ''}</div></div>`;
  }).join('') : `<div class="empty">No reports yet.<br>Tap “New report” to record a loading or offloading.<br><i class="ar" dir="rtl">لا توجد تقارير. اضغط «تقرير جديد».</i></div>`;
}

/* ================= The form ================= */
const inp = (label, a, key, type = 'text', extra = '') =>
  `<label class="f"><span>${label}${ar(a)}</span><input type="${type}" data-k="${key}" value="${esc(R[key])}" ${extra}></label>`;
const slc = (label, a, key, list) =>
  `<label class="f"><span>${label}${ar(a)}</span><select data-k="${key}"><option value="">Select…</option>
   ${[...new Set([...list, R[key]].filter(Boolean))].map(o => `<option ${o === R[key] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
const txa = (label, a, key) => `<label class="f"><span>${label}${ar(a)}</span><textarea data-k="${key}">${esc(R[key])}</textarea></label>`;

function lineHtml(l, i) {
  const p = pct(l.dmg, l.qty);
  return `<div class="pl" data-i="${i}">
    <div class="pd"><span>${esc(l.name)}</span>${l.custom ? `<button type="button" class="btn sm danger noprint" data-act="del-line" data-i="${i}" aria-label="Remove">✕</button>` : ''}</div>
    <div class="c"><span class="lb">Loaded QTY</span><input type="number" min="0" step="any" inputmode="decimal" data-l="${i}" data-f="qty" value="${esc(l.qty)}"></div>
    <div class="c uom"><span class="lb">UOM</span>${esc(l.uom)}</div>
    <div class="c wide"><span class="lb">Product Info (batch / expiry)</span><input data-l="${i}" data-f="info" placeholder="Batch · Exp" value="${esc(l.info)}"></div>
    <div class="c"><span class="lb">Attachments</span>
      <button type="button" class="btn sm noprint" data-act="attach" data-i="${i}">📎 Attach</button>
      <div class="thumbs" id="th${i}">${thumbsHtml(l, i)}</div></div>
    <div class="c"><span class="lb">Damage QTY</span><input type="number" min="0" step="any" inputmode="decimal" data-l="${i}" data-f="dmg" value="${esc(l.dmg)}"></div>
    <div class="c"><span class="lb">Damage %</span><div class="dpct ${num(l.dmg) > 0 ? 'has' : ''}" id="dp${i}">${pctTxt(p)}</div></div>
  </div>`;
}
const thumbsHtml = (l, i) => (l.photos || []).length
  ? l.photos.map((b, k) => `<img alt="photo" src="${urlOf(b)}" data-act="view" data-i="${i}" data-k="${k}">`).join('')
  : '<span class="muted">No file attached</span>';
function drawThumbs(i) { const e = $('#th' + i); if (e) e.innerHTML = thumbsHtml(R.lines[i], i); }

async function renderReport(id) {
  if (id) { R = await get('reports', id); if (!R) { location.hash = '#/'; return; } }
  else { R = blankReport(); }
  dirty = false;
  setHead(R.serial || 'New report', true);
  const linked = R.linkedId ? await get('reports', R.linkedId) : null;
  const off = R.offloadId ? await get('reports', R.offloadId) : null;
  app.innerHTML = `
  <div class="card">
    <div class="hdr"><img class="logo" src="logo.png" alt="DAL Food — دال الغذائية" width="84" height="92"><b>DAL Food Company</b><span>Quality Assurance Department</span><h2>DDF Tracking</h2></div>
    <div class="meta">
      <div><small>Date · التاريخ</small><b><input type="date" data-k="date" value="${esc(R.date)}" style="text-align:center"></b></div>
      <div><small>Report status</small><b id="statusTxt">${esc(R.status)}</b></div>
      <div><small>Serial No.</small><b id="serial">${esc(R.serial || 'auto')}</b></div>
    </div>
    ${linked ? `<div class="hint">Linked to loading report <a href="#/report/${linked.id}">${esc(linked.serial)}</a></div>` : ''}
    ${off ? `<div class="hint">Offloaded in <a href="#/report/${off.id}">${esc(off.serial)}</a></div>` : ''}

    <div class="grid">
      ${slc('Operation', 'العملية', 'operation', S.operations)}
      ${inp('Driver Name', 'اسم السائق', 'driver')}
      ${inp('Plate No', 'رقم اللوحة', 'plate')}
      ${slc('Truck operation type', 'نوع عملية الشاحنة', 'opType', S.opTypes)}
      ${inp('Load From', 'موقع التحميل', 'loadFrom')}
      ${inp('Load Date', 'تاريخ التحميل', 'loadDate', 'date')}
      <div class="full">${inp('Received location in', 'موقع الاستلام', 'recvLocation')}</div>
      ${inp('Receiving Date', 'تاريخ الاستلام', 'recvDate', 'date')}
      ${inp('Offloading Date', 'تاريخ التنزيل', 'offDate', 'date')}
      ${inp('Loading/offloading starting time', 'وقت البدء', 'timeStart', 'time')}
      ${inp('Loading/offloading end time', 'وقت الانتهاء', 'timeEnd', 'time')}
      ${inp('Loading/offloading start Temperature (°C)', 'حرارة البدء', 'tempStart', 'number', 'step="0.1"')}
      ${inp('Loading/offloading end Temperature (°C)', 'حرارة الانتهاء', 'tempEnd', 'number', 'step="0.1"')}
    </div>

    <div class="checks">${CHECKS.map(([k, en, a]) => `
      <div class="chk ${R.checks[k] === 'No' ? 'no' : ''}" id="chk-${k}">
        <div class="q">${en}${ar(a)}</div>
        <div class="yn">
          <label><input type="radio" name="c_${k}" data-c="${k}" value="Yes" ${R.checks[k] === 'Yes' ? 'checked' : ''}> Yes</label>
          <label><input type="radio" name="c_${k}" data-c="${k}" value="No" ${R.checks[k] === 'No' ? 'checked' : ''}> No</label>
        </div></div>`).join('')}</div>

    <div class="ph"><div>Product Description</div><div>Loaded QTY</div><div>UOM</div><div>Product Info</div><div>Attachments</div><div>Damage QTY</div><div>Damage %</div></div>
    <div id="lines">${R.lines.map(lineHtml).join('')}</div>
    <button type="button" class="btn block noprint" data-act="add-line" style="margin-top:8px">＋ Add product · إضافة صنف</button>

    <div class="foot grid">
      ${slc('Truck condition', 'حالة الشاحنة', 'condition', S.conditions)}
      <div class="full">${txa('Issues', 'المشاكل', 'issues')}</div>
      <div class="full">${txa('Root Cause', 'السبب الجذري', 'rootCause')}</div>
      <div class="full">${txa('Corrective action', 'الإجراء التصحيحي', 'action1')}</div>
      <div class="full">${txa('Preventive action', 'الإجراء الوقائي', 'action2')}</div>
      <div class="full">${inp('Reported By', 'أُعدّ بواسطة', 'reportedBy')}</div>
    </div>

    <div class="btns noprint" style="margin-top:10px">
      <button class="btn primary" data-act="offload">⬇ Offload this load · تنزيل هذه الحمولة</button>
      <button class="btn" data-act="toggle-status">${R.status === 'Submitted' ? 'Reopen · إعادة فتح' : 'Submit report · اعتماد'}</button>
      <button class="btn" data-act="print">🖨 Print / PDF</button>
      <button class="btn" data-act="csv-one">⬇ CSV</button>
      <button class="btn danger" data-act="del-report">Delete · حذف</button>
    </div>
  </div>`;
  markTemps();
}
function markTemps() {
  for (const k of ['tempStart', 'tempEnd']) { const e = $(`[data-k=${k}]`); if (e) e.classList.toggle('bad', tempBad(R[k])); }
}

/* input handling (delegated) */
function onField(e) {
  const t = e.target; if (!R || !app.contains(t)) return;
  if (t.dataset.k) {
    R[t.dataset.k] = t.value;
    if (t.dataset.k === 'tempStart' || t.dataset.k === 'tempEnd') markTemps();
  } else if (t.dataset.l !== undefined) {
    const i = +t.dataset.l, l = R.lines[i];
    l[t.dataset.f] = t.value;
    const d = $('#dp' + i);
    if (d) { d.textContent = pctTxt(pct(l.dmg, l.qty)); d.classList.toggle('has', num(l.dmg) > 0); }
  } else if (t.dataset.c) {
    R.checks[t.dataset.c] = t.value;
    $('#chk-' + t.dataset.c).classList.toggle('no', t.value === 'No');
  } else return;
  touch();
}
app.addEventListener('input', onField);
app.addEventListener('change', onField);

/* ================= Summary ================= */
let sumFrom = '', sumTo = '';
function inRange(r) { return (!sumFrom || r.date >= sumFrom) && (!sumTo || r.date <= sumTo); }
async function renderSummary() {
  setHead('Summary · ملخص', false);
  if (!sumTo) sumTo = today();
  if (!sumFrom) { const d = new Date(); d.setDate(d.getDate() - 30); sumFrom = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  const rs = (await all('reports')).filter(inRange);
  const by = {};
  rs.forEach(r => r.lines.forEach(l => {
    const k = l.name + '|' + l.uom, o = by[k] ||= {name:l.name, uom:l.uom, load:0, off:0, dmg:0};
    if (r.operation === 'Offloading') o.off += num(l.qty); else o.load += num(l.qty);
    o.dmg += num(l.dmg);
  }));
  const prod = Object.values(by).filter(p => p.load || p.off || p.dmg).sort((a, b) => b.load - a.load);
  const fails = rs.reduce((a, r) => a + failedChecks(r), 0);
  const hot = rs.filter(r => tempBad(r.tempStart) || tempBad(r.tempEnd)).length;
  const withIssues = rs.filter(r => (r.issues || '').trim()).length;
  app.innerHTML = `
    <div class="card"><div class="grid">
      <label class="f"><span>From · من</span><input type="date" id="sf" value="${sumFrom}"></label>
      <label class="f"><span>To · إلى</span><input type="date" id="st" value="${sumTo}"></label></div>
      <div class="stats">
        <div class="stat"><b>${rs.length}</b><span>Reports</span></div>
        <div class="stat ${withIssues ? 's-bad' : ''}"><b>${withIssues}</b><span>With issues</span></div>
        <div class="stat ${fails ? 's-bad' : ''}"><b>${fails}</b><span>Checks = No</span></div>
        <div class="stat ${hot ? 's-bad' : ''}"><b>${hot}</b><span>Temp &gt; ${S.maxTemp}°</span></div></div></div>
    <div class="card"><b>By product · حسب الصنف</b>
      ${prod.length ? `<table class="t" style="margin-top:8px"><tr><th>Product</th><th>Loaded</th><th>Offloaded</th><th>Damage</th><th>Dmg %</th></tr>
        ${prod.map(p => `<tr><td>${esc(p.name)}<div class="muted">${esc(p.uom)}</div></td><td>${fmt(p.load)}</td><td>${fmt(p.off)}</td>
          <td style="${p.dmg ? 'color:var(--bad);font-weight:700' : ''}">${fmt(p.dmg)}</td><td>${pctTxt(pct(p.dmg, p.load))}</td></tr>`).join('')}</table>
        <div class="muted" style="margin-top:6px">Damage % = Damage ÷ Loaded.</div>` : '<div class="empty">No data in this period.</div>'}</div>
    <div class="card"><b>Export (opens in Excel)</b>
      <div class="btns" style="margin-top:10px"><button class="btn" data-act="csv-all">⬇ All reports in period (CSV)</button></div></div>`;
  $('#sf').onchange = e => { sumFrom = e.target.value; route(); };
  $('#st').onchange = e => { sumTo = e.target.value; route(); };
}

/* ================= CSV / files ================= */
function csv(rows) {
  return '\ufeff' + rows.map(r => r.map(c => {
    let s = c == null ? '' : String(c);
    if (typeof c === 'string' && /^[=+@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}
function saveFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const CSV_HEAD = ['Serial','Status','Date','Operation','Driver','Plate No','Truck operation type','Load From','Load Date','Received location in','Receiving Date','Offloading Date',
  'Start time','End time','Start temp','End temp', ...CHECKS.map(c => c[1]), 'Truck condition',
  'Product','UOM','QTY','Product Info','Damage QTY','Damage %','Photos','Issues','Root Cause','Corrective action','Preventive action','Reported By'];
function csvRows(rs) {
  const out = [CSV_HEAD];
  rs.forEach(r => {
    const base = [r.serial, r.status, r.date, r.operation, r.driver, r.plate, r.opType, r.loadFrom, r.loadDate, r.recvLocation, r.recvDate, r.offDate,
      r.timeStart, r.timeEnd, r.tempStart, r.tempEnd, ...CHECKS.map(([k]) => r.checks[k] || ''), r.condition];
    const tail = [r.issues, r.rootCause, r.action1, r.action2, r.reportedBy];
    const ls = usedLines(r);
    (ls.length ? ls : [null]).forEach(l => out.push([...base,
      ...(l ? [l.name, l.uom, l.qty, l.info, l.dmg, pctTxt(pct(l.dmg, l.qty)), (l.photos || []).length] : ['', '', '', '', '', '', '']), ...tail]));
  });
  return csv(out);
}

/* ================= Settings ================= */
async function renderSettings() {
  setHead('Settings · إعدادات', false);
  app.innerHTML = `
    <div class="card"><b>Product list · قائمة الأصناف</b>
      <p class="muted">One per line: <code>Name | UOM</code>. Used for new reports (old reports keep their own list).</p>
      <textarea id="s-prod" style="min-height:200px">${esc(S.products.map(p => p.join(' | ')).join('\n'))}</textarea></div>
    <div class="card"><b>Dropdown lists · القوائم</b>
      <label class="f"><span>Operation (one per line)</span><textarea id="s-ops">${esc(S.operations.join('\n'))}</textarea></label>
      <label class="f"><span>Truck operation type</span><textarea id="s-types">${esc(S.opTypes.join('\n'))}</textarea></label>
      <label class="f"><span>Truck condition</span><textarea id="s-cond">${esc(S.conditions.join('\n'))}</textarea></label>
      <label class="f"><span>Max allowed temperature °C · أقصى حرارة</span><input type="number" step="0.1" id="s-max" value="${S.maxTemp}"></label>
      <button class="btn primary block" data-act="save-settings">Save · حفظ</button></div>
    <div class="card"><b>Backup · النسخ الاحتياطي</b>
      <p class="muted">Data lives inside this phone only. Download a backup regularly (including attached photos) and keep it in WhatsApp / Google Drive.</p>
      <div class="btns" style="flex-direction:column">
        <button class="btn" data-act="backup">⬇ Download backup (JSON)</button>
        <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">⬆ Restore from backup
          <input type="file" id="restore" accept="application/json,.json" hidden></label></div></div>
    <div class="card"><b>Install on phone · التثبيت</b>
      <p class="muted">Open the link in Chrome → ⋮ menu → “Install app” / “Add to Home screen”. It then works offline.</p></div>
    <div class="card"><b style="color:var(--bad)">Danger zone</b>
      <button class="btn danger block" style="margin-top:8px" data-act="wipe">Delete all data · حذف كل البيانات</button></div>`;
  $('#restore').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try { await restoreBackup(JSON.parse(await file.text())); } catch (err) { toast('Invalid file: ' + (err.message || '')); }
    e.target.value = '';
  };
}
const b2d = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
function d2b(u) {
  const [h, b] = u.split(','), mime = (h.match(/:(.*?);/) || [])[1] || 'image/jpeg', bin = atob(b), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], {type:mime});
}
async function backup() {
  await flush();
  const reports = await all('reports');
  for (const r of reports) for (const l of r.lines) l.photos = await Promise.all((l.photos || []).map(b2d));
  const out = {app:'ddf-tracking', version:1, exported:new Date().toISOString(), meta:await all('meta'), reports};
  saveFile(`ddf-backup-${today()}.json`, JSON.stringify(out), 'application/json');
}
async function restoreBackup(d) {
  if (!d || d.app !== 'ddf-tracking' || !Array.isArray(d.reports)) throw new Error('Not a backup of this app');
  if (!confirm('This replaces ALL current data with the backup. Continue?')) return;
  d.reports.forEach(r => r.lines.forEach(l => { l.photos = (l.photos || []).map(d2b); }));
  await new Promise((res, rej) => {
    const tx = db.transaction(['reports', 'meta'], 'readwrite');
    tx.objectStore('reports').clear(); tx.objectStore('meta').clear();
    d.reports.forEach(r => tx.objectStore('reports').put(r));
    (d.meta || []).forEach(m => tx.objectStore('meta').put(m));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
  S = JSON.parse(JSON.stringify(DEF)); await loadSettings();
  toast('Restored ✔'); location.hash = '#/'; route();
}

/* ================= Actions ================= */
const lines = t => t.split('\n').map(s => s.trim()).filter(Boolean);
const actions = {
  'filter': el => { homeFilter = el.dataset.v; renderHome(); },
  'new': () => { location.hash = '#/new'; },
  'open': el => { location.hash = '#/report/' + el.dataset.id; },
  'add-line': () => {
    modal('Add product · إضافة صنف', `
      <label class="f"><span>Product Description</span><input name="name" required></label>
      <label class="f"><span>UOM</span><input name="uom" value="Pieces" required></label>`,
    (d, close) => {
      R.lines.push({name:d.name.trim(), uom:d.uom.trim(), qty:'', info:'', dmg:'', photos:[], custom:true});
      $('#lines').insertAdjacentHTML('beforeend', lineHtml(R.lines[R.lines.length - 1], R.lines.length - 1));
      close(); touch();
    }, 'Add');
  },
  'del-line': el => {
    const i = +el.dataset.i;
    if (!confirm('Remove this product row?')) return;
    R.lines.splice(i, 1); $('#lines').innerHTML = R.lines.map(lineHtml).join(''); touch();
  },
  'attach': el => {
    const i = +el.dataset.i, f = document.createElement('input'), rep = R;
    f.type = 'file'; f.accept = 'image/*'; f.multiple = true;
    f.onchange = async () => {
      for (const file of f.files) {
        const b = await shrink(file);
        if (R !== rep || !rep.lines[i]) return toast('Photo not added: report was closed');
        rep.lines[i].photos.push(b);
      }
      drawThumbs(i); touch();
    };
    f.click();
  },
  'view': el => viewPhoto(+el.dataset.i, +el.dataset.k),
  'toggle-status': async () => {
    R.status = R.status === 'Submitted' ? 'Created' : 'Submitted'; dirty = true; await flush();
    toast(R.status === 'Submitted' ? 'Report submitted ✔' : 'Report reopened'); renderReport(R.id);
  },
  'print': () => window.print(),
  'csv-one': async () => { await flush(); if (!R.id) return toast('Nothing to export yet'); saveFile(`${R.serial}.csv`, csvRows([R]), 'text/csv;charset=utf-8'); },
  'csv-all': async () => {
    const rs = (await all('reports')).filter(inRange).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    saveFile(`ddf-${sumFrom}_${sumTo}.csv`, csvRows(rs), 'text/csv;charset=utf-8');
  },
  'del-report': async () => {
    if (!confirm('Delete this report permanently? · حذف التقرير نهائياً؟')) return;
    await flush();
    const id = R.id; dirty = false; R = null;
    if (!id) { location.hash = '#/'; return; }
    for (const r of await all('reports')) {
      if (r.linkedId === id) { r.linkedId = null; await put('reports', r); }
      if (r.offloadId === id) { r.offloadId = null; await put('reports', r); }
    }
    await del('reports', id); toast('Deleted'); location.hash = '#/';
  },
  'offload': async () => {
    if (/off/i.test(R.operation)) return toast('This is already an offloading report · هذا تقرير تنزيل بالفعل');
    await flush();
    if (!R.id) return toast('Fill in the report first');
    if (R.offloadId && await get('reports', R.offloadId)) { location.hash = '#/report/' + R.offloadId; return; }
    const used = R.lines.filter(l => num(l.qty) > 0);
    if (!used.length) return toast('Enter Loaded QTY for at least one product first');
    const n = blankReport();
    Object.assign(n, {operation:S.operations.find(o => /off/i.test(o)) || 'Offloading', driver:R.driver, plate:R.plate, opType:R.opType,
      loadFrom:R.loadFrom, loadDate:R.loadDate, recvLocation:R.recvLocation, offDate:today(), recvDate:today(), linkedId:R.id,
      lines:used.map(l => ({name:l.name, uom:l.uom, qty:l.qty, info:l.info, dmg:'', photos:[], custom:l.custom}))});
    n.serial = await nextSerial();
    const id = await put('reports', n);
    R.offloadId = id; dirty = true; await flush();
    toast('Offloading report created from this load'); location.hash = '#/report/' + id;
  },
  'save-settings': async () => {
    const prods = lines($('#s-prod').value).map(l => { const [n, u] = l.split('|').map(s => s.trim()); return [n, u || 'Pieces']; });
    if (!prods.length) return toast('Add at least one product');
    const mx = parseFloat($('#s-max').value);
    S.products = prods; S.operations = lines($('#s-ops').value); S.opTypes = lines($('#s-types').value); S.conditions = lines($('#s-cond').value);
    if (!S.operations.length) S.operations = DEF.operations.slice();
    if (Number.isFinite(mx)) S.maxTemp = mx;
    await saveSettings(); toast('Saved ✔');
  },
  'backup': backup,
  'wipe': async () => {
    if (!confirm('Delete ALL reports and settings from this phone?')) return;
    if (!confirm('Final confirmation: this cannot be undone. Take a backup first if unsure.')) return;
    dirty = false; R = null;
    await P(st('reports', 'readwrite').clear());
    await del('meta', 'settings');   // keep the serial counter so numbers are never reused
    S = JSON.parse(JSON.stringify(DEF)); toast('All data deleted'); location.hash = '#/'; route();
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('.overlay')) return;
  const fn = actions[el.dataset.act];
  if (fn) Promise.resolve(fn(el, e)).catch(err => toast(err.message || 'Error'));
});

/* ================= Start ================= */
(async () => {
  try {
    db = await openDB(); await loadSettings();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await route();
  } catch (err) {
    app.innerHTML = `<div class="card"><b>Could not open the database</b><p class="muted">${esc(err.message || err)}</p>
      <p class="muted">Make sure you are not in private/incognito mode and that the page is opened over https or as the installed app.</p></div>`;
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
