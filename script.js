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

/* Theme & Language */
function getTheme(){ return localStorage.getItem('theme') || 'dark'; }
function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function toggleTheme(){ setTheme(getTheme()==='dark' ? 'light' : 'dark'); }

function getLang(){ return localStorage.getItem('lang') || 'en'; }
function setLang(l){ localStorage.setItem('lang', l); applyI18n(); }
function toggleLang(){ setLang(getLang()==='en' ? 'pt' : 'en'); }

/* i18n dictionary (minimal) */
const I18N = {
  en: {
    title: "Open Finance Brazil - GitLab Issues SLA Dashboard",
    intro: "This dashboard pulls issues from the Open Finance GitLab project and gives a quick view of SLA risk, activity, and context. It calculates working days and applies SLAs based on tags (Nature, Platform, Product, Working Group, and Status). Use filters, sorting, and local notes to triage faster.",
    view: "View:",
    openIssues: "Open issues",
    closed7: "Closed (last 7 days)",
    refresh: "🔄 Refresh",
    clearAll: "🗑️ Clear All Comments",
    resetFilters: "🧹 Reset Filters",
    slaRules: "SLA rules",
    rule1: "Bug & Questions: 10 business days",
    rule2: "Waiting Participant: 5 business days to receive an update",
    rule3: "Under Evaluation or no tags: 3 business days",
    rule4: "Under WG/DTO Evaluation, Backlog, Sandbox Testing, Waiting Deploy: SLA Paused",
    rule5: "Production Testing, Change Request, Breaking Change, Test Improvement: No SLA",
    filters: "Filters",
    nature: "Nature",
    clearNature: "Clear Nature",
    wg: "Working Group",
    clearWG: "Clear Working Group",
    platform: "Platform",
    clearPlatform: "Clear Platform",
    product: "Product",
    clearProduct: "Clear Product",
    status: "Status",
    clearStatus: "Clear Status",
    openFinanceIssues: "Open Finance Issues",
    summaryTitle: "Summary",
    legend: "🕒 Label history ON: working days subtract paused intervals and follow status timeline.",
    id: "ID",
    titleCol: "Title",
    createdAt: "Created At",
    workingDays: "Working Days",
    slaStatus: "SLA Status",
    natureCol: "Nature",
    platformCol: "Platform",
    productCol: "Product",
    wgCol: "Working Group",
    statusCol: "Status",
    comments: "Comments",
    close: "Close",
  },
  pt: {
    title: "Open Finance Brasil - Painel de SLA (GitLab Issues)",
    intro: "Este painel consulta issues do projeto Open Finance no GitLab e oferece uma visão rápida de risco de SLA, atividade e contexto. Calcula dias úteis e aplica SLAs com base nas tags (Nature, Platform, Product, Working Group e Status). Use filtros, ordenação e notas locais para triagem mais rápida.",
    view: "Ver:",
    openIssues: "Issues abertas",
    closed7: "Fechadas (últimos 7 dias)",
    refresh: "🔄 Atualizar",
    clearAll: "🗑️ Limpar todos os comentários",
    resetFilters: "🧹 Limpar filtros",
    slaRules: "Regras de SLA",
    rule1: "Bug & Questions: 10 dias úteis",
    rule2: "Waiting Participant: 5 dias úteis para receber atualização",
    rule3: "Under Evaluation ou sem tags: 3 dias úteis",
    rule4: "Under WG/DTO Evaluation, Backlog, Sandbox Testing, Waiting Deploy: SLA Pausado",
    rule5: "Production Testing, Change Request, Breaking Change, Test Improvement: Sem SLA",
    filters: "Filtros",
    nature: "Nature",
    clearNature: "Limpar Nature",
    wg: "Working Group",
    clearWG: "Limpar Working Group",
    platform: "Platform",
    clearPlatform: "Limpar Platform",
    product: "Product",
    clearProduct: "Limpar Product",
    status: "Status",
    clearStatus: "Limpar Status",
    openFinanceIssues: "Open Finance Issues",
    summaryTitle: "Resumo",
    legend: "🕒 Label history ON: working days subtrai intervalos pausados e segue a linha do tempo de status.",
    id: "ID",
    titleCol: "Título",
    createdAt: "Criado em",
    workingDays: "Dias úteis",
    slaStatus: "Status do SLA",
    natureCol: "Nature",
    platformCol: "Platform",
    productCol: "Product",
    wgCol: "Working Group",
    statusCol: "Status",
    comments: "Comentários",
    close: "Fechar",
  }
};
function applyI18n(){
  const lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  });
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

/* No SLA / Paused sets */
const NO_SLA_NATURES = new Set(['Change Request','Test Improvement','Breaking Change']);
const NO_SLA_STATUSES = new Set(['Production Testing']);
const PAUSED_STATUSES = new Set([
  'Under WG/DTO Evaluation',
  'Backlog',
  'Sandbox Testing',
  'Waiting Deploy',
  'Waiting Participant',
]);

/* Filtros ativos */
const selected = { nature:new Set(), platform:new Set(), product:new Set(), wg:new Set(), status:new Set() };

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
  return s; // fallback → Product
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

/* ================= BUSINESS-TIME (24h blocks, skipping weekends) ================= */
const DAY_MS = 24*60*60*1000;

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=startOfDay(d); x.setDate(x.getDate()+1); return x; }
function overlapMs(a1,a2,b1,b2){
  const start = Math.max(a1.getTime(), b1.getTime());
  const end   = Math.min(a2.getTime(), b2.getTime());
  return Math.max(0, end - start);
}

/* milliseconds of interval [s,e) that fall on weekends */
function weekendMsBetween(s, e){
  if (e <= s) return 0;
  let ms = 0;
  let cursor = startOfDay(s);
  while (cursor < e){
    const next = endOfDay(cursor);
    const isWeekend = [0,6].includes(cursor.getDay());
    if (isWeekend){
      ms += overlapMs(s, e, cursor, next);
    }
    cursor = next;
  }
  return ms;
}

/* business ms = total - weekend ms; working days (24h blocks) = floor(businessMs / DAY_MS) */
function businessMsBetween(s, e){
  const total = Math.max(0, e.getTime() - s.getTime());
  return Math.max(0, total - weekendMsBetween(s, e));
}
function workingDays24hBetween(s, e){
  return Math.floor(businessMsBetween(s, e) / DAY_MS);
}

/* ================= SLA ================= */
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);
  if (status.some(s => NO_SLA_STATUSES.has(s)) || nature.some(n => NO_SLA_NATURES.has(n))) {
    return { type: 'nosla', days: null, reason: 'No SLA' };
  }
  if (status.some(s => PAUSED_STATUSES.has(s))) {
    return { type: 'paused', days: null, reason: 'Paused' };
  }
  if (nature.includes('Bug') || nature.includes('Questions')) {
    return { type: 'timed', days: 10, reason: nature.includes('Bug') ? 'Bug' : 'Questions' };
  }
  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;
  if (underEval || noNature) {
    return { type: 'timed', days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };
  }
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
  return evts
    .filter(e => e && e.label && e.label.name)
    .map(e => ({ when:new Date(e.created_at), label: canonLabel(e.label.name), action: e.action }))
    .filter(e => STATUS_LABELS.has(e.label))
    .sort((a,b)=> a.when - b.when);
}

/* ================= HELPERS ================= */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
function fmtBR(dt){
  return dt.toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', hour12:false });
}

/* calcula NET usando 24h e descartando fds; mostra janela e end considered ajustado */
function computeWorkingDaysContext(issue, now, mode){
  const created = new Date(issue.created_at);
  const closed  = issue.closed_at ? new Date(issue.closed_at) : null;
  const end = (mode === 'closed7' && closed) ? closed : now;

  // Paused intervals from timeline (add/remove); also track open paused labels to adjust displayed "end"
  let pausedMs = 0;
  const lines = [];
  const openStacks = {}; // label -> startDate
  if (USE_LABEL_EVENTS && Array.isArray(issue._statusTimeline) && issue._statusTimeline.length){
    issue._statusTimeline.forEach(ev=>{
      if (PAUSED_STATUSES.has(ev.label)){
        if (ev.action === 'add'){
          openStacks[ev.label] = ev.when;
        } else if (ev.action === 'remove' && openStacks[ev.label]){
          const s = openStacks[ev.label];
          const e = ev.when;
          const ms = businessMsBetween(s, e);
          pausedMs += ms;
          lines.push(` - ${ev.label}: ${fmtBR(s)} → ${fmtBR(e)} (≈ ${Math.floor(ms/DAY_MS)} wd)`);
          delete openStacks[ev.label];
        }
      }
    });
  }
  // still-open paused intervals run until 'end'
  Object.entries(openStacks).forEach(([lbl, s])=>{
    const e = end;
    const ms = businessMsBetween(s, e);
    pausedMs += ms;
    lines.push(` - ${lbl}: ${fmtBR(s)} → ${fmtBR(e)} (≈ ${Math.floor(ms/DAY_MS)} wd)`);
  });

  const totalMs = businessMsBetween(created, end);
  const netMs   = Math.max(0, totalMs - pausedMs);
  const netDays = Math.floor(netMs / DAY_MS);

  // Displayed end: if there is any paused label OPEN, show the earliest open start
  let displayEnd = end;
  if (Object.keys(openStacks).length){
    const earliest = Object.values(openStacks).sort((a,b)=>a-b)[0];
    if (earliest) displayEnd = earliest;
  }

  const body =
`Start considered: ${fmtBR(created)}
End considered:   ${fmtBR(displayEnd)}
Raw working days: ${Math.floor(totalMs/DAY_MS)}
Paused working days (sum): ${Math.floor(pausedMs/DAY_MS)}

${lines.length ? `Paused intervals:\n${lines.join('\n')}\n` : ''}

Label events (status only):
${(issue._statusTimeline||[]).map(e=>` - ${e.when.toISOString()} — ${e.action.toUpperCase()} ${e.label}`).join('\n') || ' (no events found)'}`;

  return { net: netDays, body };
}

/* ================= DATA ================= */
function setLoading(on) { const el = document.getElementById('loading'); if (el) el.style.display = on ? 'block' : 'none'; }

async function loadAllIssues() {
  setLoading(true);
  issues.finance = [];

  const mode = getViewMode();
  const dateLbl = document.getElementById('finance-date-label');
  if (dateLbl) dateLbl.textContent = mode === 'closed7' ? (getLang()==='pt'?'Fechado em':'Closed At') : (getLang()==='pt'?'Criado em':'Created At');

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
    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;
    // raw via 24h blocks, skipping weekends
    const daysOpenRaw = workingDays24hBetween(new Date(i.created_at), endDate);
    const sla = (mode === 'closed7') ? { type:'none', days:null } : getSLAFor(i.labels || []);
    const base = { ...i, daysOpen: daysOpenRaw, dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at, sla };
    const { text, rank, class: klass } = (mode === 'closed7')
      ? { text:'—', rank:-1, class:'nosla' }
      : slaLabelAndRank(base);
    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  const base = decorate(issues.finance);

  if (base.length === 0) {
    const msg = (mode === 'closed7')
      ? (getLang()==='pt'?'Nenhuma issue foi fechada nos últimos 7 dias.':'No issues were closed in the last 7 days.')
      : (getLang()==='pt'?'Nenhuma issue aberta no momento.':'No open issues at the moment.');
    renderEmptyRow(tbody, 11, msg);
    if (summaryEl) {
      summaryEl.textContent =
        (mode === 'closed7')
          ? (getLang()==='pt'?'0 issues fechadas nos últimos 7 dias':'0 issues closed in last 7 days')
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

  // counters
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

    // Working Days cell
    let wdCellHtml = '—';
    let historyBody = '';
    if (!nosla) {
      let netDays = issue.daysOpen;
      if (USE_LABEL_EVENTS) {
        const ctx = computeWorkingDaysContext(issue, new Date(), mode);
        netDays = ctx.net; historyBody = ctx.body;
      }
      wdCellHtml = `<span class="wd-link" data-iid="${issue.iid}" data-url="${issue.web_url}" data-title="${encodeURIComponent(issue.title)}">${netDays} 🕒</span>`;
    }

    const slaCell = `<span class="${issue.slaClass}">${issue.slaText}</span>`;
    const key = `comment-${issue.projectId}-${issue.iid}`;
    const saved = localStorage.getItem(key) || '';

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
    tbody.appendChild(tr);

    // hook: clock click (history) & comment editor
    tr.querySelectorAll('.wd-link').forEach(el=>{
      el.addEventListener('click', ()=>{
        if (nosla) return;
        issue._historyBody = historyBody || 'Label history unavailable.';
        openHistoryModal(issue);
      });
    });
  });

  if (summaryEl) {
    summaryEl.textContent = `${total} public open issues — SLA-applicable: ${applicable}, Over SLA: ${over}, No SLA: ${noslaCount}`;
  }

  updateSortArrows('finance-table');
}

/* ====== Modal (History / Editor) ====== */
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
  // theme & lang init
  setTheme(getTheme());
  applyI18n();

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.onclick = () => toggleTheme();

  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.onclick = () => { toggleLang(); loadAllIssues(); };

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

  // close modal
  const closeBtn = document.getElementById('noteEditorClose');
  if (closeBtn) closeBtn.onclick = closeEditor;
  const modal = document.getElementById('noteModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target.id === 'noteModal') closeEditor(); });

  // comment editor (reusing modal)
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

      const m = document.getElementById('noteModal');
      const mTitle = document.getElementById('noteEditorTitle');
      const mBody  = document.getElementById('labelHistoryBody');
      if (!m || !mTitle || !mBody) return;

      mTitle.innerHTML = `<a href="${url}" target="_blank" style="color:var(--accent)">#${iid}</a> — ${escapeHtml(title)}`;
      mBody.innerHTML =
        `<textarea id="noteEditorTextarea" style="width:100%;min-height:240px">${escapeHtml(val)}</textarea>
         <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
           <button id="saveNoteBtn">Save</button>
         </div>`;
      m.style.display = 'block';

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
