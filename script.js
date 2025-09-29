/* ================= CONFIG ================= */
const issues = { finance: [] };
const tableSort = { 'finance-table': { key: 'iid', asc: false } };

/* Label history toggle (100% via Netlify proxy; sem PAT) */
let USE_LABEL_EVENTS = JSON.parse(localStorage.getItem('use_label_events') || 'false');
function updateTimelineToggleUi(){
  const b=document.getElementById('timelineToggle');
  if(b){ b.textContent = `Label history: ${USE_LABEL_EVENTS ? 'ON':'OFF'}`; }
}

/* ======== Taxonomias ======== */
const STATUS_LABELS = new Set([
  'Under Evaluation',
  'Waiting Participant',
  'Under WG/DTO Evaluation',
  'Evaluated by WG/DTO',
  'Backlog',
  'In Progress',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
  'Deprioritized',
]);

const NATURE_LABELS = new Set([
  'Questions', 'Bug', 'Change Request', 'Test Improvement', 'Breaking Change',
]);

const PLATFORM_LABELS = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);

const WG_LABELS = new Set([
  'GT Serviços',
  'GT Portabilidade de crédito',
  'Squad Sandbox',
  'Squad JSR',
]);

/* Filtros ativos */
const selected = {
  nature: new Set(), platform: new Set(), product: new Set(), wg: new Set(), status: new Set()
};

/* ================= NORMALIZAÇÃO ================= */
function baseLabel(l){ return String(l||'').split('::')[0].trim(); }

function canonLabel(l){
  const s = baseLabel(l);

  // Nature
  if (/^bug$/i.test(s)) return 'Bug';
  if (/^questions?$/i.test(s)) return 'Questions';
  if (/^change\s*request$/i.test(s)) return 'Change Request';
  if (/^test\s*improvement$/i.test(s)) return 'Test Improvement';
  if (/^breaking\s*change$/i.test(s)) return 'Breaking Change';

  // Status
  if (/^under\s*evaluation$/i.test(s)) return 'Under Evaluation';
  if (/^waiting\s*participant$/i.test(s)) return 'Waiting Participant';
  if (/^under\s*wg\/?dto\s*evaluation$/i.test(s)) return 'Under WG/DTO Evaluation';
  if (/^evaluated\s*by\s*wg\/?dto$/i.test(s)) return 'Evaluated by WG/DTO';
  if (/^backlog$/i.test(s)) return 'Backlog';
  if (/^in\s*progress$/i.test(s)) return 'In Progress';
  if (/^sandbox\s*testing/i.test(s)) return 'Sandbox Testing';
  if (/^waiting\s*deploy$/i.test(s)) return 'Waiting Deploy';
  if (/^production\s*testing/i.test(s)) return 'Production Testing';
  if (/^depri(or)?it?i?zed$/i.test(s) || /^deprioritized$/i.test(s)) return 'Deprioritized';

  // Platform
  if (/^fvp$/i.test(s)) return 'FVP';
  if (/^mock\s*bank$/i.test(s)) return 'Mock Bank';
  if (/^mock\s*tpp$/i.test(s)) return 'Mock TPP';
  if (/^conformance\s*suite$/i.test(s)) return 'Conformance Suite';

  // Working Group
  if (/^gt\s*serv(i|í)ços$/i.test(s)) return 'GT Serviços';
  if (/^gt\s*portabilidade\s*de\s*cr(e|é)dito$/i.test(s)) return 'GT Portabilidade de crédito';
  if (/^squad\s*sandbox$/i.test(s)) return 'Squad Sandbox';
  if (/^squad\s*jsr$/i.test(s)) return 'Squad JSR';

  return s;
}

function classifyLabels(labels = []) {
  const status = [], nature = [], product = [], platform = [], wg = [];
  labels.forEach(raw => {
    const canon = canonLabel(raw);
    if (STATUS_LABELS.has(canon))   { status.push(canon);   return; }
    if (NATURE_LABELS.has(canon))   { nature.push(canon);   return; }
    if (PLATFORM_LABELS.has(canon)) { platform.push(canon); return; }
    if (WG_LABELS.has(canon))       { wg.push(canon);       return; }
    product.push(canon);
  });
  return { status, nature, product, platform, wg };
}

/* ================= DATA UTILS ================= */
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

/* Soma dias úteis de múltiplos intervalos */
function workingDaysInIntervals(intervals){
  let total = 0;
  intervals.forEach(({start,end})=>{
    if (end <= start) return;
    total += workingDaysBetween(start, end);
  });
  return total;
}

/* ================= SLA ================= */
/* Nova regra: No SLA para Change Request / Breaking Change / Test Improvement */
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);

  // No SLA
  if (nature.includes('Change Request') || nature.includes('Breaking Change') || nature.includes('Test Improvement')) {
    return { type:'nosla' };
  }

  // Paused (sempre)
  const paused = (
    status.includes('Under WG/DTO Evaluation') ||
    status.includes('In Progress') ||
    status.includes('Backlog') ||
    status.includes('Sandbox Testing') ||
    status.includes('Waiting Deploy') ||
    status.includes('Production Testing')
  );
  if (paused) return { type: 'paused' };

  // Timed
  if (status.includes('Waiting Participant')) return { type: 'timed', days: 5, reason: 'Waiting Participant' };

  const hasBug = nature.includes('Bug');
  const hasQuestions = nature.includes('Questions');
  if (hasBug || hasQuestions) return { type: 'timed', days: 10, reason: hasBug ? 'Bug' : 'Questions' };

  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;
  if (underEval || noNature) return { type: 'timed', days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };

  return { type: 'none' };
}

function slaLabelAndRank(issue) {
  const rule = issue.sla;
  if (rule.type === 'paused') return { text: 'SLA Paused', class: 'paused', rank: 2 };
  if (rule.type === 'nosla')  return { text: 'No SLA',     class: 'nosla',  rank: 0 };
  if (rule.type === 'none')   return { text: 'No SLA',     class: 'nosla',  rank: 0 }; // mantém “No SLA” para casos raros
  // timed
  const over = issue.daysOpen > (rule.days || 0);
  if (over) return { text: 'Over SLA', class: 'over-sla', rank: 3 };
  return     { text: 'Within SLA', class: 'within-sla',   rank: 1 };
}

/* ================= COMMENTS ================= */
function saveComment(key, value) { localStorage.setItem(key, value); }
function clearAllComments() {
  if (!confirm('Are you sure you want to clear ALL comments? This cannot be undone.')) return;
  document.querySelectorAll('.comment-box').forEach(a => {
    localStorage.removeItem(a.dataset.key);
    a.value = '';
  });
}

/* ================= FILTERS ================= */
function renderFilterMenus() {
  const natureSet = new Set(), platformSet = new Set(),
        productSet = new Set(), statusSet = new Set(), wgSet = new Set();

  issues.finance.forEach(i => {
    const { status, nature, product, platform, wg } = classifyLabels(i.labels || []);
    status.forEach(l => statusSet.add(l));
    nature.forEach(l => natureSet.add(l));
    product.forEach(l => productSet.add(l));
    platform.forEach(l => platformSet.add(l));
    wg.forEach(l => wgSet.add(l));
  });

  const fill = (containerId, values, cat) => {
    const container = document.getElementById(containerId);
    if (!container) return;
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
  fill('menu-platform', platformSet, 'platform');
  fill('menu-product',  productSet,  'product');
  fill('menu-status',   statusSet,   'status');
  fill('menu-wg',       wgSet,       'wg');

  updateCounts(); renderChips();
}
function updateCounts() {
  const nn = document.getElementById('count-nature');   if (nn) nn.textContent   = selected.nature.size;
  const np = document.getElementById('count-platform'); if (np) np.textContent   = selected.platform.size;
  const nr = document.getElementById('count-product');  if (nr) nr.textContent   = selected.product.size;
  const ns = document.getElementById('count-status');   if (ns) ns.textContent   = selected.status.size;
  const wg = document.getElementById('count-wg');       if (wg) wg.textContent   = selected.wg.size;
}
function clearCategory(cat) { selected[cat].clear(); renderFilterMenus(); renderIssues(); }
function renderChips() {
  const chips = document.getElementById('chips'); if (!chips) return;
  chips.innerHTML = '';
  ['nature','platform','product','wg','status'].forEach(cat => {
    selected[cat].forEach(tag => {
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = `${cat}: ${tag} <span class="x" title="Remove">✕</span>`;
      el.querySelector('.x').onclick = () => {
        selected[cat].delete(tag); renderFilterMenus(); renderIssues();
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

/* ================= GITLAB AUX (via Netlify) ================= */
async function proxyGetJSON(path){
  const url = `/.netlify/functions/gitlab?path=${encodeURIComponent(path)}&per_page=100`;
  const res = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* Label events */
async function fetchLabelEvents(projectId, iid){
  if (!USE_LABEL_EVENTS) return [];
  try {
    return await proxyGetJSON(`/projects/${projectId}/issues/${iid}/resource_label_events`);
  } catch (err){
    console.warn('Label events fetch error', projectId, iid, err);
    return [];
  }
}

/* State events (para reopened) */
async function fetchStateEvents(projectId, iid){
  if (!USE_LABEL_EVENTS) return [];
  try {
    return await proxyGetJSON(`/projects/${projectId}/issues/${iid}/resource_state_events`);
  } catch (err){
    console.warn('State events fetch error', projectId, iid, err);
    return [];
  }
}

function timelineFromLabelEvents(evts){
  return evts
    .filter(e => e && e.label && e.label.name && (e.action === 'add' || e.action === 'remove'))
    .map(e => ({ when:new Date(e.created_at), label: canonLabel(e.label.name), action:e.action }))
    .sort((a,b)=> a.when - b.when);
}

function lastReopenDateFromStateEvents(evts){
  if (!Array.isArray(evts)) return null;
  // considera 'reopened' explicitamente; alguns retornam 'opened' após closed
  const candidates = evts
    .filter(e => /reopened|opened/i.test(e.state))
    .map(e => new Date(e.created_at))
    .sort((a,b)=> b - a);
  return candidates[0] || null;
}

/* Constrói intervalos pausados: add abre, remove fecha */
const PAUSE_LABELS = new Set([
  'Under WG/DTO Evaluation',
  'In Progress',
  'Backlog',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
]);

function pausedIntervals(timeline, windowStart, windowEnd){
  const intervals = [];
  const openMap = new Map(); // label -> startDate
  timeline.forEach(ev=>{
    if (!PAUSE_LABELS.has(ev.label)) return;
    if (ev.action === 'add'){
      openMap.set(ev.label, ev.when);
    } else if (ev.action === 'remove'){
      const st = openMap.get(ev.label);
      if (st){
        const s = new Date(Math.max(st.getTime(), windowStart.getTime()));
        const e = new Date(Math.min(ev.when.getTime(), windowEnd.getTime()));
        if (e > s) intervals.push({start:s, end:e, label:ev.label});
        openMap.delete(ev.label);
      }
    }
  });
  // Labels ainda abertas até o fim da janela
  openMap.forEach((st, label)=>{
    const s = new Date(Math.max(st.getTime(), windowStart.getTime()));
    const e = new Date(windowEnd);
    if (e > s) intervals.push({start:s, end:e, label});
  });
  return intervals;
}

/* ================= DATA ================= */
function setLoading(on){ const el=document.getElementById('loading'); if (el) el.style.display = on ? 'block':'none'; }

async function loadAllIssues(){
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

async function loadProjectIssues(projectId, key){
  const mode = getViewMode();
  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  let url = `/projects/${projectId}/issues?per_page=100`;
  url += (mode === 'closed7') ? `&state=closed&updated_after=${encodeURIComponent(since)}` : `&state=opened`;

  try{
    const data = await proxyGetJSON(url);
    let list = data.map(issue => ({ ...issue, projectId }));
    if (mode === 'closed7') {
      const cutoff = new Date(since);
      list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff);
    }

    if (USE_LABEL_EVENTS && mode !== 'closed7'){
      // carrega timelines
      for (const it of list){
        const [lev, sev] = await Promise.all([
          fetchLabelEvents(projectId, it.iid),
          fetchStateEvents(projectId, it.iid),
        ]);
        it._labelTimeline = timelineFromLabelEvents(lev);
        it._lastReopen = lastReopenDateFromStateEvents(sev);
      }
    }

    issues[key] = list;
  }catch(err){
    console.error('Failed to load issues', { projectId, url, err });
    issues[key] = [];
  }
}

/* ================= RENDER ================= */
function renderEmptyRow(tbody, colspan, message){
  const tr = document.createElement('tr');
  tr.className = 'empty-state';
  tr.innerHTML = `<td class="empty-cell" colspan="${colspan}">${message}</td>`;
  tbody.appendChild(tr);
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

function renderIssues(){
  const mode = getViewMode();
  const tbody = document.querySelector('#finance-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const now = new Date();

  const decorate = (list) => list.map(i => {
    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;

    // SLA tipo
    const sla = (mode === 'closed7') ? { type:'nosla' } : getSLAFor(i.labels || []);

    // start base
    let start = new Date(i.created_at);

    // (A) Reopened mais recente
    if (USE_LABEL_EVENTS && i._lastReopen && i._lastReopen > start){
      start = new Date(i._lastReopen);
    }

    // (B) Para Bug, se houver REMOÇÃO de Deprioritized mais recente que start, usa essa data
    if (USE_LABEL_EVENTS && Array.isArray(i._labelTimeline)){
      const labels = classifyLabels(i.labels||[]);
      if (labels.nature.includes('Bug')){
        const lastDeprRemoved = [...i._labelTimeline].reverse()
          .find(ev => ev.label === 'Deprioritized' && ev.action === 'remove');
        if (lastDeprRemoved && lastDeprRemoved.when > start){
          start = new Date(lastDeprRemoved.when);
        }
      }
    }

    // Dias úteis "brutos"
    let rawDays = workingDaysBetween(start, endDate);

    // Subtrai pausas (label history ON)
    let pausedDays = 0;
    let pauseIntervals = [];
    if (USE_LABEL_EVENTS && Array.isArray(i._labelTimeline) && i._labelTimeline.length){
      pauseIntervals = pausedIntervals(i._labelTimeline, start, endDate);
      pausedDays = workingDaysInIntervals(pauseIntervals);
    }

    // dias líquidos
    const netDays = Math.max(0, rawDays - pausedDays);

    // aplicar "No SLA" => Working Days deve exibir "—"
    const daysOpen = (sla.type === 'nosla') ? null : netDays;

    const base = {
      ...i,
      daysOpen,
      dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at,
      sla,
      _history: { start, endDate, rawDays, pausedDays, pauseIntervals }
    };

    const { text, rank, class: klass } = (mode === 'closed7')
      ? { text:'—', rank:-1, class:'nosla' }
      : slaLabelAndRank({ ...base, daysOpen: (daysOpen ?? 0) });

    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  const base = decorate(issues.finance);
  const summaryEl = document.getElementById('finance-summary');

  if (base.length === 0){
    const msg = (mode === 'closed7') ? 'No issues were closed in the last 7 days.' : 'No open issues at the moment.';
    renderEmptyRow(tbody, 11, msg);
    if (summaryEl){
      summaryEl.textContent = (mode === 'closed7')
        ? '0 issues closed in last 7 days'
        : '0 public open issues — SLA-applicable: 0, Over SLA: 0, No SLA: 0';
    }
    updateSortArrows('finance-table');
    return;
  }

  // filtros
  const filtered = base.filter(i => {
    const { status, nature, product, platform, wg } = classifyLabels(i.labels || []);
    const matchNature   = selected.nature.size   ? nature.some(n => selected.nature.has(n))       : true;
    const matchPlatform = selected.platform.size ? platform.some(p => selected.platform.has(p))    : true;
    const matchProduct  = selected.product.size  ? product.some(p => selected.product.has(p))      : true;
    const matchWG       = selected.wg.size       ? wg.some(w => selected.wg.has(w))                : true;
    const matchStatus   = selected.status.size   ? status.some(s => selected.status.has(s))        : true;
    return matchNature && matchPlatform && matchProduct && matchWG && matchStatus;
  });

  // sorting
  const s = tableSort['finance-table'];
  const sorted = filtered.sort((a,b)=>{
    let va, vb;
    switch (s.key) {
      case 'iid':      va = Number(a.iid); vb = Number(b.iid); break;
      case 'daysOpen': va = Number(a.daysOpen ?? -1); vb = Number(b.daysOpen ?? -1); break;
      case 'dateCol':  va = new Date(a.dateCol).getTime(); vb = new Date(b.dateCol).getTime(); break;
      case 'slaRank':  va = Number(a.slaRank); vb = Number(b.slaRank); break;
      case 'title':
      default:         va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase();
    }
    if (va < vb) return s.asc ? -1 : 1;
    if (va > vb) return s.asc ? 1 : -1;
    return 0;
  });

  // counters
  let total = 0, applicable = 0, over = 0, noslaCount = 0;

  // render rows
  sorted.forEach(issue=>{
    const { status, nature, product, platform, wg } = classifyLabels(issue.labels || []);
    const clsFor = (l) => (l==='Bug' ? ' badge-bug' : (l==='Under WG/DTO Evaluation' ? ' badge-ugdto' : ''));
    const badge = arr => arr.length
      ? arr.map(l=>`<span class="badge${clsFor(l)}">${escapeHtml(l)}</span>`).join(' ')
      : '<span style="opacity:.5;">—</span>';

    const rowIsPaused = issue.sla.type === 'paused';
    const isNoSLA     = issue.sla.type === 'nosla';
    const isOver      = (issue.sla.type === 'timed') && (Number(issue.daysOpen) > (issue.sla.days||0));

    total++;
    if (isNoSLA) noslaCount++;
    if (issue.sla.type === 'timed') {
      applicable++;
      if (isOver) over++;
    }

    const key = `comment-${issue.projectId}-${issue.iid}`;
    const saved = localStorage.getItem(key) || '';

    // Working days cell: número + botão 🕒 (sem tooltip). Para No SLA, apenas —
    let wdCell = '—';
    if (!isNoSLA){
      const n = Number(issue.daysOpen ?? 0);
      const canShowBtn = USE_LABEL_EVENTS && Array.isArray(issue._labelTimeline) && issue._labelTimeline.length>0;
      wdCell = `${n}${canShowBtn ? ` <button class="btn-hist" data-iid="${issue.iid}">🕒</button>` : ''}`;
    }

    const slaCell = `<span class="${issue.slaClass}">${issue.slaText}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${issue.web_url}" target="_blank" style="color:var(--accent);">#${issue.iid}</a></td>
      <td>${escapeHtml(issue.title)}${mode === 'closed7' ? '<span class="closed-badge">Closed</span>' : ''}</td>
      <td>${new Date(issue.dateCol).toLocaleDateString()}</td>
      <td>${wdCell}</td>
      <td>${slaCell}</td>
      <td>${badge(nature)}</td>
      <td>${badge(platform)}</td>
      <td>${badge(product)}</td>
      <td>${badge(wg)}</td>
      <td>${badge(status)}</td>
      <td>
        <textarea class="comment-box" rows="2" data-key="${key}" oninput="saveComment('${key}', this.value)">${saved}</textarea>
        <div style="margin-top:6px">
          <button class="btn-open-editor"
                  data-key="${key}"
                  data-iid="${issue.iid}"
                  data-url="${issue.web_url}"
                  data-title="${encodeURIComponent(issue.title)}">...</button>
        </div>
      </td>
    `;
    // guarda objeto completo para abrir history
    tr.dataset.issue = JSON.stringify({
      iid: issue.iid, web_url: issue.web_url, title: issue.title,
      _history: issue._history, _labelTimeline: issue._labelTimeline
    });

    tbody.appendChild(tr);
  });

  if (summaryEl){
    summaryEl.textContent = `${total} public open issues — SLA-applicable: ${applicable}, Over SLA: ${over}, No SLA: ${noslaCount}`;
  }

  updateSortArrows('finance-table');
}

/* ================= MODALS ================= */
let editorKey = null;

function openEditor(key, meta, currentVal){
  const modal = document.getElementById('noteModal');
  const title = document.getElementById('noteEditorTitle');
  const ta    = document.getElementById('noteEditorTextarea');
  if (!modal || !title || !ta) return;
  editorKey = key;
  title.innerHTML = `<a href="${meta.url}" target="_blank" style="color:var(--accent)">#${meta.iid}</a> — ${meta.text}`;
  ta.value = currentVal || '';
  modal.style.display = 'block';
}
function closeEditor(){
  const modal = document.getElementById('noteModal');
  if (modal) modal.style.display = 'none';
  editorKey = null;
}
function saveEditor(){
  if (!editorKey) return;
  const ta = document.getElementById('noteEditorTextarea');
  const val = ta ? ta.value : '';
  localStorage.setItem(editorKey, val);
  const small = document.querySelector(`textarea.comment-box[data-key="${editorKey}"]`);
  if (small) small.value = val;
  closeEditor();
}

/* History modal */
function openHistoryModal(meta){
  const modal = document.getElementById('historyModal');
  const title = document.getElementById('historyTitle');
  const body  = document.getElementById('historyBody');
  if (!modal || !title || !body) return;

  title.innerHTML = `<a href="${meta.web_url}" target="_blank" style="color:var(--accent)">#${meta.iid}</a> — ${escapeHtml(meta.title)}`;

  const h = meta._history || {};
  const tl = Array.isArray(meta._labelTimeline) ? meta._labelTimeline : [];

  let txt = '';
  if (h.start){
    txt += `Start considered: ${new Date(h.start).toLocaleString()}\n`;
  }
  if (h.endDate){
    txt += `End considered:   ${new Date(h.endDate).toLocaleString()}\n`;
  }
  if (typeof h.rawDays === 'number'){
    txt += `Raw working days: ${h.rawDays}\n`;
  }
  if (typeof h.pausedDays === 'number'){
    txt += `Paused working days (sum): ${h.pausedDays}\n`;
  }
  if (Array.isArray(h.pauseIntervals) && h.pauseIntervals.length){
    txt += `\nPaused intervals:\n`;
    h.pauseIntervals.forEach(iv=>{
      txt += ` - ${iv.label}: ${iv.start.toLocaleString()} → ${iv.end.toLocaleString()} (≈ ${workingDaysBetween(iv.start, iv.end)} wd)\n`;
    });
  }
  if (tl.length){
    txt += `\nLabel events (status only):\n`;
    tl.filter(e => STATUS_LABELS.has(e.label)).forEach(e=>{
      txt += ` - ${e.when.toLocaleString()} — ${e.action.toUpperCase()} ${e.label}\n`;
    });
  }

  body.textContent = txt || 'No history available.';
  modal.style.display = 'block';
}
function closeHistoryModal(){
  const modal = document.getElementById('historyModal');
  if (modal) modal.style.display = 'none';
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  // toggle label history
  const tlBtn = document.getElementById('timelineToggle');
  if (tlBtn){
    tlBtn.onclick = () => {
      USE_LABEL_EVENTS = !USE_LABEL_EVENTS;
      localStorage.setItem('use_label_events', JSON.stringify(USE_LABEL_EVENTS));
      updateTimelineToggleUi();
      loadAllIssues();
    };
    updateTimelineToggleUi();
  }

  // note editor modal
  const saveBtn  = document.getElementById('noteEditorSave');
  const closeBtn = document.getElementById('noteEditorClose');
  if (saveBtn)  saveBtn.onclick  = saveEditor;
  if (closeBtn) closeBtn.onclick = closeEditor;
  const modalNote = document.getElementById('noteModal');
  if (modalNote) modalNote.addEventListener('click',(e)=>{ if(e.target.id==='noteModal') closeEditor(); });

  // history modal
  const hClose = document.getElementById('historyClose');
  if (hClose) hClose.onclick = closeHistoryModal;
  const modalHist = document.getElementById('historyModal');
  if (modalHist) modalHist.addEventListener('click',(e)=>{ if(e.target.id==='historyModal') closeHistoryModal(); });

  // delegation: open editor & history
  const table = document.getElementById('finance-table');
  if (table){
    table.addEventListener('click', (e)=>{
      const btn = e.target.closest('.btn-open-editor');
      if (btn){
        const key   = btn.dataset.key;
        const iid   = btn.dataset.iid;
        const url   = btn.dataset.url;
        const title = decodeURIComponent(btn.dataset.title || '');
        const ta    = document.querySelector(`textarea.comment-box[data-key="${key}"]`);
        const val   = ta ? ta.value : '';
        openEditor(key, {iid, url, text:title}, val);
        return;
      }
      const histBtn = e.target.closest('.btn-hist');
      if (histBtn){
        const row = e.target.closest('tr');
        if (!row || !row.dataset.issue) return;
        openHistoryModal(JSON.parse(row.dataset.issue));
        return;
      }
    });
  }

  loadAllIssues();
});
