// ==== Config ====
const PROJECTS = {
  finance: { id: 26426113, slug: 'raidiam-conformance/open-finance/certification' },
  insurance: { id: 32299006, slug: 'raidiam-conformance/open-insurance/open-insurance-brasil' },
};

// Canonical sets
const NATURE = new Set(['Questions','Bug','Change Request','Test Improvement','Breaking Change']);
const PLATFORM = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);

// Regex for Phase
const PHASE_RE = /^(phase)\s*(1|2|3|4a|4b)$/i;

// Status universe
const STATUS_LIST = [
  'Under Evaluation',
  'Waiting Participant',
  'Under WG/DTO Evaluation',
  'In Pipeline',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
];

// SLA rules
const SLA_LIMITS = { Bug: 10, Questions: 10 }; // working days
const PAUSE_STATUS = new Set([
  'Under WG/DTO Evaluation',
  'Waiting Participant',
  'In Pipeline',
  'Sandbox Testing',
  'Waiting Deploy',
  'Production Testing',
]);

// Holidays (BR nationals) 2025–2030
const HOLIDAYS = buildBrazilHolidays(2025, 2030); // Set('YYYY-MM-DD')

// ==== State ====
const state = {
  view: 'open', // 'open' | 'closed7'
  issues: { finance: [], insurance: [] },
  filters: { nature:new Set(), phase:new Set(), platform:new Set(), product:new Set(), status:new Set() },
  sort: {
    'finance-table': { key: 'iid', dir: 'asc' },
    'insurance-table': { key: 'iid', dir: 'asc' },
  },
};

// ==== Utils ====
const fmtDate = (iso) => new Date(iso).toLocaleDateString();
const isoDate = (d) => d.toISOString().slice(0,10);
const capWords = (s)=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const splitPrefix = (v)=>String(v).split('::')[0].trim();

function workingDaysBetween(startISO, end = new Date()){
  const start = new Date(startISO); const d = new Date(start);
  let days = 0;
  while (d <= end){
    const w = d.getDay(); // 0 Sun, 6 Sat
    if (w!==0 && w!==6 && !HOLIDAYS.has(isoDate(d))) days++;
    d.setDate(d.getDate()+1);
  }
  return Math.max(0, days-1);
}

function canonizePhase(s){
  const m = String(s).match(PHASE_RE);
  if (!m) return capWords(s);
  const p = m[2].toLowerCase();
  return `Phase ${p}`.replace(/(^|\s)\w/g,c=>c.toUpperCase());
}

function groupLabels(labels){
  const nature=[]; const phase=[]; const platform=[]; const status=[]; const product=[];
  for (const raw of labels||[]){
    const base = splitPrefix(raw);
    const canon = capWords(base);

    if (NATURE.has(canon)) { nature.push(canon); continue; }
    if (PHASE_RE.test(base)) { phase.push(canonizePhase(base)); continue; }
    if (PLATFORM.has(canon)) { platform.push(canon); continue; }
    if (STATUS_LIST.includes(canon)) { status.push(canon); continue; }

    product.push(base); // everything else is Product
  }
  return { nature, phase, platform, status, product };
}

function deriveSLA(g){
  // Pause takes precedence
  if (g.status.some(s=>PAUSE_STATUS.has(s))) return { type:'paused' };

  // Nature-based SLA
  const nat = g.nature[0];
  if (nat==='Bug' || nat==='Questions') return { type:'timed', limit: SLA_LIMITS[nat] };

  // Under Evaluation or no Nature => 3 days
  if (g.nature.length===0 || g.status.includes('Under Evaluation')) return { type:'timed', limit: 3 };

  // Change Request/Test Improvement/Breaking Change => no SLA
  if (['Change Request','Test Improvement','Breaking Change'].some(x=>g.nature.includes(x)))
    return { type:'none' };

  return { type:'none' };
}

function evalSLAStatus(issue){
  const sla = deriveSLA(issue.groupedLabels);
  if (sla.type==='paused') return { label:'SLA Paused', cls:'paused', rank:2 };
  if (sla.type==='none')   return { label:'No SLA',   cls:'none',   rank:0 };
  const over = issue.workingDays > sla.limit;
  return over
    ? { label:'Over SLA', cls:'over', rank:3 }
    : { label:'Within SLA', cls:'within', rank:1 };
}

// Holidays builder
function buildBrazilHolidays(startYear, endYear){
  const set = new Set();
  for (let y=startYear; y<=endYear; y++){
    // fixed
    [`${y}-01-01`,`${y}-04-21`,`${y}-05-01`,`${y}-09-07`,`${y}-10-12`,`${y}-11-02`,`${y}-11-15`,`${y}-12-25`]
      .forEach(d=>set.add(d));
    // movable: carnival (Tue), good friday, corpus christi
    const easter = easterDate(y);
    set.add(isoDate(addDays(easter,-47))); // Carnival Tue
    set.add(isoDate(addDays(easter,-2)));  // Good Friday
    set.add(isoDate(addDays(easter,60)));  // Corpus Christi
  }
  return set;
}
function easterDate(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),
        g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,
        l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y, month-1, day);
}
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

// === Storage (comments) ===
const NOTE_KEY = 'sla-notes-v2';
const readAllNotes = ()=>{ try{ return JSON.parse(localStorage.getItem(NOTE_KEY)||'{}'); }catch{return{}} };
const writeAllNotes = (m)=> localStorage.setItem(NOTE_KEY, JSON.stringify(m));
const readNote = (url)=> readAllNotes()[url] || '';
function writeNote(url,val){ const m=readAllNotes(); m[url]=val; writeAllNotes(m); }
function clearAllComments(){ localStorage.removeItem(NOTE_KEY); loadAllIssues(); }

// ==== Fetch ====
async function fetchProjectIssues(projectId, view){
  const base = `https://gitlab.com/api/v4/projects/${projectId}/issues`;
  const params = new URLSearchParams({ per_page:'100', order_by:'created_at', sort:'asc' });
  if (view==='open') params.set('state','opened');
  if (view==='closed7') params.set('state','closed');
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitLab ${projectId} ${res.status}`);
  const raw = await res.json();
  let list = raw;
  if (view==='closed7'){
    const since = new Date(); since.setDate(since.getDate()-7);
    list = raw.filter(r => r.closed_at && new Date(r.closed_at) >= since);
  }
  return list.map(r=>{
    const g = groupLabels(r.labels||[]);
    return {
      id:r.id, iid:r.iid, title:r.title, web_url:r.web_url,
      created_at:r.created_at, closed_at:r.closed_at||null,
      groupedLabels:g,
      workingDays: workingDaysBetween(r.created_at),
      notes: readNote(r.web_url),
      sla: evalSLAStatus({ groupedLabels:g, workingDays: workingDaysBetween(r.created_at) }),
    };
  });
}

// ==== Rendering ====
function renderSection(sectionKey, tableId, summaryId){
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');

  // apply filters
  const f = state.filters;
  const src = state.issues[sectionKey].filter(it =>
    (f.nature.size===0   || it.groupedLabels.nature.some(x=>f.nature.has(x))) &&
    (f.phase.size===0    || it.groupedLabels.phase.some(x=>f.phase.has(x))) &&
    (f.platform.size===0 || it.groupedLabels.platform.some(x=>f.platform.has(x))) &&
    (f.product.size===0  || it.groupedLabels.product.some(x=>f.product.has(x))) &&
    (f.status.size===0   || it.groupedLabels.status.some(x=>f.status.has(x)))
  );

  // sort
  const {key,dir} = state.sort[tableId];
  const sorted = [...src].sort((a,b)=>{
    let va, vb;
    if (key==='dateCol'){
      va = state.view==='closed7' ? (a.closed_at||'') : a.created_at;
      vb = state.view==='closed7' ? (b.closed_at||'') : b.created_at;
    } else if (key==='slaRank'){
      va = a.sla.rank; vb = b.sla.rank;
    } else {
      va = a[key]; vb = b[key];
    }
    return (va>vb?1:va<vb?-1:0) * (dir==='asc'?1:-1);
  });

  // rows
  tbody.innerHTML = sorted.map(it=>{
    const g = it.groupedLabels;
    const render = (arr, cls)=> arr.length ? arr.map(l=>`<span class="label ${cls}">${escapeHtml(l)}</span>`).join(' ') : '—';
    return `
      <tr>
        <td><a href="${it.web_url}" target="_blank" rel="noreferrer">#${it.iid}</a></td>
        <td>${escapeHtml(it.title)}</td>
        <td>${fmtDate(state.view==='closed7' && it.closed_at ? it.closed_at : it.created_at)}</td>
        <td>${it.workingDays}</td>
        <td><span class="sla ${it.sla.cls}">${it.sla.label}</span></td>
        <td>${render(g.nature,'nature')}</td>
        <td>${render(g.phase,'phase')}</td>
        <td>${render(g.platform,'platform')}</td>
        <td>${render(g.product,'product')}</td>
        <td>${render(g.status,'status')}</td>
        <td>
          <textarea class="note" data-url="${it.web_url}" placeholder="Add a comment…">${escapeHtml(it.notes||'')}</textarea>
        </td>
      </tr>`;
  }).join('');

  // listeners notes
  tbody.querySelectorAll('textarea.note').forEach(t=>{
    t.addEventListener('input', e=> writeNote(e.target.dataset.url, e.target.value));
  });

  // summary
  const totals = {
    total: sorted.length,
    applicable: sorted.filter(x=>['within','over','paused'].includes(x.sla.cls)).length,
    over: sorted.filter(x=>x.sla.cls==='over').length,
  };
  document.getElementById(summaryId).textContent =
    `Total: ${totals.total} • SLA-applicable: ${totals.applicable} • Over SLA: ${totals.over}`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

// ==== Menus (chips) ====
function buildMenus(){
  const pools = { nature:new Set(), phase:new Set(), platform:new Set(), product:new Set(), status:new Set() };
  ['finance','insurance'].forEach(sec=>{
    state.issues[sec].forEach(i=>{
      i.groupedLabels.nature.forEach(x=>pools.nature.add(x));
      i.groupedLabels.phase.forEach(x=>pools.phase.add(x));
      i.groupedLabels.platform.forEach(x=>pools.platform.add(x));
      i.groupedLabels.product.forEach(x=>pools.product.add(x));
      i.groupedLabels.status.forEach(x=>pools.status.add(x));
    });
  });

  const mount = (id,set,values,countId)=>{
    const host = document.getElementById(id); host.innerHTML='';
    [...values].sort().forEach(v=>{
      const el = document.createElement('span');
      el.className = 'chip'+(set.has(v)?' on':'');
      el.textContent = v;
      el.onclick = ()=>{ set.has(v)?set.delete(v):set.add(v); mount(id,set,values,countId); renderAll(); };
      host.appendChild(el);
    });
    const cnt = document.getElementById(countId); if (cnt) cnt.textContent = set.size;
  };

  mount('menu-nature',   state.filters.nature,   pools.nature,   'count-nature');
  mount('menu-phase',    state.filters.phase,    pools.phase,    'count-phase');
  mount('menu-platform', state.filters.platform, pools.platform, 'count-platform');
  mount('menu-product',  state.filters.product,  pools.product,  'count-product');
  mount('menu-status',   state.filters.status,   pools.status,   'count-status');

  // active chips line
  const active = [];
  Object.entries(state.filters).forEach(([k,set])=>{
    [...set].forEach(v=> active.push([k,v]));
  });
  const chips = document.getElementById('chips'); chips.innerHTML='';
  active.forEach(([k,v])=>{
    const c = document.createElement('span');
    c.className='chip on';
    c.textContent=`${k}: ${v}`;
    c.onclick=()=>{ state.filters[k].delete(v); buildMenus(); renderAll(); };
    chips.appendChild(c);
  });
}

function resetAllFilters(){
  Object.values(state.filters).forEach(s=>s.clear());
  buildMenus(); renderAll();
}

// ==== Sort header click ====
function changeSort(tableId, key){
  const cur = state.sort[tableId];
  const dir = (cur.key===key && cur.dir==='asc') ? 'desc' : 'asc';
  state.sort[tableId] = { key, dir };
  // arrow visuals (optional; will work even sem CSS custom)
  document.querySelectorAll(`#${tableId} th`).forEach(th=> th.classList.remove('sorted-asc','sorted-desc'));
  const th = document.querySelector(`#${tableId} th[data-key="${key}"]`);
  if (th) th.classList.add(dir==='asc'?'sorted-asc':'sorted-desc');
  renderAll();
}

// ==== Main ====
async function loadAllIssues(){
  document.getElementById('loading').style.display='block';
  state.view = document.getElementById('viewMode').value;

  // Update date column labels
  document.getElementById('finance-date-label').textContent = state.view==='closed7' ? 'Closed At' : 'Created At';
  document.getElementById('insurance-date-label').textContent = state.view==='closed7' ? 'Closed At' : 'Created At';

  const [finance, insurance] = await Promise.all([
    fetchProjectIssues(PROJECTS.finance.id, state.view),
    fetchProjectIssues(PROJECTS.insurance.id, state.view),
  ]);

  state.issues.finance = finance;
  state.issues.insurance = insurance;

  buildMenus();
  renderAll();
  document.getElementById('loading').style.display='none';
}

function renderAll(){
  renderSection('finance','finance-table','finance-summary');
  renderSection('insurance','insurance-table','insurance-summary');
}

// init
window.addEventListener('DOMContentLoaded', loadAllIssues);
