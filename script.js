// Open Finance only
const issues = { finance: [] };

/* Ordenação padrão: ID desc (mais recente primeiro) */
const tableSort = { 'finance-table': { key: 'iid', asc: false } };

/* Histórico de labels (datas) via API de eventos.
   ON: tooltip no SLA + Working Days começa na última “Waiting Participant”
       OU “Under WG/DTO Evaluation” (se posterior ao created_at).
*/
let USE_LABEL_EVENTS = JSON.parse(localStorage.getItem('use_label_events') || 'false');
function getToken(){ return (localStorage.getItem('gitlab_api_token')||'').trim(); }
function updateTimelineToggleUi(){
  const b=document.getElementById('timelineToggle');
  if(b){ b.textContent = `Timeline: ${USE_LABEL_EVENTS ? 'ON':'OFF'}`; }
}

/* ======== Taxonomias ======== */

/* Status */
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
]);

/* Nature */
const NATURE_LABELS = new Set([
  'Questions', 'Bug', 'Change Request', 'Test Improvement', 'Breaking Change',
]);

/* Platform */
const PLATFORM_LABELS = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);

/* Working Group */
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

/* ================= NORMALIZAÇÃO DE LABELS ================= */
function baseLabel(l) { return String(l || '').split('::')[0].trim(); }

function canonLabel(l) {
  const s = baseLabel(l);

  // Nature
  if (/^bug$/i.test(s)) return 'Bug';
  if (/^questions?$/i.test(s)) return 'Questions';
  if (/^change\s*request$/i.test(s)) return 'Change Request';
  if (/^test\s*improvement$/i.test(s)) return 'Test Improvement';
  if (/^breaking\s*change$/i.test(s)) return 'Breaking Change';

  // Status (variações mapeadas)
  if (/^under\s*evaluation$/i.test(s)) return 'Under Evaluation';
  if (/^waiting\s*participant$/i.test(s)) return 'Waiting Participant';
  if (/^under\s*wg\/?dto\s*evaluation$/i.test(s)) return 'Under WG/DTO Evaluation';
  if (/^evaluated\s*by\s*wg\/?dto$/i.test(s)) return 'Evaluated by WG/DTO';
  if (/^backlog$/i.test(s)) return 'Backlog';
  if (/^in\s*progress$/i.test(s)) return 'In Progress';
  if (/^sandbox\s*testing$/i.test(s)) return 'Sandbox Testing';
  if (/^waiting\s*deploy$/i.test(s)) return 'Waiting Deploy';
  if (/^production\s*testing$/i.test(s)) return 'Production Testing';

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

  // Fallback (vira Product)
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
/* Regras:
   - Pausam SEMPRE: Under WG/DTO Evaluation, In Progress, Backlog, Sandbox Testing, Waiting Deploy, Production Testing
   - Waiting Participant: 5 dias úteis
   - Bug, Questions: 10 dias úteis
   - Under Evaluation ou sem tags (Nature): 3 dias úteis
*/
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);

  // 1) Pausa sempre (sobrepõe Bug/Questions)
  const paused = (
    status.includes('Under WG/DTO Evaluation') ||
    status.includes('In Progress') ||
    status.includes('Backlog') ||
    status.includes('Sandbox Testing') ||
    status.includes('Waiting Deploy') ||
    status.includes('Production Testing')
  );
  if (paused) return { type: 'paused' };

  // 2) Timed
  if (status.includes('Waiting Participant')) return { type: 'timed', days: 5, reason: 'Waiting Participant' };

  const hasBug = nature.includes('Bug');
  const hasQuestions = nature.includes('Questions');
  if (hasBug || hasQuestions) return { type: 'timed', days: 10, reason: hasBug ? 'Bug' : 'Questions' };

  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;
  if (underEval || noNature) return { type: 'timed', days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };

  // 3) Sem SLA
  return { type: 'none' };
}

function slaLabelAndRank(issue) {
  const rule = issue.sla;
  if (rule.type === 'paused') return { text: 'SLA Paused', class: 'paused',    rank: 2 };
  if (rule.type === 'none')   return { text: 'No SLA',     class: 'nosla',     rank: 0 };
  // timed
  const over = issue.daysOpen > rule.days;
  if (over) return { text: 'Over SLA', class: 'over-sla',  rank: 3 };
  return     { text: 'Within SLA', class: 'within-sla',    rank: 1 };
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
  document.getElementById('count-nature').textContent   = selected.nature.size;
  document.getElementById('count-platform').textContent = selected.platform.size;
  document.getElementById('count-product').textContent  = selected.product.size;
  document.getElementById('count-status').textContent   = selected.status.size;
  const wg = document.getElementById('count-wg'); if (wg) wg.textContent = selected.wg.size;
}

function clearCategory(cat) {
  selected[cat].clear();
  renderFilterMenus(); renderIssues();
}

function renderChips() {
  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  ['nature','platform','product','wg','status'].forEach(cat => {
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

/* ================= Aux: detectar JSON de verdade ================= */
async function readJsonSafe(res){
  const ct = (res.headers.get('content-type')||'').toLowerCase();
  if (!ct.includes('application/json')){
    const txt = await res.text();
    console.warn('Response is not JSON:', res.status, txt.slice(0,200));
    return null;
  }
  try{ return await res.json(); }catch(e){ console.warn('JSON parse error', e); return null; }
}

/* ================= Label events (proxy + fallback) ================= */
async function fetchLabelEvents(projectId, iid){
  if (!USE_LABEL_EVENTS) return [];

  // 1) tenta proxy Netlify (sem token no cliente)
  const proxyUrl = `/.netlify/functions/gitlab?path=` +
                   encodeURIComponent(`/projects/${projectId}/issues/${iid}/resource_label_events`) +
                   `&per_page=100`;

  try {
    const viaProxy = await fetch(proxyUrl, { headers: { 'Accept':'application/json' }, cache:'no-store' });
    if (viaProxy.ok) {
      const data = await readJsonSafe(viaProxy);
      if (Array.isArray(data)) {
        console.debug('[timeline] proxy ok', { iid, events: data.length });
        return data;
      }
      // se não for array/JSON, cai no fallback abaixo
    } else {
      console.warn('[timeline] proxy not ok', iid, viaProxy.status);
    }
  } catch (err) {
    console.warn('[timeline] proxy error', iid, err);
  }

  // 2) fallback direto no GitLab (pode exigir PAT)
  const directUrl = `https://gitlab.com/api/v4/projects/${projectId}/issues/${iid}/resource_label_events?per_page=100`;
  const pat = getToken();
  const headers = { 'Accept':'application/json' };
  if (pat) headers['Authorization'] = `Bearer ${pat}`;
  try {
    const res = await fetch(directUrl, { headers, cache:'no-store' });
    if (!res.ok) { console.warn('[timeline] direct fetch failed', iid, res.status); return []; }
    const data = await readJsonSafe(res);
    if (Array.isArray(data)) {
      console.debug('[timeline] direct ok', { iid, events: data.length });
      return data;
    }
  } catch (err) {
    console.warn('[timeline] direct error', iid, err);
  }
  return [];
}

function timelineFromEvents(evts) {
  // considerar apenas ADIÇÕES de labels de STATUS
  const out = evts
    .filter(e => e && e.action === 'add' && e.label && e.label.name)
    .map(e => ({ when:new Date(e.created_at), label: canonLabel(e.label.name) }))
    .filter(e => STATUS_LABELS.has(e.label))
    .sort((a,b)=> a.when - b.when);
  return out; // ascendente
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

  // URL enxuta e confiável
  let url = `https://gitlab.com/api/v4/projects/${projectId}/issues?per_page=100`;
  if (mode === 'closed7') {
    url += `&state=closed&updated_after=${encodeURIComponent(since)}`;
  } else {
    url += `&state=opened`;
  }

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache:'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let list = data.map(issue => ({ ...issue, projectId }));
    if (mode === 'closed7') {
      const cutoff = new Date(since);
      list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff);
    }

    // label events (opcional)
    if (USE_LABEL_EVENTS && mode !== 'closed7') {
      for (const it of list) {
        const ev = await fetchLabelEvents(projectId, it.iid);
        it._statusTimeline = timelineFromEvents(ev);
      }
    }

    issues[key] = list;
  } catch (err) {
    console.error('Failed to load issues', { projectId, url, err });
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
    // start para Working Days:
    let start = new Date(i.created_at);
    let startAdjustNote = '';

    // se histórico estiver ligado, usar a última data de "Waiting Participant" OU "Under WG/DTO Evaluation" (se posterior)
    if (USE_LABEL_EVENTS && Array.isArray(i._statusTimeline) && i._statusTimeline.length) {
      const lastWait = [...i._statusTimeline].reverse().find(e =>
        e.label === 'Waiting Participant' || e.label === 'Under WG/DTO Evaluation'
      );
      if (lastWait && lastWait.when > start) {
        start = new Date(lastWait.when);
        startAdjustNote = `Working Days started at ${lastWait.when.toLocaleDateString()} due to ${lastWait.label}`;
      }
    }

    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;
    const daysOpen = workingDaysBetween(start, endDate);

    const sla = (mode === 'closed7') ? { type:'none', days:null } : getSLAFor(i.labels || []);
    const base = { ...i, daysOpen, dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at, sla };

    const { text, rank, class: klass } = (mode === 'closed7')
      ? { text:'—', rank:-1, class:'nosla' }
      : slaLabelAndRank(base);

    // tooltip do SLA (linha do tempo)
    let tip = '';
    if (USE_LABEL_EVENTS && Array.isArray(i._statusTimeline) && i._statusTimeline.length) {
      const timelineText = i._statusTimeline.map(e =>
        `${e.when.toLocaleDateString()} — ${e.label}`
      ).join('\n');
      tip = startAdjustNote ? (startAdjustNote + '\n' + timelineText) : timelineText;
    }

    return { ...base, slaText: text, slaRank: rank, slaClass: klass, slaTip: tip, adjusted: !!startAdjustNote };
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

  // ordenação
  const s = tableSort['finance-table'];
  const sorted = filtered.sort((a,b)=>{
    let va, vb;
    switch (s.key) {
      case 'iid':      va = Number(a.iid); vb = Number(b.iid); break;
      case 'daysOpen': va = Number(a.daysOpen); vb = Number(b.daysOpen); break;
      case 'dateCol':  va = new Date(a.dateCol).getTime(); vb = new Date(b.dateCol).getTime(); break;
      case 'slaRank':  va = Number(a.slaRank); vb = Number(b.slaRank); break;
      case 'title':
      default:         va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase();
    }
    if (va < vb) return s.asc ? -1 : 1;
    if (va > vb) return s.asc ? 1 : -1;
    return 0;
  });

  // contadores do resumo
  let total = 0, applicable = 0, over = 0;

  // render
  sorted.forEach(issue => {
    const { status, nature, product, platform, wg } = classifyLabels(issue.labels || []);
    const clsFor = (l) => (l==='Bug' ? ' badge-bug' : (l==='Under WG/DTO Evaluation' ? ' badge-ugdto' : ''));
    const badge = arr => arr.length
      ? arr.map(l=>`<span class="badge${clsFor(l)}">${escapeHtml(l)}</span>`).join(' ')
      : '<span style="opacity:.5;">—</span>';

    const rowIsPaused = issue.sla.type === 'paused';
    const isOver = (issue.sla.type === 'timed') && (issue.daysOpen > issue.sla.days);

    total++;
    if (!rowIsPaused) applicable++;
    if (isOver) over++;

    const key = `comment-${issue.projectId}-${issue.iid}`;
    const saved = localStorage.getItem(key) || '';

    const hasTip = !!issue.slaTip;
    const adjustedMark = issue.adjusted ? ' • 🕒' : '';
    const slaCell = `<span class="${issue.slaClass}" ${hasTip ? `title="${escapeHtml(issue.slaTip)}"` : ''}>${issue.slaText}${adjustedMark}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${issue.web_url}" target="_blank" style="color:var(--accent);">#${issue.iid}</a></td>
      <td>${escapeHtml(issue.title)}${mode === 'closed7' ? '<span class="closed-badge">Closed</span>' : ''}</td>
      <td>${new Date(issue.dateCol).toLocaleDateString()}</td>
      <td>${issue.daysOpen}</td>
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
                  data-title="${encodeURIComponent(issue.title)}">Open editor</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (summaryEl) {
    summaryEl.textContent = `${total} public open issues — SLA-applicable: ${applicable}, Over SLA: ${over}`;
  }

  updateSortArrows('finance-table');
}

/* ====== Modal (Open editor) ====== */
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

  // reflete na caixinha da tabela
  const small = document.querySelector(`textarea.comment-box[data-key="${editorKey}"]`);
  if (small) small.value = val;

  closeEditor();
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  // timeline toggle button
  const tlBtn = document.getElementById('timelineToggle');
  if (tlBtn){
    tlBtn.onclick = () => {
      USE_LABEL_EVENTS = !USE_LABEL_EVENTS;
      localStorage.setItem('use_label_events', JSON.stringify(USE_LABEL_EVENTS));
      if (USE_LABEL_EVENTS && !getToken()){
        const maybe = window.prompt('Optional: paste a GitLab Personal Access Token (starts with glpat-). Leave blank to try without a token.');
        if (maybe && maybe.trim()) localStorage.setItem('gitlab_api_token', maybe.trim());
      }
      updateTimelineToggleUi();
      loadAllIssues();
    };
    // estado inicial
    updateTimelineToggleUi();
  }

  // liga botões do modal
  const saveBtn  = document.getElementById('noteEditorSave');
  const closeBtn = document.getElementById('noteEditorClose');
  if (saveBtn)  saveBtn.onclick  = saveEditor;
  if (closeBtn) closeBtn.onclick = closeEditor;
  // fechar clicando fora
  const modal = document.getElementById('noteModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target.id === 'noteModal') closeEditor(); });

  // event delegation para "Open editor"
  const table = document.getElementById('finance-table');
  if (table){
    table.addEventListener('click', (e)=>{
      const btn = e.target.closest('.btn-open-editor');
      if (!btn) return;
      const key   = btn.dataset.key;
      const iid   = btn.dataset.iid;
      const url   = btn.dataset.url;
      const title = decodeURIComponent(btn.dataset.title || '');
      const ta    = document.querySelector(`textarea.comment-box[data-key="${key}"]`);
      const val   = ta ? ta.value : '';
      openEditor(key, {iid, url, text:title}, val);
    });
  }

  loadAllIssues();
});
