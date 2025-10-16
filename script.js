/* ================= CONFIG ================= */
const issues = { finance: [] };
const tableSort = { 'finance-table': { key: 'iid', asc: false } };

let USE_LABEL_EVENTS = JSON.parse(localStorage.getItem('use_label_events') || 'false');
function updateLabelHistoryToggle(){
  const b = document.getElementById('labelHistoryToggle');
  if (b){ b.classList.toggle('on', !!USE_LABEL_EVENTS); }
}

/* Theme & Language */
function getTheme(){ return localStorage.getItem('theme') || 'dark'; }
function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function toggleTheme(){ setTheme(getTheme()==='dark' ? 'light' : 'dark'); }

function getLang(){ return localStorage.getItem('lang') || 'en'; }
function setLang(l){ localStorage.setItem('lang', l); applyI18n(); }
function toggleLang(){ setLang(getLang()==='en' ? 'pt' : 'en'); }

/* i18n dictionary */
const I18N = {
  en: {
    title: "Open Finance Brasil - GitLab Issues",
    intro: "This dashboard pulls issues from the Open Finance GitLab project and gives a quick view of SLA risk, activity, and context. Use filters, sorting, and local notes to faster triage.",
    view: "View:",
    openIssues: "Open issues",
    closed14: "Closed (last 14 days)",
    refresh: "Refresh",
    clearAll: "Clear All Comments",
    resetFilters: "Reset Filters",
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
    openedIssuesTitle: "Opened Issues",
    closedIssuesTitle: "Closed Issues",
    summaryTitle: "Summary",
    legend: "🕒 Label history ON: working days subtract paused intervals and follow the applied labels timeline.",
    id: "ID",
    titleCol: "Title",
    createdAt: "Created At",
    workingDays: "Working<br>Days",
    slaStatus: "SLA<br>Status",
    natureCol: "Nature",
    platformCol: "Platform",
    productCol: "Product",
    wgCol: "Working<br>Group",
    statusCol: "Status",
    comments: "Comments",
    close: "Close",
    tWithin: "Within SLA",
    tPaused: "SLA Paused",
    tNoSla: "No SLA",
    tOver: "Over SLA",
    lhStart: "Start considered",
    lhEnd: "End considered",
    lhRaw: "Raw working days",
    lhPausedSum: "Paused working days (sum)",
    lhPausedIntervals: "Paused intervals:",
    lhEvents: "Label events (status only):",
    lhNoEvents: "(no events found)",
    lhADD: "ADD",
    lhREMOVE: "REMOVE",
    dashboardView: "Dashboard",
    fromLbl: "From:",
    toLbl: "To:",
    applyRange: "Apply",},
  pt: {
    title: "Open Finance Brasil - GitLab Issues",
    intro: "Este dashboard consulta issues do Open Finance Brasil no GitLab e oferece uma visão de SLA, atividade e contexto. Use filtros, ordenação e notas locais para uma triagem mais rápida.",
    view: "Ver:",
    openIssues: "Issues abertas",
    closed14: "Fechadas (últimos 14 dias)",
    refresh: "Atualizar",
    clearAll: "Limpar todos os comentários",
    resetFilters: "Limpar filtros",
    slaRules: "Regras de SLA",
    rule1: "Bug & Questions: 10 dias úteis",
    rule2: "Waiting Participant: 5 dias úteis para receber atualização",
    rule3: "Under Evaluation ou sem tags: 3 dias úteis",
    rule4: "Under WG/DTO Evaluation, Backlog, Sandbox Testing, Waiting Deploy: SLA Pausado",
    rule5: "Production Testing, Change Request, Breaking Change, Test Improvement: Sem SLA",
    filters: "Filtros",
    nature: "Natureza",
    clearNature: "Limpar Natureza",
    wg: "GT",
    clearWG: "Limpar GT",
    platform: "Plataforma",
    clearPlatform: "Limpar Plataforma",
    product: "Produto",
    clearProduct: "Limpar Produto",
    status: "Status",
    clearStatus: "Limpar Status",
    openedIssuesTitle: "Issues abertas",
    closedIssuesTitle: "Issues fechadas",
    summaryTitle: "Resumo",
    legend: "🕒 Histórico de labels ON: Dias úteis subtrai intervalos pausados e segue a linha do tempo de labels aplicadas.",
    id: "ID",
    titleCol: "Título",
    createdAt: "Criado em",
    workingDays: "Dias<br>úteis",
    slaStatus: "Status do<br>SLA",
    natureCol: "Natureza",
    platformCol: "Plataforma",
    productCol: "Produto",
    wgCol: "GT",
    statusCol: "Status",
    comments: "Comentários",
    close: "Fechar",
    tWithin: "Dentro do SLA",
    tPaused: "SLA Pausado",
    tNoSla: "Sem SLA",
    tOver: "Fora do SLA",
    lhStart: "Início considerado",
    lhEnd: "Fim considerado",
    lhRaw: "Dias úteis brutos",
    lhPausedSum: "Dias úteis pausados (soma)",
    lhPausedIntervals: "Intervalos pausados:",
    lhEvents: "Eventos de label (apenas status):",
    lhNoEvents: "(nenhum evento encontrado)",
    lhADD: "ADD",
    lhREMOVE: "REMOVE",
  }
};
function applyI18n(){
  const lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  }

// Initialize closed range defaults (last 7 days)
(function initClosedDates(){
  const s = document.getElementById('closedStart');
  const e = document.getElementById('closedEnd');
  const btn = document.getElementById('applyRangeBtn');
  if (!s || !e) return;
  const today = new Date(); const pad = d=> String(d).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (!s.value || !e.value){
    const end = today;
    const start = new Date(today); start.setDate(today.getDate()-7);
    s.value = fmt(start); e.value = fmt(end);
  }
  if (btn){ btn.addEventListener('click', ()=> loadAllIssues()); }
  s.addEventListener('change', ()=>{}); // keep values; applied on button
  e.addEventListener('change', ()=>{});
})();
);
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    const k = el.getAttribute('data-i18n-html');
    if (I18N[lang][k]) el.innerHTML = I18N[lang][k] + ` <span class="sort-arrow" data-for="${el.querySelector('.sort-arrow')?.dataset.for||''}"></span>`;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{
    const k = el.getAttribute('data-i18n-title');
    if (I18N[lang][k]) el.title = I18N[lang][k];
  });
}

/* ======== Taxonomias ======== */
const STATUS_LABELS = new Set([
  'Under Evaluation','Waiting Participant','Under WG/DTO Evaluation','Evaluated by WG/DTO',
  'Backlog','In Progress','Sandbox Testing','Waiting Deploy','Production Testing',
]);
const NATURE_LABELS = new Set(['Questions','Bug','Change Request','Test Improvement','Breaking Change']);
const PLATFORM_LABELS = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);
const WG_LABELS = new Set(['GT Serviços','GT Portabilidade de crédito','Squad Sandbox','Squad JSR']);

const NO_SLA_NATURES = new Set(['Change Request','Test Improvement','Breaking Change']);
const NO_SLA_STATUSES = new Set(['Production Testing']);
const PAUSED_STATUSES = new Set(['Under WG/DTO Evaluation','Backlog','Sandbox Testing','Waiting Deploy','Waiting Participant']);

/* Filtros */
const selected = { nature:new Set(), platform:new Set(), product:new Set(), wg:new Set(), status:new Set() };

/* ================= NORMALIZAÇÃO ================= */
function baseLabel(l) { return String(l || '').split('::')[0].trim(); }
function canonLabel(l) {
  const s = baseLabel(l);
  if (/^bug$/i.test(s)) return 'Bug';
  if (/^questions?$/i.test(s)) return 'Questions';
  if (/^change\s*request$/i.test(s)) return 'Change Request';
  if (/^test\s*improvement$/i.test(s)) return 'Test Improvement';
  if (/^breaking\s*change$/i.test(s)) return 'Breaking Change';
  if (/^under\s*evaluation$/i.test(s)) return 'Under Evaluation';
  if (/^waiting\s*participant$/i.test(s)) return 'Waiting Participant';
  if (/^under\s*wg\/?dto\s*evaluation$/i.test(s)) return 'Under WG/DTO Evaluation';
  if (/^evaluated\s*by\s*wg\/?dto$/i.test(s)) return 'Evaluated by WG/DTO';
  if (/^backlog$/i.test(s)) return 'Backlog';
  if (/^in\s*progress$/i.test(s)) return 'In Progress';
  if (/^sandbox\s*testing/i.test(s)) return 'Sandbox Testing';
  if (/^waiting\s*deploy$/i.test(s)) return 'Waiting Deploy';
  if (/^production\s*testing/i.test(s)) return 'Production Testing';
  if (/^fvp$/i.test(s)) return 'FVP';
  if (/^mock\s*bank$/i.test(s)) return 'Mock Bank';
  if (/^mock\s*tpp$/i.test(s)) return 'Mock TPP';
  if (/^conformance\s*suite$/i.test(s)) return 'Conformance Suite';
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

/* ========== Business time (24h, ignorando fds) ========== */
const DAY_MS = 24*60*60*1000;
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=startOfDay(d); x.setDate(x.getDate()+1); return x; }
function overlapMs(a1,a2,b1,b2){ const s=Math.max(a1.getTime(),b1.getTime()); const e=Math.min(a2.getTime(),b2.getTime()); return Math.max(0,e-s); }
function weekendMsBetween(s, e){
  if (e <= s) return 0;
  let ms = 0, cur = startOfDay(s);
  while (cur < e){
    const nxt = endOfDay(cur), wk = [0,6].includes(cur.getDay());
    if (wk) ms += overlapMs(s,e,cur,nxt);
    cur = nxt;
  }
  return ms;
}
function businessMsBetween(s,e){ const total=Math.max(0,e.getTime()-s.getTime()); return Math.max(0,total - weekendMsBetween(s,e)); }
function workingDays24hBetween(s,e){ return Math.floor(businessMsBetween(s,e)/DAY_MS); }
function lastBusinessInstant(d){
  const x=new Date(d);
  if (x.getDay()===0){ x.setDate(x.getDate()-2); x.setHours(23,59,59,999); }
  else if (x.getDay()===6){ x.setDate(x.getDate()-1); x.setHours(23,59,59,999); }
  return x;
}

/* ======= i18n helpers ======= */
function t(key){ return I18N[getLang()][key] || key; }
function fmtLocal(dt){
  const locale = getLang()==='pt' ? 'pt-BR' : 'en-GB';
  return dt.toLocaleString(locale, { timeZone:'America/Sao_Paulo', hour12:false });
}

/* ========== SLA ========== */
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
  return { type: 'nosla', days: null, reason: 'No SLA' };
}
function tStatus(kind){
  if (kind==='paused') return t('tPaused');
  if (kind==='nosla' || kind==='none') return t('tNoSla');
  if (kind==='over') return t('tOver');
  return t('tWithin');
}
function slaLabelAndRank(issue) {
  const rule = issue.sla;
  if (rule.type === 'paused') return { text: tStatus('paused'), class: 'paused', rank: 2 };
  if (rule.type === 'nosla' || rule.type==='none') return { text: tStatus('nosla'), class: 'nosla', rank: 0 };
  const over = issue.daysOpen > rule.days;
  if (over) return { text: tStatus('over'), class: 'over-sla', rank: 3 };
  return { text: tStatus('within'), class: 'within-sla', rank: 1 };
}

/* ========== NOTAS ========== */
function saveComment(key, value) {
  // Try remote if configured and key follows pattern comment-<project>-<iid>
  try{
    if (window.remoteComments && window.remoteComments.enabled && /^comment-(\d+)-(\d+)$/.test(key)){
      const m = key.match(/^comment-(\d+)-(\d+)$/); const projectId = Number(m[1]); const iid = Number(m[2]);
      window.remoteComments.save(projectId, iid, value);
    }
  }catch{}
  localStorage.setItem(key, value);
}
function clearAllComments() {
  if (!confirm(getLang()==='pt'?'Tem certeza que deseja limpar TODOS os comentários?':'Are you sure you want to clear ALL comments?')) return;
  document.querySelectorAll('.comment-box').forEach(a => {
    localStorage.removeItem(a.dataset.key);
    a.value = '';
  });
}

/* ========== FILTROS UI ========== */
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
function clearCategory(cat) { selected[cat].clear(); renderFilterMenus(); renderIssues(); }
function renderChips() {
  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  ['nature','platform','product','wg','status'].forEach(cat => {
    selected[cat].forEach(tag => {
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = `${cat}: ${tag} <span class="x" title="Remove">✕</span>`;
      el.querySelector('.x').onclick = () => { selected[cat].delete(tag); renderFilterMenus(); renderIssues(); };
      chips.appendChild(el);
    });
  });
}
function resetAllFilters() {
  Object.values(selected).forEach(s => s.clear());
  document.querySelectorAll('.filter details[open]').forEach(d => { d.open = false; });
  renderFilterMenus(); renderIssues();
}
/* fecha details ao clicar fora */
document.addEventListener('click', (e) => {
  const insideFilter = e.target.closest('.filter');
  if (!insideFilter) {
    document.querySelectorAll('.filter details[open]').forEach(d => d.removeAttribute('open'));
  }
});

/* ========== SORT ========== */
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
function toggleClosedRange(){
  const mode = getViewMode();
  const row = document.getElementById('closedRange');
  if (row) row.style.display = (mode==='closed14') ? 'flex' : 'none';
}

/* ========== Label events via Netlify proxy ========== */
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

/* Helpers */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

/* calcula NET 24h, clipe de fds p/ exibição e texto i18n */
function computeWorkingDaysContext(issue, now, mode){
  const created = new Date(issue.created_at);
  const closed  = issue.closed_at ? new Date(issue.closed_at) : null;
  const end = (mode === 'closed14' && closed) ? closed : now;

  // Paused intervals
  let pausedMs = 0;
  const lines = [];
  const openStacks = {}; // label -> start
  if (USE_LABEL_EVENTS && Array.isArray(issue._statusTimeline) && issue._statusTimeline.length){
    issue._statusTimeline.forEach(ev=>{
      if (PAUSED_STATUSES.has(ev.label)){
        if (ev.action === 'add'){
          openStacks[ev.label] = ev.when;
        } else if (ev.action === 'remove' && openStacks[ev.label]){
          const s = openStacks[ev.label], e = ev.when;
          const ms = businessMsBetween(s, e);
          pausedMs += ms;
          lines.push(` - ${ev.label}: ${fmtLocal(s)} → ${fmtLocal(e)} (≈ ${Math.floor(ms/DAY_MS)} wd)`);
          delete openStacks[ev.label];
        }
      }
    });
  }
  // abertos até "end"
  Object.entries(openStacks).forEach(([lbl, s])=>{
    const e = end;
    const ms = businessMsBetween(s, e);
    pausedMs += ms;
    lines.push(` - ${lbl}: ${fmtLocal(s)} → ${fmtLocal(e)} (≈ ${Math.floor(ms/DAY_MS)} wd)`);
  });

  const totalMs = businessMsBetween(created, end);
  const netMs   = Math.max(0, totalMs - pausedMs);
  const netDays = Math.floor(netMs / DAY_MS);

  // End exibido: se houver pausa aberta, o início mais antigo; senão end; clipe fins de semana
  let displayEnd = end;
  if (Object.keys(openStacks).length){
    const earliest = Object.values(openStacks).sort((a,b)=>a-b)[0];
    if (earliest) displayEnd = earliest;
  }
  displayEnd = lastBusinessInstant(displayEnd);

  const eventsTxt = (issue._statusTimeline||[])
    .map(e=>` - ${fmtLocal(e.when)} — ${t('lh' + e.action.toUpperCase())} ${e.label}`)
    .join('\n') || ` ${t('lhNoEvents')}`;

  const body =
`${t('lhStart')}: ${fmtLocal(created)}
${t('lhEnd')}:   ${fmtLocal(displayEnd)}
${t('lhRaw')}: ${Math.floor(totalMs/DAY_MS)}
${t('lhPausedSum')}: ${Math.floor(pausedMs/DAY_MS)}

${lines.length ? `${t('lhPausedIntervals')}\n${lines.join('\n')}\n` : ''}

${t('lhEvents')}
${eventsTxt}`;

  return { net: netDays, body };
}

/* ========== DATA ========== */
function setLoading(on) { const el = document.getElementById('loading'); if (el) el.style.display = on ? 'block' : 'none'; }

function updateSubtitle(){
  const mode = getViewMode();
  const a = document.getElementById('issuesSubtitle');
  if (!a) return;
  if (mode==='closed14'){
    const s = document.getElementById('closedStart');
    const e = document.getElementById('closedEnd');
    const loc = getLang()==='pt' ? 'pt-BR' : 'en-GB';
    const sv = (s&&s.value)? new Date(s.value) : new Date(new Date().setDate(new Date().getDate()-7));
    const ev = (e&&e.value)? new Date(e.value) : new Date();
    const sTxt = sv.toLocaleDateString(loc);
    const eTxt = ev.toLocaleDateString(loc);
    a.textContent = `${t('closedIssuesTitle')} — ${getLang()==='pt' ? 'de' : 'from'} ${sTxt} ${getLang()==='pt' ? 'a' : 'to'} ${eTxt}`;
  } else {
    a.textContent = t('openedIssuesTitle');
  }
} — ${getLang()==='pt' ? 'nos últimos 14 dias' : 'in last 14 days'}`
    : t('openedIssuesTitle');
}

async function loadAllIssues() {
  const modeEarly = getViewMode(); if (modeEarly==='dashboard'){ window.location.href = 'dashboard.html'; return; }
  setLoading(true);
  issues.finance = [];

  const mode = getViewMode();
  updateSubtitle();
  toggleClosedRange();

  const dateLbl = document.getElementById('finance-date-label');
  if (dateLbl) dateLbl.textContent = (getViewMode()==='closed14') ? (getLang()==='pt'?'Fechada em':'Closed at') : t('createdAt');

  await loadProjectIssues(26426113, 'finance');

  renderFilterMenus();
  updateSortArrows('finance-table');
  renderIssues();
  setLoading(false);
}

async function loadProjectIssues(projectId, key) {
  const mode = getViewMode();
  const now = new Date();
let since = new Date(now); since.setDate(now.getDate()-7);
const sEl = document.getElementById('closedStart');
const eEl = document.getElementById('closedEnd');
let startDate = sEl && sEl.value ? new Date(sEl.value) : since;
let endDate   = eEl && eEl.value ? new Date(eEl.value) : now;
// include entire end date day
endDate.setHours(23,59,59,999);
since = startDate.toISOString();

  let url = `https://gitlab.com/api/v4/projects/${projectId}/issues?per_page=100`;
  url += (mode === 'closed14') ? `&state=closed&updated_after=${encodeURIComponent(since)}` : `&state=opened`;

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let list = data.map(issue => ({ ...issue, projectId }));
    if (mode === 'closed14') {
  const cutoff = new Date(since);
  list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff && new Date(i.closed_at) <= endDate);
}

    if (USE_LABEL_EVENTS && mode !== 'closed14') {
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

/* ========== RENDER ========== */
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
    const endDate = (mode === 'closed14' && i.closed_at) ? new Date(i.closed_at) : now;
    const daysOpenRaw = workingDays24hBetween(new Date(i.created_at), endDate);
    const sla = (mode === 'closed14') ? { type:'none', days:null } : getSLAFor(i.labels || []);
    const base = { ...i, daysOpen: daysOpenRaw, dateCol: (mode === 'closed14' && i.closed_at) ? i.closed_at : i.created_at, sla };
    const { text, rank, class: klass } = (mode === 'closed14')
      ? { text:'—', rank:-1, class:'nosla' }
      : slaLabelAndRank(base);
    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  const base = decorate(issues.finance);

  if (base.length === 0) {
    const msg = (mode === 'closed14')
      ? (getLang()==='pt'?'Nenhuma issue foi fechada nos últimos 14 dias.':'No issues were closed in the last 14 days.')
      : (getLang()==='pt'?'Nenhuma issue aberta no momento.':'No open issues at the moment.');
    renderEmptyRow(tbody, 11, msg);
    if (summaryEl) {
      summaryEl.textContent =
        (mode === 'closed14')
          ? (getLang()==='pt'?'0 issues públicas fechadas':'0 public closed issues')
          : (getLang()==='pt'
              ? '0 issues públicas abertas — SLA aplicável: 0, Fora do SLA: 0, Sem SLA: 0'
              : '0 public open issues — SLA-applicable: 0, Over SLA: 0, No SLA: 0');
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

  let total = 0, applicable = 0, over = 0, noslaCount = 0;

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
    let saved = localStorage.getItem(key) || '';
if (window.remoteComments && window.remoteComments.enabled){
  window.remoteComments.load(issue.projectId, issue.iid).then(txt=>{
    if (typeof txt === 'string'){
      const ta = document.querySelector(`textarea[data-key="${key}"]`);
      if (ta && ta.value !== txt){ ta.value = txt; localStorage.setItem(key, txt); }
    }
  });
}

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="${issue.web_url}" target="_blank" style="color:var(--accent);">#${issue.iid}</a>
        ${mode === 'closed14' ? '<div class="closed-badge">Closed</div>' : ''}
      </td>
      <td>${escapeHtml(issue.title)}</td>
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

    // relógio abre modal
    tr.querySelectorAll('.wd-link').forEach(el=>{
      el.addEventListener('click', ()=>{
        if (nosla) return;
        issue._historyBody = historyBody || 'Label history unavailable.';
        openHistoryModal(issue);
      });
    });
  });

  if (summaryEl) {
    if (getViewMode()==='closed14'){
      summaryEl.textContent = (getLang()==='pt')
        ? `${sorted.length} issues públicas fechadas`
        : `${sorted.length} public closed issues`;
    } else {
      summaryEl.textContent = (getLang()==='pt'
        ? `${total} issues públicas abertas — SLA aplicável: ${applicable}, Fora do SLA: ${over}, Sem SLA: ${noslaCount}`
        : `${total} public open issues — SLA-applicable: ${applicable}, Over SLA: ${over}, No SLA: ${noslaCount}`);
    }
  }

  updateSortArrows('finance-table');
}

/* ====== Modal ====== */
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

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
  toggleClosedRange(); setTheme(getTheme());
  applyI18n();

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.onclick = () => toggleTheme();

  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.onclick = () => { toggleLang(); updateSubtitle(); loadAllIssues(); };

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

  const closeBtn = document.getElementById('noteEditorClose');
  if (closeBtn) closeBtn.onclick = closeEditor;
  const modal = document.getElementById('noteModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target.id === 'noteModal') closeEditor(); });

  // editor de comentários (mesma UX anterior)
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

  updateSubtitle();
  loadAllIssues();
});
