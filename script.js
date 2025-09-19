// === Configuration ===
const PROJECTS = {
  finance: { id: 26426113, slug: 'raidiam-conformance/open-finance/certification' },
  insurance: { id: 32299006, slug: 'raidiam-conformance/open-insurance/open-insurance-brasil' },
};

const NATURE_SLA = {
  'Bug': 10,
  'Questions': 10,
  'Under Evaluation': 3,
};

const PAUSE_STATUSES = new Set([
  'Under WG/DTO Evaluation',
  'Waiting Participant',
  'In Pipeline',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
]);

// === State ===
const state = {
  view: 'open',
  filters: { nature: new Set(), phase: new Set(), platform: new Set(), status: new Set(), product: new Set() },
  sort: { finance: { key: 'iid', dir: 'asc' }, insurance: { key: 'iid', dir: 'asc' } },
  issues: { finance: [], insurance: [] },
};

// === Utilities ===
const fmtDate = (iso) => new Date(iso).toLocaleDateString();

function workingDaysBetween(startISO, end = new Date()) {
  const start = new Date(startISO);
  const d = new Date(start);
  let days = 0;
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(d)) days++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(0, days - 1);
}

// Brazilian national holidays (2025–2030)
function isHoliday(date) {
  const year = date.getFullYear();
  const fixed = [
    '01-01', '04-21', '05-01', '09-07', '10-12',
    '11-02', '11-15', '12-25'
  ];
  const mmdd = date.toISOString().slice(5, 10);

  if (fixed.includes(mmdd)) return true;
  if (easterBased(year).includes(mmdd)) return true;
  return false;
}

function easterBased(year) {
  // Meeus/Jones/Butcher algorithm
  const f = Math.floor,
    a = year % 19,
    b = f(year / 100),
    c = year % 100,
    d = f(b / 4),
    e = b % 4,
    g = f((8 * b + 13) / 25),
    h = (19 * a + b - d - g + 15) % 30,
    i = f(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = f((a + 11 * h + 22 * l) / 451),
    month = f((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const fmt = (d) => d.toISOString().slice(5, 10);

  return [
    fmt(new Date(easter)),                      // Easter Sunday
    fmt(new Date(easter.getTime() - 2 * 86400000)), // Good Friday
    fmt(new Date(easter.getTime() - 47 * 86400000)), // Carnival Tuesday
    fmt(new Date(easter.getTime() - 48 * 86400000)), // Carnival Monday
    fmt(new Date(easter.getTime() + 60 * 86400000))  // Corpus Christi
  ];
}

function pickLabelGroups(labels) {
  const nature = [];
  const phase = [];
  const platform = [];
  const status = [];
  const product = [];

  for (const l of labels) {
    const base = l.split('::')[0].trim();

    if (/^(Bug|Questions|Change Request|Test Improvement|Breaking Change)$/i.test(base)) {
      nature.push(cap(base));
    } else if (/^Phase\s?(1|2|3|4a|4b)$/i.test(base)) {
      phase.push(cap(base));
    } else if (/^(FVP|Mock Bank|Mock TPP|Conformance Suite)$/i.test(base)) {
      platform.push(base);
    } else if (/^(Under Evaluation|Waiting Participant|Under WG\/DTO Evaluation|In Pipeline|Sandbox Testing|Waiting Deploy|Production Testing)$/i.test(base)) {
      status.push(base);
    } else {
      product.push(base);
    }
  }
  return { nature, phase, platform, status, product };
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function deriveSLA(issue) {
  const { nature, status } = issue.groupedLabels;

  if (status.some(s => PAUSE_STATUSES.has(s))) return { type: 'paused' };

  const key = nature.find(n => NATURE_SLA[n] != null);
  if (key) return { type: 'timed', limit: NATURE_SLA[key] };

  if (nature.length === 0 || nature.includes('Under Evaluation')) return { type: 'timed', limit: 3 };
  return { type: 'none' };
}

function evalSLAStatus(issue) {
  const w = issue.workingDays;
  const sla = deriveSLA(issue);

  if (sla.type === 'paused') return { label: 'SLA Paused', cls: 'paused' };
  if (sla.type === 'none') return { label: 'No SLA', cls: 'none' };
  if (w > sla.limit) return { label: 'Over SLA', cls: 'over' };
  return { label: 'Within SLA', cls: 'within' };
}
function uniq(arr){ return [...new Set(arr)]; }

// === Fetch ===
async function loadProjectIssues(projectId, view) {
  const base = `https://gitlab.com/api/v4/projects/${projectId}/issues`;
  const params = new URLSearchParams({
    per_page: '100',
    order_by: 'created_at',
    sort: 'asc',
  });
  if (view === 'open') params.set('state', 'opened');
  if (view === 'closed7') {
    params.set('state', 'closed');
    const since = new Date();
    since.setDate(since.getDate() - 7);
    params.set('updated_after', since.toISOString());
  }
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitLab ${projectId} ${res.status}`);
  const raw = await res.json();
  return raw.map(r => normalizeIssue(r));
}

function normalizeIssue(r) {
  const groupedLabels = pickLabelGroups(r.labels || []);
  const workingDays = workingDaysBetween(r.created_at);
  return {
    id: r.id,
    iid: r.iid,
    title: r.title,
    web_url: r.web_url,
    created_at: r.created_at,
    labels: r.labels || [],
    groupedLabels,
    workingDays,
    notes: readNote(r.web_url) || '',
  };
}

// === Notes (localStorage) ===
const NOTE_KEY = 'sla-notes-v1';
function readAllNotes(){ try{ return JSON.parse(localStorage.getItem(NOTE_KEY)||'{}'); }catch{return{}} }
function writeAllNotes(map){ localStorage.setItem(NOTE_KEY, JSON.stringify(map)); }
function readNote(url){ const all = readAllNotes(); return all[url]; }
function writeNote(url, val){ const all = readAllNotes(); all[url]=val; writeAllNotes(all); }
function clearAllNotes(){ localStorage.removeItem(NOTE_KEY); }

// === Rendering ===
function renderTable(sectionKey) {
  const table = document.getElementById(sectionKey+"Table");
  const tbody = table.querySelector('tbody');
  const issues = applyFiltersAndSort(state.issues[sectionKey], sectionKey);

  tbody.innerHTML = issues.map(issue => {
    const sla = evalSLAStatus(issue);
    const g = issue.groupedLabels;
    const render = (arr, cls) => arr.map(l=>`<span class="label ${cls}">${escapeHtml(l)}</span>`).join(' ') || '—';
    const note = escapeHtml(issue.notes || '');
    return `
      <tr>
        <td><a href="${issue.web_url}" target="_blank" rel="noreferrer">#${issue.iid}</a></td>
        <td>${escapeHtml(issue.title)}</td>
        <td>${fmtDate(issue.created_at)}</td>
        <td>${issue.workingDays}</td>
        <td><span class="sla ${sla.cls}">${sla.label}</span></td>
        <td>${render(g.nature,'nature')}</td>
        <td>${render(g.phase,'phase')}</td>
        <td>${render(g.platform,'platform')}</td>
        <td>${render(g.product,'product')}</td>
        <td>${render(g.status,'status')}</td>
        <td>
          <textarea class="note" data-url="${issue.web_url}" placeholder="Add a comment…">${note}</textarea>
          <div style="margin-top:6px">
            <button class="btn btn-outline btn-sm" data-edit-url="${issue.web_url}">Edit</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Empty state
  const empty = document.getElementById(sectionKey+"Empty");
  empty.classList.toggle('hidden', issues.length>0);
  if (issues.length===0){
    empty.textContent = state.view==='closed7'
      ? 'No issues closed in the last 7 days that match your filters.'
      : 'No open issues match your filters.';
  }

  // Summary
  const sumEl = document.getElementById(sectionKey+"Summary");
  const totals = summarize(issues);
  sumEl.textContent = `Total: ${totals.total} • SLA-applicable: ${totals.applicable} • Over SLA: ${totals.over}`;

  // Notes listeners
  tbody.querySelectorAll('textarea.note').forEach(t => {
    t.addEventListener('input', (e)=> writeNote(e.target.dataset.url, e.target.value));
  });
  tbody.querySelectorAll('button[data-edit-url]').forEach(b => {
    b.addEventListener('click', ()=> openModal(b.getAttribute('data-edit-url')));
  });
}

function summarize(list){
  const app = list.filter(i=>['within','over','paused'].includes(evalSLAStatus(i).cls));
  const over = list.filter(i=>evalSLAStatus(i).cls==='over');
  return { total:list.length, applicable:app.length, over:over.length };
}

function renderLabels(groups){
  const render = (arr, cls) => arr.map(l=>`<span class="label ${cls}">${escapeHtml(l)}</span>`).join(' ');
  return `<div class="label-group">${render(groups.nature,'nature')}${render(groups.phase,'phase')}${render(groups.platform,'platform')}${render(groups.status,'status')}${render(groups.product,'product')}</div>`;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function applyFiltersAndSort(list, sectionKey){
  const { nature, phase, platform, status, product } = state.filters;
  let out = list.filter(it => (
    (nature.size===0 || it.groupedLabels.nature.some(l=>nature.has(l))) &&
    (phase.size===0 || it.groupedLabels.phase.some(l=>phase.has(l))) &&
    (platform.size===0 || it.groupedLabels.platform.some(l=>platform.has(l))) &&
    (status.size===0 || it.groupedLabels.status.some(l=>status.has(l))) &&
    (product.size===0 || it.groupedLabels.product.some(l=>product.has(l)))
  ));
  const { key, dir } = state.sort[sectionKey];
  out.sort((a,b)=>{
    const va = key==='sla' ? evalSLAStatus(a).label : a[key];
    const vb = key==='sla' ? evalSLAStatus(b).label : b[key];
    return (va>vb?1:va<vb?-1:0) * (dir==='asc'?1:-1);
  });
  return out;
}

function initSort(){
  ['finance','insurance'].forEach(sectionKey=>{
    document.querySelectorAll(`#${sectionKey}Table th[data-sort]`).forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.getAttribute('data-sort');
        const cur = state.sort[sectionKey];
        state.sort[sectionKey] = { key, dir: (cur.key===key && cur.dir==='asc') ? 'desc' : 'asc' };
        document.querySelectorAll(`#${sectionKey}Table th`).forEach(t=>t.classList.remove('sorted-asc','sorted-desc'));
        th.classList.add(state.sort[sectionKey].dir==='asc'?'sorted-asc':'sorted-desc');
        renderTable(sectionKey);
      });
    });
  });
}

function buildFilterChips(){
  const all = { nature:new Set(), phase:new Set(), platform:new Set(), status:new Set(), product:new Set() };
  ['finance','insurance'].forEach(key=>{
    state.issues[key].forEach(i=>{
      i.groupedLabels.nature.forEach(l=>all.nature.add(l));
      i.groupedLabels.phase.forEach(l=>all.phase.add(l));
      i.groupedLabels.platform.forEach(l=>all.platform.add(l));
      i.groupedLabels.status.forEach(l=>all.status.add(l));
      i.groupedLabels.product.forEach(l=>all.product.add(l));
    });
  });
  const mount = (id, pool, set) => {
    const host = document.getElementById(id);
    host.innerHTML = [...pool].sort().map(l=>`<span class="chip ${set.has(l)?'on':''}" data-val="${l}">${l}</span>`).join('');
    host.querySelectorAll('.chip').forEach(ch=>{
      ch.addEventListener('click',()=>{
        const v = ch.getAttribute('data-val');
        if (set.has(v)) set.delete(v); else set.add(v);
        ch.classList.toggle('on');
        renderTable('finance');
        renderTable('insurance');
      });
    });
  };
  mount('natureChips', all.nature, state.filters.nature);
  mount('phaseChips', all.phase, state.filters.phase);
  mount('platformChips', all.platform, state.filters.platform);
  mount('statusChips', all.status, state.filters.status);
  mount('productChips', all.product, state.filters.product);
}

async function refresh() {
  document.getElementById('financeLink').href = `https://gitlab.com/${PROJECTS.finance.slug}/-/issues`;
  document.getElementById('insuranceLink').href = `https://gitlab.com/${PROJECTS.insurance.slug}/-/issues`;

  const view = state.view;
  const [finance, insurance] = await Promise.all([
    loadProjectIssues(PROJECTS.finance.id, view),
    loadProjectIssues(PROJECTS.insurance.id, view),
  ]);
  state.issues.finance = finance;
  state.issues.insurance = insurance;
  buildFilterChips();
  renderTable('finance');
  renderTable('insurance');
}

function init() {
  document.getElementById('viewSelect').addEventListener('change', e=>{
    state.view = e.target.value;
    refresh();
  });
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.getElementById('resetFiltersBtn').addEventListener('click', ()=>{
    Object.values(state.filters).forEach(set => set.clear());
    buildFilterChips();
    renderTable('finance');
    renderTable('insurance');
  });
  document.getElementById('clearNotesBtn').addEventListener('click', ()=>{
    if (confirm('Clear ALL comments for all issues?')) { clearAllNotes(); refresh(); }
  });
  initSort();
  refresh();
}

window.addEventListener('DOMContentLoaded', init);

// === Modal for editing notes ===
function openModal(url) {
  const current = readNote(url) || '';
  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.top=0; overlay.style.left=0; overlay.style.right=0; overlay.style.bottom=0;
  overlay.style.background='rgba(0,0,0,0.6)';
  overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
  overlay.style.zIndex=1000;

  const box = document.createElement('div');
  box.style.background='#111827'; box.style.padding='20px'; box.style.borderRadius='12px'; box.style.width='500px'; box.style.maxWidth='90%';

  const textarea = document.createElement('textarea');
  textarea.className='note-large';
  textarea.value=current;
  box.appendChild(textarea);

  const actions = document.createElement('div');
  actions.style.marginTop='10px'; actions.style.textAlign='right';

  const saveBtn = document.createElement('button');
  saveBtn.className='btn'; saveBtn.textContent='Save';
  saveBtn.onclick=()=>{ writeNote(url, textarea.value); document.body.removeChild(overlay); refresh(); };

  const cancelBtn = document.createElement('button');
  cancelBtn.className='btn-outline'; cancelBtn.style.marginLeft='8px'; cancelBtn.textContent='Cancel';
  cancelBtn.onclick=()=>{ document.body.removeChild(overlay); };

  actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
