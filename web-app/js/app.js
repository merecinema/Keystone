/* ============================================================
   AlphA — Advertising Production Quote App
   ============================================================ */

'use strict';

/* ---- State ---- */
// itemValues keyed by STRUCTURE INDEX (number), not sec.id letter,
// because multiple sections share the same id letter (e.g. 11 × 'B').
const STATE = {
  currency: '€',
  margin:   25,
  discount: 0,
  // itemValues[secIdx][subIdx][itemIdx] = { qty, nb, rate, disc, note }
  itemValues: {},
};

// G→D, H→E, I→F, J→G, K→H  (original C/D/E/F merged into C. Post Production)
const SECTION_ID_REMAP = { G: 'D', H: 'E', I: 'F', J: 'G', K: 'H' };
const POST_PROD_IDS    = new Set(['C', 'D', 'E', 'F']);

/* ---- DOM refs ---- */
const $ = id => document.getElementById(id);

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  buildNav();
  buildSections();
  buildTopSheetBudgetTable();
  wireProjectFields();
  wireTopSheetFields();
  wireButtons();
  loadFromStorage();
  recalcAll();
});

function setDefaultDate() {
  const d = new Date();
  $('f-date').value = d.toISOString().split('T')[0];
}

/* ============================================================
   SECTION META — shared display-ID / label (used by nav & sections)
   ============================================================ */
function buildSectionMeta() {
  let bCount = 0, cCount = 0;
  return QUOTE_STRUCTURE.map((sec, secIdx) => {
    let displayId, groupBefore = null, isSub = false;
    if (sec.id === 'B') {
      if (bCount === 0) groupBefore = { id: 'B', label: 'Production Image' };
      bCount++;
      displayId = `B-${bCount}`;
      isSub = true;
    } else if (POST_PROD_IDS.has(sec.id)) {
      if (cCount === 0) groupBefore = { id: 'C', label: 'Post Production' };
      cCount++;
      displayId = `C-${cCount}`;
      isSub = true;
    } else {
      displayId = SECTION_ID_REMAP[sec.id] || sec.id;
    }
    return { secIdx, sec, displayId, label: sec.name.replace(/^[A-K]\.\s*/, ''), groupBefore, isSub };
  });
}

/* ============================================================
   BUILD NAV
   ============================================================ */
function buildNav() {
  const nav = $('section-nav');
  nav.innerHTML = '';

  nav.appendChild(makeNavItem('★', 'Project Info', null, () =>
    $('project-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' })));

  const tsEl = makeNavItem('▣', 'Top Sheet', null, () =>
    $('top-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  tsEl.dataset.nav = 'topsheet';
  nav.appendChild(tsEl);

  buildSectionMeta().forEach(({ secIdx, displayId, label, groupBefore, isSub }) => {
    if (groupBefore) {
      const grp = makeNavItem(groupBefore.id, groupBefore.label, null, () =>
        $(`sec-${secIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      grp.classList.add('nav-group');
      nav.appendChild(grp);
    }
    const el = makeNavItem(displayId, label, `nav-total-${secIdx}`, () =>
      $(`sec-${secIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    el.dataset.secIdx = secIdx;
    if (isSub) el.classList.add('nav-sub');
    nav.appendChild(el);
  });

  const sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--border);margin:6px 0;';
  nav.appendChild(sep);
}

function makeNavItem(id, label, totalId, onClick) {
  const el = document.createElement('div');
  el.className = 'nav-item';
  el.innerHTML = `
    <span class="nav-id">${id}</span>
    <span class="nav-label">${label.toUpperCase()}</span>
    ${totalId ? `<span class="nav-total" id="${totalId}">—</span>` : ''}
  `;
  el.addEventListener('click', () => { onClick(); setActiveNav(el); });
  return el;
}

function setActiveNav(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

/* ============================================================
   BUILD SECTIONS
   ============================================================ */
function buildSections() {
  const container = $('quote-sections');
  container.innerHTML = '';

  buildSectionMeta().forEach(({ secIdx, sec, displayId, label, groupBefore, isSub }) => {
    if (!STATE.itemValues[secIdx]) STATE.itemValues[secIdx] = {};

    if (groupBefore) {
      const banner = document.createElement('div');
      banner.className = 'sec-group-banner';
      banner.innerHTML = `<span class="qsec-id">${groupBefore.id}</span><span class="qsec-name">${groupBefore.label}</span>`;
      container.appendChild(banner);
    }

    const card = document.createElement('div');
    card.className = 'quote-section-card' + (isSub ? ' sec-card-sub' : '');
    card.id = `sec-${secIdx}`;

    const header = document.createElement('div');
    header.className = 'qsec-header';
    header.innerHTML = `
      <span class="qsec-toggle">▶</span>
      <span class="qsec-id">${displayId}</span>
      <span class="qsec-name">${label}</span>
      <span class="qsec-total" id="qsec-total-${secIdx}">—</span>
    `;
    header.addEventListener('click', () => toggleSection(card, header));
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'qsec-body';

    sec.subs.forEach((sub, sIdx) => {
      if (!STATE.itemValues[secIdx][sIdx]) STATE.itemValues[secIdx][sIdx] = {};
      if (!sub.items || sub.items.length === 0) return;

      const subEl = document.createElement('div');
      subEl.className = 'subsection';

      const subHeader = document.createElement('div');
      subHeader.className = 'sub-header';
      subHeader.innerHTML = `
        <span class="sub-toggle">▶</span>
        <span class="sub-name">${sub.name}</span>
        <span class="sub-total" id="sub-total-${secIdx}-${sIdx}">—</span>
      `;
      subHeader.addEventListener('click', () => toggleSubsection(subEl, subHeader));
      subEl.appendChild(subHeader);

      const subBody = document.createElement('div');
      subBody.className = 'sub-body';
      subBody.appendChild(buildItemTable(secIdx, sIdx, sub.items));
      subEl.appendChild(subBody);
      body.appendChild(subEl);
    });

    card.appendChild(body);
    container.appendChild(card);
  });
}

function toggleSection(card, header) {
  const body = card.querySelector('.qsec-body');
  const toggle = header.querySelector('.qsec-toggle');
  const open = body.classList.toggle('open');
  toggle.classList.toggle('open', open);
}

function toggleSubsection(subEl, subHeader) {
  const body = subEl.querySelector('.sub-body');
  const toggle = subHeader.querySelector('.sub-toggle');
  const open = body.classList.toggle('open');
  toggle.classList.toggle('open', open);
}

/* ---- Item Table ---- */
function buildItemTable(secIdx, sIdx, items) {
  const table = document.createElement('table');
  table.className = 'items-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>Unit</th>
        <th>Qty</th>
        <th>Nb</th>
        <th>Rate (${STATE.currency})</th>
        <th>MK %</th>
        <th>Total (${STATE.currency})</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  items.forEach((item, iIdx) => {
    if (!STATE.itemValues[secIdx][sIdx][iIdx]) {
      STATE.itemValues[secIdx][sIdx][iIdx] = { qty: 0, nb: 0, rate: 0, disc: 10, note: '', unit: '' };
    }
    tbody.appendChild(buildItemRow(secIdx, sIdx, iIdx, item));
  });

  const totalRow = document.createElement('tr');
  totalRow.className = 'sub-total-row';
  totalRow.id = `subtrow-${secIdx}-${sIdx}`;
  totalRow.innerHTML = `
    <td colspan="7" style="text-align:right;color:var(--text-muted)">Subtotal</td>
    <td id="subtrow-val-${secIdx}-${sIdx}">—</td>
    <td></td>
  `;
  tbody.appendChild(totalRow);
  return table;
}

function buildItemRow(secIdx, sIdx, iIdx, item) {
  const row = document.createElement('tr');
  row.dataset.secIdx = secIdx;
  row.dataset.sub    = sIdx;
  row.dataset.item   = iIdx;

  const v = STATE.itemValues[secIdx][sIdx][iIdx];

  row.innerHTML = `
    <td>${iIdx + 1}</td>
    <td><span class="item-name-text" title="${escHtml(item.name)}">${escHtml(item.name)}</span></td>
    <td class="cell-unit"><input type="text" class="unit-input" value="${escHtml(v.unit || item.unit)}" placeholder="${escHtml(item.unit)}" /></td>
    <td class="cell-num"><input type="number" min="0" step="any" placeholder="0" /></td>
    <td class="cell-num"><input type="number" min="0" step="any" placeholder="1" /></td>
    <td class="cell-rate"><input type="number" min="0" step="any" placeholder="0" /></td>
    <td class="cell-disc"><input type="number" min="0" max="100" step="0.1" placeholder="10" /></td>
    <td class="cell-total" id="cell-total-${secIdx}-${sIdx}-${iIdx}">—</td>
    <td class="cell-note"><input type="text" placeholder="..." /></td>
  `;

  const [unitIn, qtyIn, nbIn, rateIn, discIn, noteIn] = row.querySelectorAll('input');

  if (v.qty)  qtyIn.value  = v.qty;
  if (v.nb)   nbIn.value   = v.nb;
  if (v.rate) rateIn.value = v.rate;
  if (v.disc != null) discIn.value = v.disc;
  if (v.note) noteIn.value = v.note;

  function onInput() {
    v.qty  = parseFloat(qtyIn.value)  || 0;
    v.nb   = parseFloat(nbIn.value)   || 0;
    v.rate = parseFloat(rateIn.value) || 0;
    v.disc = parseFloat(discIn.value) || 0;
    v.note = noteIn.value;
    const total = calcLineTotal(v);
    updateCellTotal(`cell-total-${secIdx}-${sIdx}-${iIdx}`, total);
    row.classList.toggle('has-value', total > 0);
    recalcSubtotals(secIdx, sIdx);
    recalcSectionTotal(secIdx);
    recalcGrandTotal();
  }

  [qtyIn, nbIn, rateIn, discIn].forEach(inp => inp.addEventListener('input', onInput));
  noteIn.addEventListener('change', () => { v.note = noteIn.value; });
  unitIn.addEventListener('change', () => { v.unit = unitIn.value; });

  if (calcLineTotal(v) > 0) row.classList.add('has-value');
  return row;
}

function calcLineTotal(v) {
  if (!v.rate) return 0;
  const qty = v.qty || 1;
  const nb  = v.nb  || 1;
  const mk  = v.disc ?? 10;   // MK%: default 10% markup
  return qty * nb * v.rate * (1 + mk / 100);
}

function updateCellTotal(id, val) {
  const el = $(id);
  if (!el) return;
  if (val === 0) { el.textContent = '—'; el.classList.remove('nonzero'); }
  else { el.textContent = formatMoney(val); el.classList.add('nonzero'); }
}

/* ============================================================
   RECALC
   ============================================================ */
function calcSecIndexTotal(secIdx) {
  let t = 0;
  const secVals = STATE.itemValues[secIdx] || {};
  Object.values(secVals).forEach(subVals => {
    Object.values(subVals).forEach(v => { t += calcLineTotal(v); });
  });
  return t;
}

function recalcSubtotals(secIdx, sIdx) {
  const subVals = STATE.itemValues[secIdx]?.[sIdx] || {};
  let sub = 0;
  Object.values(subVals).forEach(v => { sub += calcLineTotal(v); });

  const valEl   = $(`subtrow-val-${secIdx}-${sIdx}`);
  const labelEl = $(`sub-total-${secIdx}-${sIdx}`);
  const fmt     = sub > 0 ? formatMoney(sub) : '—';
  if (valEl)   valEl.textContent   = fmt;
  if (labelEl) {
    labelEl.textContent  = fmt;
    labelEl.style.color  = sub > 0 ? 'var(--green)' : '';
  }
  return sub;
}

function recalcSectionTotal(secIdx) {
  const total = calcSecIndexTotal(secIdx);
  const sec   = QUOTE_STRUCTURE[secIdx];

  const qEl   = $(`qsec-total-${secIdx}`);
  const navEl = $(`nav-total-${secIdx}`);

  if (qEl)   { qEl.textContent = total > 0 ? formatMoney(total) : '—'; qEl.style.color = total > 0 ? 'var(--green)' : 'var(--text-muted)'; }
  if (navEl) navEl.textContent = total > 0 ? fmtShort(total) : '—';

  // Also refresh sub-totals display
  Object.keys(STATE.itemValues[secIdx] || {}).forEach(sIdx => recalcSubtotals(secIdx, parseInt(sIdx)));

  if (sec) updateTopSheet();
  return total;
}

function recalcAll() {
  QUOTE_STRUCTURE.forEach((_, secIdx) => recalcSectionTotal(secIdx));
  updateTopSheet();
}

function recalcGrandTotal() {
  updateTopSheet();
}

/* ============================================================
   PROJECT FIELDS
   ============================================================ */
function wireProjectFields() {
  $('f-title').addEventListener('input', () => {
    $('quote-title-display').textContent = $('f-title').value.trim() || 'Advertising Production Quote';
    updateTopSheet();
  });
  $('f-currency').addEventListener('change', () => {
    STATE.currency = $('f-currency').value;
    refreshCurrencyLabels();
    recalcGrandTotal();
  });
  $('f-margin').addEventListener('input', () => {
    STATE.margin = parseFloat($('f-margin').value) || 0;
    recalcGrandTotal();
  });
  $('f-discount').addEventListener('input', () => {
    STATE.discount = parseFloat($('f-discount').value) || 0;
    recalcGrandTotal();
  });
  // Sync display fields to top sheet on change
  ['f-advertiser','f-agency','f-client','f-product','f-director','f-ep','f-ref','f-date','f-validity'].forEach(id => {
    $(id)?.addEventListener('input', updateTopSheet);
    $(id)?.addEventListener('change', updateTopSheet);
  });
}

function wireTopSheetFields() {
  ['ts-vat-pct','ts-cutdown'].forEach(id => {
    $(id)?.addEventListener('input', updateTopSheet);
  });
  $('btn-print-topsheet')?.addEventListener('click', () => {
    document.body.classList.add('print-topsheet');
    window.print();
    document.body.classList.remove('print-topsheet');
  });
}

function refreshCurrencyLabels() {
  document.querySelectorAll('.items-table thead th').forEach(th => {
    if (th.textContent.startsWith('Rate ('))  th.textContent = `Rate (${STATE.currency})`;
    if (th.textContent.startsWith('Total (')) th.textContent = `Total (${STATE.currency})`;
  });
  document.querySelectorAll('.ts-cur').forEach(el => { el.textContent = STATE.currency; });
}

/* ============================================================
   BUTTONS
   ============================================================ */
function wireButtons() {
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-save').addEventListener('click', saveToStorage);
  $('btn-new').addEventListener('click', confirmNewQuote);
  $('btn-load').addEventListener('click', openLoadModal);
  $('btn-export-json').addEventListener('click', exportJSON);
  $('btn-modal-close').addEventListener('click', closeLoadModal);
  $('import-file').addEventListener('change', importJSON);
  $('btn-topsheet-jump').addEventListener('click', () =>
    $('top-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/* ============================================================
   STORAGE
   ============================================================ */
const STORAGE_KEY = 'alpha-quote-list';

function getProjectData() {
  return {
    title:     $('f-title').value,
    advertiser:$('f-advertiser').value,
    agency:    $('f-agency').value,
    client:    $('f-client').value,
    product:   $('f-product').value,
    director:  $('f-director').value,
    ep:        $('f-ep').value,
    ref:       $('f-ref').value,
    currency:  $('f-currency').value,
    date:      $('f-date').value,
    validity:  $('f-validity').value,
    type:      $('f-type').value,
    margin:    $('f-margin').value,
    discount:  $('f-discount').value,
    notes:     $('f-notes').value,
  };
}

function setProjectData(d) {
  if (!d) return;
  $('f-title').value      = d.title      || '';
  $('f-advertiser').value = d.advertiser || '';
  $('f-agency').value     = d.agency     || '';
  $('f-client').value     = d.client     || '';
  $('f-product').value    = d.product    || '';
  $('f-director').value   = d.director   || '';
  $('f-ep').value         = d.ep         || '';
  $('f-ref').value        = d.ref        || '';
  $('f-currency').value   = d.currency   || '€';
  $('f-date').value       = d.date       || '';
  $('f-validity').value   = d.validity   || 30;
  $('f-type').value       = d.type       || 'Film';
  $('f-margin').value     = d.margin     !== undefined ? d.margin   : 25;
  $('f-discount').value   = d.discount   !== undefined ? d.discount : 0;
  $('f-notes').value      = d.notes      || '';

  $('quote-title-display').textContent = d.title || 'Advertising Production Quote';
  STATE.currency = d.currency || '€';
  STATE.margin   = parseFloat(d.margin)   || 25;
  STATE.discount = parseFloat(d.discount) || 0;
}

function saveToStorage() {
  const id = $('f-ref').value.trim() || Date.now().toString();
  const data = {
    id,
    savedAt: new Date().toISOString(),
    project: getProjectData(),
    tsExtra: getTopSheetExtra(),
    values:  JSON.parse(JSON.stringify(STATE.itemValues)),
  };

  let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const existing = list.findIndex(q => q.id === id);
  if (existing >= 0) list[existing] = data;
  else list.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem('alpha-quote-current', JSON.stringify(data));
  toast('Quote saved!', 'success');
}

function loadFromStorage() {
  const raw = localStorage.getItem('alpha-quote-current');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    setProjectData(data.project);
    setTopSheetExtra(data.tsExtra);
    if (data.values) {
      // values keys are numeric strings from JSON
      Object.assign(STATE.itemValues, data.values);
      rebuildItemValues();
    }
  } catch(e) { /* ignore */ }
}

function rebuildItemValues() {
  // Ensure nested objects exist
  QUOTE_STRUCTURE.forEach((sec, secIdx) => {
    if (!STATE.itemValues[secIdx]) STATE.itemValues[secIdx] = {};
    sec.subs.forEach((_, sIdx) => {
      if (!STATE.itemValues[secIdx][sIdx]) STATE.itemValues[secIdx][sIdx] = {};
    });
  });

  // Update all input fields from STATE
  document.querySelectorAll('.items-table tbody tr[data-sec-idx]').forEach(row => {
    const secIdx = row.dataset.secIdx;
    const sIdx   = row.dataset.sub;
    const iIdx   = row.dataset.item;
    if (secIdx === undefined || sIdx === undefined || iIdx === undefined) return;

    const v = STATE.itemValues[secIdx]?.[sIdx]?.[iIdx];
    if (!v) return;

    const inputs = row.querySelectorAll('input');
    if (inputs[0] && v.unit) inputs[0].value = v.unit;  // unit (only override if user modified)
    if (inputs[1]) inputs[1].value = v.qty  || '';
    if (inputs[2]) inputs[2].value = v.nb   || '';
    if (inputs[3]) inputs[3].value = v.rate || '';
    if (inputs[4] && v.disc != null) inputs[4].value = v.disc;
    if (inputs[5]) inputs[5].value = v.note || '';

    const total = calcLineTotal(v);
    updateCellTotal(`cell-total-${secIdx}-${sIdx}-${iIdx}`, total);
    if (total > 0) row.classList.add('has-value');
  });
}

/* ============================================================
   NEW QUOTE
   ============================================================ */
function confirmNewQuote() {
  if (!confirm('Start a new quote? Unsaved changes will be lost.')) return;
  localStorage.removeItem('alpha-quote-current');
  location.reload();
}

/* ============================================================
   LOAD MODAL
   ============================================================ */
function openLoadModal() {
  const modal = $('modal-load');
  const list  = $('saved-quotes-list');
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  list.innerHTML = '';
  if (saved.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No saved quotes.</p>';
  } else {
    saved.slice().reverse().forEach(q => {
      const item = document.createElement('div');
      item.className = 'saved-quote-item';
      const d = new Date(q.savedAt);
      item.innerHTML = `
        <div>
          <div class="sq-title">${escHtml(q.project?.title || q.id)}</div>
          <div class="sq-meta">${d.toLocaleDateString()} — Ref: ${escHtml(q.id)}</div>
        </div>
        <button class="sq-del" data-id="${q.id}">✕</button>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('sq-del')) { deleteQuote(q.id); return; }
        loadQuote(q); closeLoadModal();
      });
      list.appendChild(item);
    });
  }
  modal.classList.remove('hidden');
}

function closeLoadModal() { $('modal-load').classList.add('hidden'); }

function loadQuote(data) {
  setProjectData(data.project);
  setTopSheetExtra(data.tsExtra);
  if (data.values) {
    Object.assign(STATE.itemValues, JSON.parse(JSON.stringify(data.values)));
    rebuildItemValues();
  }
  recalcAll();
  localStorage.setItem('alpha-quote-current', JSON.stringify(data));
  toast('Quote loaded!', 'success');
}

function deleteQuote(id) {
  if (!confirm('Delete this quote?')) return;
  let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  list = list.filter(q => q.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  openLoadModal();
}

/* ============================================================
   EXPORT / IMPORT
   ============================================================ */
function exportJSON() {
  const data = {
    id:      $('f-ref').value.trim() || 'quote',
    savedAt: new Date().toISOString(),
    project: getProjectData(),
    tsExtra: getTopSheetExtra(),
    values:  JSON.parse(JSON.stringify(STATE.itemValues)),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `quote-${data.id}-${data.savedAt.split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('Exported!', 'success');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { loadQuote(JSON.parse(ev.target.result)); toast('Imported!', 'success'); }
    catch { toast('Invalid JSON file', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ============================================================
   TOP SHEET
   ============================================================ */

// Maps Cons-sheet rows to QUOTE_STRUCTURE indices
const TOP_SHEET_ROWS = [
  { id: 'A',    label: 'Design & Coordination',          indices: [0],                             sub: false },
  { id: 'B',    label: 'Production Image',               indices: [1,2,3,4,5,6,7,8,9,10,11],      sub: false },
  { id: 'B-1',  label: 'Pre-Production',                 indices: [1],                             sub: true  },
  { id: 'B-2',  label: 'Talent',                         indices: [2],                             sub: true  },
  { id: 'B-3',  label: 'Shooting Crew',                  indices: [3],                             sub: true  },
  { id: 'B-4',  label: 'Shooting Crew Prod Service',     indices: [4],                             sub: true  },
  { id: 'B-5',  label: 'Equipment',                      indices: [5],                             sub: true  },
  { id: 'B-6',  label: 'Art Department & Beauty',        indices: [6],                             sub: true  },
  { id: 'B-7',  label: 'Studio',                         indices: [7],                             sub: true  },
  { id: 'B-8',  label: 'Locations',                      indices: [8],                             sub: true  },
  { id: 'B-9',  label: 'Production Photo',               indices: [9],                             sub: true  },
  { id: 'B-10', label: 'Hard Disks, Stock, Laboratory',  indices: [10],                            sub: true  },
  { id: 'B-11', label: 'Location Expenses, Misc.',       indices: [11],                            sub: true  },
  { id: 'C',    label: 'Post Production',                 indices: [12,13,14,15],                   sub: false },
  { id: 'C-1',  label: 'Post-Production Image',          indices: [12],                            sub: true  },
  { id: 'C-2',  label: 'Post-Production Sound & Music',  indices: [13],                            sub: true  },
  { id: 'C-3',  label: 'Production Digital',             indices: [14],                            sub: true  },
  { id: 'C-4',  label: 'Post-Production Print',          indices: [15],                            sub: true  },
  { id: 'D',    label: 'Global Delivery Service',        indices: [16],                            sub: false },
  { id: 'ST1',  label: 'Subtotal 1  (A → D)',            indices: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], sub: false, subtotal: true },
  { id: 'E',    label: 'Meals, Hotels & Per Diem',       indices: [17],                            sub: false },
  { id: 'F',    label: 'Travels',                        indices: [18],                            sub: false },
  { id: 'G',    label: 'Insurances',                     indices: [19],                            sub: false },
  { id: 'H',    label: 'Social Contributions',           indices: [20],                            sub: false },
  { id: 'ST2',  label: 'Subtotal 2  (E → H)',            indices: [17,18,19,20],                   sub: false, subtotal: true },
];

function buildTopSheetBudgetTable() {
  const tbody = $('ts-budget-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  TOP_SHEET_ROWS.forEach(row => {
    const tr = document.createElement('tr');
    if (row.subtotal) tr.className = 'ts-row-st';
    const nameClass = row.sub ? 'td-name sub-sec' : 'td-name main-sec';
    tr.innerHTML = `
      <td class="td-id">${row.id}</td>
      <td class="${nameClass}">${row.label}</td>
      <td id="ts-cost-${row.id}">—</td>
      <td id="ts-mk-${row.id}">—</td>
      <td id="ts-ttl-${row.id}">—</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateTopSheet() {
  // Mirror project info fields
  setSpan('ts-advertiser', $('f-advertiser')?.value);
  setSpan('ts-agency',     $('f-agency')?.value);
  setSpan('ts-product',    $('f-product')?.value);
  setSpan('ts-title',      $('f-title')?.value);
  setSpan('ts-director',   $('f-director')?.value);
  setSpan('ts-ep',         $('f-ep')?.value);
  setSpan('ts-ref-display', $('f-ref')?.value);
  setSpan('ts-date-display', fmtDate($('f-date')?.value));

  // Company header
  const house = $('ts-prod-house')?.value;
  setSpan('ts-company-display', house || $('f-agency')?.value || 'Production House');

  // Validity block
  const validity = parseInt($('f-validity')?.value) || 30;
  const dateStr  = $('f-date')?.value;
  setSpan('ts-validity-display', `${validity} days`);
  setSpan('ts-ref-display2', $('f-ref')?.value || '—');
  setSpan('ts-sig-date',     fmtDate(dateStr) || '—');
  setSpan('ts-sig-validity', `${validity} days`);

  if (dateStr) {
    const end = new Date(dateStr);
    end.setDate(end.getDate() + validity);
    const endStr = end.toISOString().split('T')[0];
    setSpan('ts-sig-end',    fmtDate(endStr));
    setSpan('ts-valid-until', fmtDate(endStr));
  }

  // Budget rows
  const margin = STATE.margin / 100;
  TOP_SHEET_ROWS.forEach(row => {
    let cost = 0;
    row.indices.forEach(idx => { cost += calcSecIndexTotal(idx); });
    const mk    = cost * margin;
    const total = cost + mk;
    const fmt   = v => v > 0 ? `${STATE.currency} ${formatMoney(v)}` : '—';

    const cEl = $(`ts-cost-${row.id}`);
    const mEl = $(`ts-mk-${row.id}`);
    const tEl = $(`ts-ttl-${row.id}`);
    if (cEl) { cEl.textContent = fmt(cost);  cEl.className = cost  > 0 ? 'td-nonzero' : ''; }
    if (mEl) { mEl.textContent = fmt(mk);    mEl.className = mk    > 0 ? 'td-nonzero' : ''; }
    if (tEl) { tEl.textContent = fmt(total); tEl.className = total > 0 ? 'td-nonzero' : ''; }
  });

  // L, M, Q, R totals
  let allCost = 0;
  QUOTE_STRUCTURE.forEach((_, idx) => { allCost += calcSecIndexTotal(idx); });
  const grossL   = allCost + allCost * margin;
  const cutdown  = parseFloat($('ts-cutdown')?.value) || 0;
  const totalM   = grossL - cutdown;
  const vatPct   = parseFloat($('ts-vat-pct')?.value) / 100 || 0.20;
  const vatAmt   = totalM * vatPct;
  const totalR   = totalM + vatAmt;

  setSpan('ts-L', `${STATE.currency} ${formatMoney(grossL)}`);
  setSpan('ts-M', `${STATE.currency} ${formatMoney(totalM)}`);
  setSpan('ts-Q', `${STATE.currency} ${formatMoney(vatAmt)}`);
  setSpan('ts-R', `${STATE.currency} ${formatMoney(totalR)}`);
}

function setSpan(id, val) {
  const el = $(id);
  if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') {
    el.textContent = val || '—';
  }
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---- Top Sheet Extra Fields ---- */
const TS_EXTRA_IDS = [
  'ts-music','ts-ag-producer','ts-prod-house','ts-line-prod',
  'ts-prod-service','ts-post-mgr','ts-nb-films','ts-duration',
  'ts-shoot-format','ts-del-format','ts-medias','ts-studio-loc',
  'ts-shoot-loc','ts-prep-days','ts-travel-days','ts-shoot-days',
  'ts-date-preprod','ts-date-shoot','ts-date-postprod','ts-date-delivery',
  'ts-cutdown','ts-vat-pct',
];

function getTopSheetExtra() {
  const out = {};
  TS_EXTRA_IDS.forEach(id => { const el = $(id); if (el) out[id] = el.value; });
  return out;
}

function setTopSheetExtra(data) {
  if (!data) return;
  TS_EXTRA_IDS.forEach(id => { const el = $(id); if (el && data[id] !== undefined) el.value = data[id]; });
}

/* ============================================================
   UTILS
   ============================================================ */
function formatMoney(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return n.toFixed(0);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---- Toast ---- */
let toastTimer;
function toast(msg, type = '') {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show', type), 2500);
}

/* ---- Scroll spy ---- */
window.addEventListener('scroll', () => {
  let closest = null, closestDist = Infinity;
  document.querySelectorAll('[id^="sec-"], #project-info, #top-sheet').forEach(el => {
    const dist = Math.abs(el.getBoundingClientRect().top);
    if (dist < closestDist) { closestDist = dist; closest = el.id; }
  });
  if (!closest) return;

  let target;
  if (closest === 'project-info') target = document.querySelector('.nav-item:first-child');
  else if (closest === 'top-sheet') target = document.querySelector('.nav-item[data-nav="topsheet"]');
  else {
    const idx = closest.replace('sec-', '');
    target = document.querySelector(`.nav-item[data-sec-idx="${idx}"]`);
  }
  if (target) setActiveNav(target);
}, { passive: true });
