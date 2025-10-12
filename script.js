/* ================= CONFIG ================= */
// Open Finance only
const issues = { finance: [] };

/* Ordenação padrão: ID desc (mais recente primeiro) */
const tableSort = { 'finance-table': { key: 'iid', asc: false } };

/* Label history ON/OFF (Netlify proxy only) */
let USE_LABEL_EVENTS = JSON.parse(localStorage.getItem('use_label_events') || 'false');
function updateLabelHistoryToggle(){
  const b = document.getElementById('labelHistoryToggle');
  if (b) b.textContent = `Label history: ${USE_LABEL_EVENTS ? 'ON':'OFF'}`;
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

/* Nos SLA (override) */
const NO_SLA_NATURES = new Set(['Change Request','Test Improvement','Breaking Change']);
const NO_SLA_STATUSES = new Set(['Production Testing']);

/* Pausam SLA (atualizado: inclui Waiting Participant; remove In Progress) */
const PAUSED_STATUSES = new Set([
  'Under WG/DTO Evaluation',
  'Backlog',
  'Sandbox Testing',
  'Waiting Deploy',
  'Waiting Participant',
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

  // Fallback → Product
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
   - No SLA: Production Testing, Change Request, Breaking Change, Test Improvement
   - Pausam: Under WG/DTO Evaluation, Backlog, Sandbox Testing, Waiting Deploy, Waiting Participant
   - Timed: Bug/Questions (10d), Under Evaluation ou sem Nature (3d)
*/
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);

  // No SLA override
  if (status.some(s => NO_SLA_STATUSES.has(s)) || nature.some(n => NO_SLA_NATURES.has(n))) {
    return { type: 'nosla', days: null, reason: 'No SLA' };
  }

  // Paused
  if (status.some(s => PAUSED_STATUSES.has(s))) {
    return { type: 'paused', days: null, reason: 'Paused' };
  }

  // Timed
  if (nature.includes('Bug') || nature.includes('Questions')) {
    return { type: 'timed', days: 10, reason: nature.includes('Bug') ? 'Bug' : 'Questions' };
  }
  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;
  if (underEval || noNature) {
    return { type: 'timed', days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };
  }

  // Nada aplicável
  return { type: 'none', days: null, reason: 'No SLA' };
}

function slaLabelAndRank(issue) {
  const rule = issue.sla;
  if (rule.type === 'paused') return { text: 'SLA Paused', class: 'paused',    rank: 2 };
  if (rule.type === 'nosla' ) return { text: 'No SLA',     class: 'nosla',     rank: 0 };
  if (rule.type === 'none'  ) return { text: 'No SLA',     class: 'nosla',     rank: 0 };
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

/* ================= Label events via Netlify proxy ================= */
async function fetchLabelEvents(projectId, iid){
  if (!USE_LABEL_EVENTS) return [];
  const url = `/.netlify/functions/gitlab?path=${encodeURIComponent(`/projects/${projectId}/issues/${iid}/resource_label_events`)}&per_page=100`;
  try{
    const r = await fetch(url, { headers: { 'Accept':'application/json' } });
    if (!r.ok) return [];
    return await r.json();
  }catch{ return []; }
}

function timelineFromEvents(evts) {
  // Mantém ADD e REMOVE de labels de STATUS
  return evts
    .filter(e => e && e.label && e.label.name)
    .map(e => ({ when:new Date(e.created_at), label: canonLabel(e.label.name), action: e.action }))
    .filter(e => STATUS_LABELS.has(e.label))
    .sort((a,b)=> a.when - b.when);
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

  let url = `https://gitlab.com/api/v4/projects/${projectId}/issues?per_page=100`;
  url += (mode === 'closed7') ? `&state=closed&updated_after=${encodeURIComponent(since)}` : `&state=opened`;

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let list = data.map(issue => ({ ...issue, projectId }));
    if (mode === 'closed7') {
      const cutoff = new Date(since);
      list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff);
    }

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

/* ================= HELPERS ================= */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

/* calcula tempo líquido (subtrai intervalos de pausa) e produz texto do modal */
function computeWorkingDaysContext(issue, now, mode){
  const start = new Date(issue.created_at);
  const end = (mode === 'closed7' && issue.closed_at) ? new Date(issue.closed_at) : now;

  let raw = workingDaysBetween(start, end);
  let pausedSum = 0;
  const lines = [];

  if (USE_LABEL_EVENTS && Array.isArray(issue._statusTimeline) && issue._statusTimeline.length) {
    // constrói janelas de pausa a partir de ADD/REMOVE das labels que pausam
    const stack = {};
    issue._statusTimeline.forEach(ev => {
      if (PAUSED_STATUSES.has(ev.label)) {
        if (ev.action === 'add') {
          stack[ev.label] = ev.when;
        } else if (ev.action === 'remove' && stack[ev.label]) {
          const s = stack[ev.label];
          const e = ev.when;
          pausedSum += workingDaysBetween(s, e);
          lines.push(` - ${ev.label}: ${s.toISOString()} → ${e.toISOString()} (≈ ${workingDaysBetween(s,e)} wd)`);
          delete stack[ev.label];
        }
      }
    });
    // intervalos abertos até "end"
    Object.entries(stack).forEach(([lbl, s])=>{
      const e = end;
      pausedSum += workingDaysBetween(s, e);
      lines.push(` - ${lbl}: ${s.toISOString()} → ${e.toISOString()} (≈ ${workingDaysBetween(s,e)} wd)`);
    });
  }

  const net = Math.max(0, raw - pausedSum);

  const body =
`Start considered: ${start.toLocaleString()}
End considered:   ${end.toLocaleString()}
Raw working days: ${raw}
Paused working days (sum): ${pausedSum}

${lines.length ? `Paused intervals:\n${lines.join('\n')}\n` : ''}

Label events (status only):
${(issue._statusTimeline||[]).map(e=>` - ${e.when.toISOString()} — ${e.action.toUpperCase()} ${e.label}`).join('\n') || ' (no events found)'}`;

  return { net, body };
}

/* ================= RENDER ================= */
function renderEmptyRow(tbody, colspan, message) {
  const tr = document.createElement('tr');
  tr.className = 'empty-state';
  tr.innerHTML = `<td class="empty-cell" colspan="${colspan}">${message}</td>`;
  tbody.appendChild(tr);
}

function renderIssues() {
  const mode = getViewMode();
  const tbody = document.querySelector('#finance-table tbody');
  const summaryEl = document.getElementById('finance-summary');
  if (!tbody) return;
  tbody.innerHTML = '';

  const now = new Date();

  const decorate = (list) => list.map(i => {
    // base para cálculo de dias
    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;
    const daysOpenRaw = workingDaysBetween(new Date(i.created_at), endDate);

    const sla = (mode === 'closed7') ? { type:'none', days:null } : getSLAFor(i.labels || []);
    const base = { ...i, daysOpen: daysOpenRaw, dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at, sla };

    const { text, rank, class: klass } = (mode === 'closed7')
      ? { text:'—', rank:-1, class:'nosla' }
      : slaLabelAndRank(base);

    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  const base = decorate(issues.finance);

  if (base.length === 0) {
    const msg = (mode === 'closed7') ? 'No issues were closed in the last 7 days.' : 'No open issues at the moment.';
    renderEmptyRow(tbody, 11, msg);
    if (summaryEl) {
      summaryEl.textContent =
        (mode === 'closed7')
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
  let total = 0, applicable = 0, over = 0, noslaCount = 0;

  // render
  sorted.forEach(issue => {
    const { status, nature, product, platform, wg } = classifyLabels(issue.labels || []);
    const clsFor = (l) => (l==='Bug' ? ' badge-bug' : (l==='Under WG/DTO Evaluation' ? ' badge-ugdto' : ''));
    const badge = arr => arr.length
      ? arr.map(l=>`<span class="badge${clsFor(l)}">${escapeHtml(l)}</span>`).join(' ')
      : '<span style="opacity:.5;">—</span>';

    total++;

    const timed = issue.sla.type === 'timed';
    const paused = issue.sla.type === 'paused';
    const nosla  = (issue.sla.type === 'nosla' || issue.sla.type === 'none');

    if (timed) {
      applicable++;
      if (issue.sla.days !== null && issue.daysOpen > issue.sla.days) over++;
    } else if (nosla) {
      noslaCount++;
    }

    // Working Days cell: quando No SLA, mostrar apenas "—" (sem ícone/ação)
    let wdCellHtml = '—';
    if (!nosla) {
      // usa tempo líquido se label history ON
      let netDays = issue.daysOpen;
      let historyBody = '';
      if (USE_LABEL_EVENTS) {
        const ctx = computeWorkingDaysContext(issue, new Date(), mode);
        netDays = ctx.net;
        historyBody = ctx.body;
      }
      // link para abrir modal
      wdCellHtml = `<span class="wd-link" data-iid="${issue.iid}" data-url="${issue.web_url}" data-title="${encodeURIComponent(issue.title)}"> ${netDays} 🕒</span>`;
      issue._historyBody = historyBody;
    }

    const slaCell = `<span class="${issue.slaClass}">${issue.slaText}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${issue.web_url}" target="_blank" style="color:var(--accent);">#${issue.iid}</a></td>
      <td>${escapeHtml(issue.title)}${mode === 'closed7' ? '<span class="closed-badge">Closed</span>' : ''}</td>
      <td>${new Date(issue.dateCol).toLocaleDateString()}</td>
      <td>${wdCellHtml}</td>
      <td>${slaCell}</td>
      <td>${badge(nature)}</td>
      <td>${badge(platform)}</td>
      <td>${badge(product)}</td>
      <td>${badge(wg)}</td>
      <td>${badge(status)}</td>
      <td>
        <textarea class="comment-box" rows="2" data-key="comment-${issue.projectId}-${issue.iid}" oninput="saveComment('comment-${issue.projectId}-${issue.iid}', this.value)">${localStorage.getItem(`comment-${issue.projectId}-${issue.iid}`)||''}</textarea>
        <div style="margin-top:6px">
          <button class="btn-open-editor"
                  data-key="comment-${issue.projectId}-${issue.iid}"
                  data-iid="${issue.iid}"
                  data-url="${issue.web_url}"
                  data-title="${encodeURIComponent(issue.title)}">...</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // armazena body do histórico para o clique do relógio
    tr.querySelectorAll('.wd-link').forEach(el=>{
      el.addEventListener('click', ()=>{
        if (nosla) return; // não deveria ter link, mas por garantia
        openHistoryModal(issue);
      });
    });
  });

  if (summaryEl) {
    summaryEl.textContent = `${total} public open issues — SLA-applicable: ${applicable}, Over SLA: ${over}, No SLA: ${noslaCount}`;
  }

  updateSortArrows('finance-table');
}

/* ====== Modal (History) ====== */
function openHistoryModal(issue){
  const modal = document.getElementById('noteModal');
  const title = document.getElementById('noteEditorTitle');
  const body  = document.getElementById('labelHistoryBody');
  if (!modal || !title || !body) return;

  title.innerHTML = `<a href="${issue.web_url}" target="_blank" style="color:var(--accent)">#${issue.iid}</a> — ${escapeHtml(issue.title)}`;
  body.textContent = issue._historyBody || 'Label history unavailable.';
  modal.style.display = 'block';
}
function closeEditor(){
  const modal = document.getElementById('noteModal');
  if (modal) modal.style.display = 'none';
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  // label history toggle
  const btn = document.getElementById('labelHistoryToggle');
  if (btn){
    btn.onclick = () => {
      USE_LABEL_EVENTS = !USE_LABEL_EVENTS;
      localStorage.setItem('use_label_events', JSON.stringify(USE_LABEL_EVENTS));
      updateLabelHistoryToggle();
      loadAllIssues();
    };
    updateLabelHistoryToggle();
  }

  // fechar modal
  const closeBtn = document.getElementById('noteEditorClose');
  if (closeBtn) closeBtn.onclick = closeEditor;
  const modal = document.getElementById('noteModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target.id === 'noteModal') closeEditor(); });

  // event delegation para editor de comentários (botão "...")
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

      // reutiliza o modal para notas grandes (mantendo layout leve)
      const modal = document.getElementById('noteModal');
      const mTitle = document.getElementById('noteEditorTitle');
      const mBody  = document.getElementById('labelHistoryBody');
      if (!modal || !mTitle || !mBody) return;

      mTitle.innerHTML = `<a href="${url}" target="_blank" style="color:var(--accent)">#${iid}</a> — ${title}`;
      mBody.innerHTML =
        `<textarea id="noteEditorTextarea" style="width:100%;min-height:240px">${escapeHtml(val)}</textarea>
         <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
           <button id="saveNoteBtn">Save</button>
         </div>`;
      modal.style.display = 'block';

      const saveBtn = document.getElementById('saveNoteBtn');
      if (saveBtn){
        saveBtn.onclick = ()=>{
          const taNew = document.getElementById('noteEditorTextarea');
          const newVal = taNew ? taNew.value : '';
          localStorage.setItem(key, newVal);
          if (ta) ta.value = newVal;
          closeEditor();
        };
      }
    });
  }

  loadAllIssues();
});
