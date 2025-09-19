/* ================= CONFIG ================= */
// Open Finance only
const issues = { finance: [] };

/* Ordenação padrão: ID desc (mais recente primeiro) */
const tableSort = { 'finance-table': { key: 'iid', asc: false } };

/* Conjuntos de labels por grupo */
const STATUS_LABELS = new Set([
  'Under Evaluation',
  'Waiting Participant',
  'Under WG/DTO Evaluation',
  'Evaluated by WG/DTO',
  'In Pipeline',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
]);

const NATURE_LABELS = new Set([
  'Questions', 'Bug', 'Change Request', 'Test Improvement', 'Breaking Change',
]);

const PLATFORM_LABELS = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);

/* Filtros ativos */
const selected = {
  nature: new Set(), phase: new Set(), platform: new Set(), product: new Set(), status: new Set()
};

/* ================= NORMALIZAÇÃO DE LABELS ================= */
const PHASE_RE = /^(?:phase)\s*(1|2|3|4a|4b)$/i;

function baseLabel(l) { return String(l || '').split('::')[0].trim(); }

function canonLabel(l) {
  const s = baseLabel(l);

  // Nature
  if (/^bug$/i.test(s)) return 'Bug';
  if (/^questions?$/i.test(s)) return 'Questions';
  if (/^change\s*request$/i.test(s)) return 'Change Request';
  if (/^test\s*improvement$/i.test(s)) return 'Test Improvement';
  if (/^breaking\s*change$/i.test(s)) return 'Breaking Change';

  // Status (todas as variações mapeadas)
  if (/^under\s*evaluation$/i.test(s)) return 'Under Evaluation';
  if (/^waiting\s*participant$/i.test(s)) return 'Waiting Participant';
  if (/^under\s*wg\/?dto\s*evaluation$/i.test(s)) return 'Under WG/DTO Evaluation';
  if (/^evaluated\s*by\s*wg\/?dto$/i.test(s)) return 'Evaluated by WG/DTO';
  if (/^in\s*pipeline$/i.test(s)) return 'In Pipeline';
  if (/^sandbox\s*testing$/i.test(s)) return 'Sandbox Testing';
  if (/^waiting\s*deploy$/i.test(s)) return 'Waiting Deploy';
  if (/^production\s*testing$/i.test(s)) return 'Production Testing';

  // Platform
  if (/^fvp$/i.test(s)) return 'FVP';
  if (/^mock\s*bank$/i.test(s)) return 'Mock Bank';
  if (/^mock\s*tpp$/i.test(s)) return 'Mock TPP';
  if (/^conformance\s*suite$/i.test(s)) return 'Conformance Suite';

  // Phase
  const pm = s.match(PHASE_RE);
  if (pm) return `Phase ${pm[1].toLowerCase()}`.replace(/\b\w/g, c => c.toUpperCase());

  // Fallback (vira Product)
  return s;
}

function classifyLabels(labels = []) {
  const status = [], nature = [], product = [], phase = [], platform = [];
  labels.forEach(raw => {
    const canon = canonLabel(raw);
    if (STATUS_LABELS.has(canon))   { status.push(canon);   return; }
    if (NATURE_LABELS.has(canon))   { nature.push(canon);   return; }
    if (PLATFORM_LABELS.has(canon)) { platform.push(canon); return; }
    if (/^Phase\s*(1|2|3|4a|4b)$/i.test(canon)) { phase.push(canon); return; }
    product.push(canon);
  });
  return { status, nature, product, phase, platform };
}

/* ================= DIAS ÚTEIS ================= */
function workingDaysBetween(startDate, endDate) {
  let count = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* ================= SLA ================= */
// Regra: Bug sempre 10 dias úteis (bypass pausa)
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);
  const hasBug = nature.includes('Bug');
  const hasQuestions = nature.includes('Questions');
  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;

  if (hasBug) return { days: 10, reason: 'Bug' };
  if (underEval || noNature) return { days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };
  if (hasQuestions) return { days: 10, reason: 'Questions' };
  return { days: null, reason: 'No SLA' };
}

function slaLabelAndRank(issue) {
  const labels = issue.labels || [];
  const { status, nature } = classifyLabels(labels);
  const isBug = nature.includes('Bug');

  // NOVO: "Production Testing" pausa SEMPRE, até se for Bug
  const hasProdTesting = status.includes('Production Testing');

  // Os demais status de pausa só pausam se NÃO for Bug
  const otherPause =
    status.includes('Under WG/DTO Evaluation') ||
    status.includes('Waiting Participant')     ||
    status.includes('In Pipeline')             ||
    status.includes('Sandbox Testing')         ||
    status.includes('Waiting Deploy');

  const paused = hasProdTesting || (!isBug && otherPause);

  if (paused) return { text: 'SLA Paused', class: 'paused', rank: 2 };

  const slaDays = issue.sla.days;
  const hasSLA = Number.isInteger(slaDays);
  const over = hasSLA ? issue.daysOpen > slaDays : false;

  if (!hasSLA) return { text: 'No SLA', class: 'nosla', rank: 0 };
  if (over)     return { text: 'Over SLA', class: 'over-sla', rank: 3 };
  return { text: 'Within SLA', class: 'within-sla', rank: 1 };
}

/* ================= NOTAS ================= */
function saveComment(key, value) { localStorage.setItem(key, value); }
function clearAllComments() {
  if (!confirm('Are you sure you want to clear ALL comments? This cannot be undone.')) return;
  document.querySelectorAll('.comment-box').forEach(a => {
    localStorage.removeItem(a.dataset.key);
    a.value = '';
  });
}

/* ================= FILTROS (UI) ================= */
function renderFilterMenus() {
  const natureSet = new Set(), phaseSet = new Set(), platformSet = new Set(),
        productSet = new Set(), statusSet = new Set();

  issues.finance.forEach(i => {
    const { status, nature, product, phase, platform } = classifyLabels(i.labels || []);
    status.forEach(l => statusSet.add(l));
    nature.forEach(l => natureSet.add(l));
    product.forEach(l => productSet.add(l));
    phase.forEach(l => phaseSet.add(l));
    platform.forEach(l => platformSet.add(l));
  });

  const fill = (containerId, values, cat) => {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.row').forEach(r => r.remove());
    [...values].sort().forEach(tag => {
      const row = document.createElement('div');
      row.className = 'row';
      const id = `${cat}-${tag.replace(/[^a-z0-9-_]+/gi, '_')}`;
      row.innerHTML = `
        <input type="checkbox" id="${id}" ${selected[cat].has(tag) ? 'checked' : ''} />
        <label for="${id}">${tag}</label>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selected[cat].add(tag); else selected[cat].delete(tag);
        updateCounts(); renderChips(); renderIssues();
      });
      container.appendChild(row);
    });
  };

  fill('menu-nature',   natureSet,   'nature');
  fill('menu-phase',    phaseSet,    'phase');
  fill('menu-platform', platformSet, 'platform');
  fill('menu-product',  productSet,  'product');
  fill('menu-status',   statusSet,   'status');

  updateCounts(); renderChips();
}

function updateCounts() {
  document.getElementById('count-nature').textContent   = selected.nature.size;
  document.getElementById('count-phase').textContent    = selected.phase.size;
  document.getElementById('count-platform').textContent = selected.platform.size;
  document.getElementById('count-product').textContent  = selected.product.size;
  document.getElementById('count-status').textContent   = selected.status.size;
}

function clearCategory(cat) {
  selected[cat].clear();
  renderFilterMenus(); renderIssues();
}

function renderChips() {
  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  ['nature','phase','platform','product','status'].forEach(cat => {
    selected[cat].forEach(tag => {
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = `${cat}: ${tag} <span class="x" title="Remove">✕</span>`;
      el.querySelector('.x').onclick = () => {
        selected[cat].delete(tag);
        renderFilterMenus(); renderIssues();
      };
      chips.appendChild(el);
    });
  });
}

function resetAllFilters() {
  Object.values(selected).forEach(s => s.clear());
  document.querySelectorAll('.filter details[open]').forEach(d => { d.open = false; });
  renderFilterMenus(); renderIssues();
}

/* Fecha details ao clicar fora */
document.addEventListener('click', (e) => {
  const insideFilter = e.target.closest('.filter');
  if (!insideFilter) {
    document.querySelectorAll('.filter details[open]').forEach(d => d.removeAttribute('open'));
  }
});

/* ================= SORTING ================= */
function changeSort(tableId, key) {
  const s = tableSort[tableId];
  if (s.key === key) s.asc = !s.asc; else { s.key = key; s.asc = (key === 'title'); }
  updateSortArrows(tableId); renderIssues();
}
function updateSortArrows(tableId) {
  const table = document.getElementById(tableId);
  table.querySelectorAll('.sort-arrow').forEach(el => el.textContent = '');
  const s = tableSort[tableId];
  const arrow = table.querySelector(`.sort-arrow[data-for="${s.key}"]`);
  if (arrow) arrow.textContent = s.asc ? '▲' : '▼';
}
function getViewMode() { return document.getElementById('viewMode').value; }

/* ================= MODAL (editor grande) ================= */
let editorKey = null;
const modalEl = () => document.getElementById('noteModal');
const editorTitleEl = () => document.getElementById('noteEditorTitle');
const editorTextEl = () => document.getElementById('noteEditorTextarea');

function openEditor(key, title, currentVal){
  const m = modalEl();
  if (!m) return; // se não existir modal, ignora
  editorKey = key;
  if (editorTitleEl()) {
    editorTitleEl().innerHTML = `<a href="${title.url}" target="_blank" style="color:var(--accent)">#${title.iid}</a> — ${title.text}`;
  }
  if (editorTextEl()) editorTextEl().value = currentVal || '';
  m.style.display = 'block';
}
function closeEditor(){ const m = modalEl(); if (m) m.style.display = 'none'; editorKey = null; }
function saveEditor(){
  if (!editorKey) return;
  const val = editorTextEl() ? editorTextEl().value : '';
  localStorage.setItem(editorKey, val);
  const small = document.querySelector(`textarea.comment-box[data-key="${editorKey}"]`);
  if (small) small.value = val;
  closeEditor();
}

/* ================= DATA ================= */
function setLoading(on) { const el = document.getElementById('loading'); if (el) el.style.display = on ? 'block' : 'none'; }

async function loadAllIssues() {
  setLoading(true);
  issues.finance = [];

  const mode = getViewMode();
  const dateLbl = document.getElementById('finance-date-label');
  if (dateLbl) dateLbl.textContent = mode === 'closed7' ? 'Closed At' : 'Created At';

  await loadProjectIssues(26426113, 'finance');

  renderFilterMenus();
  updateSortArrows('finance-table');
  renderIssues();
  setLoading(false);
}

async function loadProjectIssues(projectId, key) {
  const mode = getViewMode();
  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  let url = `https://gitlab.com/api/v4/projects/${projectId}/issues`;
  if (mode === 'closed7')
    url += `?state=closed&per_page=100&order_by=created_at&sort=asc&updated_after=${since}`;
  else
    url += `?state=opened&per_page=100&order_by=created_at&sort=asc`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let list = data.map(issue => ({ ...issue, projectId }));
    if (mode === 'closed7') {
      const cutoff = new Date(since);
      list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff);
    }
    issues[key] = list;
  } catch (err) {
    console.error('Failed to load issues', { projectId, err });
    issues[key] = [];
  }
}

/* ================= RENDER ================= */
function renderEmptyRow(tbody, colspan, message) {
  const tr = document.createElement('tr');
  tr.className = 'empty-state';
  tr.innerHTML = `<td class="empty-cell" colspan="${colspan}">${message}</td>`;
  tbody.appendChild(tr);
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

function renderIssues() {
  const mode = getViewMode();
  const tbody = document.querySelector('#finance-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const now = new Date();
  const decorate = (list) => list.map(i => {
    const created = new Date(i.created_at);
    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;
    const daysOpen = workingDaysBetween(created, endDate);

    const sla = (mode === 'closed7') ? { days:null } : getSLAFor(i.labels || []);
    const base = { ...i, daysOpen, dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at, sla };

    let text='—', rank=-1, klass='nosla';
    if (mode !== 'closed7') {
      const r = slaLabelAndRank(base);
      text = r.text; rank = r.rank; klass = r.class;
    }
    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  const base = decorate(issues.finance);

  const summaryEl = document.getElementById('finance-summary');

  if (base.length === 0) {
    const msg = (mode === 'closed7')
      ? 'No issues were closed in the last 7 days.'
      : 'No open issues at the moment.';
    renderEmptyRow(tbody, 11, msg);
    if (summaryEl) {
      summaryEl.textContent =
        (mode === 'closed7')
          ? '0 issues closed in last 7 days'
          : '0 public open issues — SLA-applicable: 0, Over SLA: 0';
    }
    updateSortArrows('finance-table');
    return;
  }

  const filtered = base.filter(i => {
    const { status, nature, product, phase, platform } = classifyLabels(i.labels || []);
    const matchNature   = selected.nature.size   ? nature.some(n => selected.nature.has(n))       : true;
    const matchPhase    = selected.phase.size    ? phase.some(p => selected.phase.has(p))          : true;
    const matchPlatform = selected.platform.size ? platform.some(p => selected.platform.has(p))    : true;
    const matchProduct  = selected.product.size  ? product.some(p => selected.product.has(p))      : true;
    const matchStatus   = selected.status.size   ? status.some(s => selected.status.has(s))        : true;
    return matchNature && matchPhase && matchPlatform && matchProduct && matchStatus;
  });

  const sort = tableSort['finance-table'];
  const sorted = filtered.sort((a, b) => {
    let va, vb;
    switch (sort.key) {
      case 'iid':      va = Number(a.iid); vb = Number(b.iid); break;
      case 'daysOpen': va = Number(a.daysOpen); vb = Number(b.daysOpen); break;
      case 'dateCol':  va = new Date(a.dateCol).getTime(); vb = new Date(b.dateCol).getTime(); break;
      case 'slaRank':  va = Number(a.slaRank); vb = Number(b.slaRank); break;
      case 'title':
      default:         va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase();
    }
    if (va < vb) return sort.asc ? -1 : 1;
    if (va > vb) return sort.asc ? 1 : -1;
    return 0;
  });

  if (sorted.length === 0) {
    renderEmptyRow(tbody, 11, 'No issues match the selected filters. Try clearing filters or switching the view.');
    if (summaryEl) {
      summaryEl.textContent =
        (mode === 'closed7')
          ? '0 issues closed in last 7 days'
          : '0 public open issues — SLA-applicable: 0, Over SLA: 0';
    }
    updateSortArrows('finance-table');
    return;
  }

  const counters = { total: 0, slaApplicable: 0, over: 0 };

  sorted.forEach(issue => {
    const modeNow = getViewMode();
    const dateShown = (modeNow === 'closed7' && issue.closed_at)
      ? new Date(issue.closed_at)
      : new Date(issue.created_at);

    const slaDays = issue.sla.days;
    const hasSLA = (modeNow !== 'closed7') && Number.isInteger(slaDays);
    const over = hasSLA ? (issue.daysOpen > slaDays) : false;

    const key = `comment-${issue.projectId}-${issue.iid}`;
    const saved = localStorage.getItem(key) || '';

    const { status, nature, product, phase, platform } = classifyLabels(issue.labels || []);

    // badges (mantém seu tema; adiciona classes extras quando necessário)
    const badges = (arr) => arr.length
      ? arr.map(l => {
          const extra =
            (l === 'Bug') ? ' badge-bug' :
            (l === 'Under WG/DTO Evaluation') ? ' badge-status-ugdto' : '';
          return `<span class="badge${extra}">${l}</span>`;
        }).join(' ')
      : '<span style="opacity:.5;">—</span>';

    const statusCell = (modeNow === 'closed7')
      ? '—'
      : `<span class="${issue.slaClass}">${issue.slaText}</span>`;

    const tr = document.createElement('tr');
    tr.className = (modeNow === 'closed7') ? 'closed-issue' : '';
    tr.innerHTML = `
      <td><a href="${issue.web_url}" target="_blank" style="color:var(--accent);">#${issue.iid}</a></td>
      <td>${issue.title}${modeNow === 'closed7' ? '<span class="closed-badge">Closed</span>' : ''}</td>
      <td>${dateShown.toLocaleDateString()}</td>
      <td style="text-align:center">${issue.daysOpen}</td>
      <td>${statusCell}</td>
      <td>${badges(nature)}</td>
      <td>${badges(phase)}</td>
      <td>${badges(platform)}</td>
      <td>${badges(product)}</td>
      <td>${badges(status)}</td>
      <td>
        <div>
          <textarea class="comment-box" data-key="${key}">${saved}</textarea>
          <button class="open-editor" data-key="${key}" data-iid="${issue.iid}" data-url="${issue.web_url}" data-title="${escapeHtml(issue.title)}" style="margin-top:6px">Open editor</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // sync do textarea pequeno
    const small = tr.querySelector(`textarea.comment-box[data-key="${key}"]`);
    small.addEventListener('input', e=> localStorage.setItem(key, e.target.value));

    // abrir editor grande
    const btn = tr.querySelector(`button.open-editor[data-key="${key}"]`);
    btn.onclick = () => openEditor(
      key,
      { iid: btn.dataset.iid, text: btn.dataset.title, url: btn.dataset.url },
      localStorage.getItem(key) || ''
    );

   counters.total++;
if (mode !== 'closed7') {
  const cls = issue.slaClass; // 'within-sla' | 'over-sla' | 'paused' | 'nosla'
  if (cls !== 'paused') counters.slaApplicable++; // tudo que NÃO é "SLA Paused"
  if (cls === 'over-sla') counters.over++;
}
  });

  if (summaryEl) {
    summaryEl.textContent =
      (mode === 'closed7')
        ? `${counters.total} issues closed in last 7 days`
        : `${counters.total} public open issues — SLA-applicable: ${counters.slaApplicable}, Over SLA: ${counters.over}`;
  }

  updateSortArrows('finance-table');
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  // modal (opcional — só conecta handlers se existir)
  const m = document.getElementById('noteModal');
  if (m) {
    const closeBtn = document.getElementById('noteEditorClose');
    const saveBtn  = document.getElementById('noteEditorSave');
    if (closeBtn) closeBtn.onclick = closeEditor;
    if (saveBtn)  saveBtn.onclick  = saveEditor;
    m.addEventListener('click', (e)=> { if (e.target.id === 'noteModal') closeEditor(); });
  }
  loadAllIssues();
});
