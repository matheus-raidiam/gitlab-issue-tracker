/* -------------------- Config -------------------- */
const PROJECTS = {
  finance: { id: 26426113, slug: 'raidiam-conformance/open-finance/certification' },
  insurance: { id: 32299006, slug: 'raidiam-conformance/open-insurance/open-insurance-brasil' },
};

const NATURE = new Set(['Questions','Bug','Change Request','Test Improvement','Breaking Change']);
const PLATFORM = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);
const PHASE_RE = /^(phase)\s*(1|2|3|4a|4b)$/i;
const STATUS_LIST = [
  'Under Evaluation','Waiting Participant','Under WG/DTO Evaluation',
  'In Pipeline','Sandbox Testing','Waiting Deploy','Production Testing'
];

const SLA_LIMITS = { Bug: 10, Questions: 10 };
const PAUSE_STATUS = new Set([
  'Under WG/DTO Evaluation','Waiting Participant','In Pipeline',
  'Sandbox Testing','Waiting Deploy','Production Testing'
]);

const HOLIDAYS = buildBrazilHolidays(2025, 2030);

/* -------------------- State -------------------- */
const state = {
  view: 'open',
  issues: { finance: [], insurance: [] },
  filters: { nature:new Set(), phase:new Set(), platform:new Set(), product:new Set(), status:new Set() },
  sort: {
    'finance-table': { key: 'iid', dir: 'asc' },
    'insurance-table': { key: 'iid', dir: 'asc' },
  },
};

/* -------------------- Utils -------------------- */
const fmtDate = (iso) => new Date(iso).toLocaleDateString();
const isoDate = (d) => d.toISOString().slice(0,10);
const capWords = (s)=>String(s).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const splitPrefix = (v)=>String(v).split('::')[0].trim();

function showLoading(on){ const el = document.getElementById('loading'); if (el) el.style.display = on?'block':'none'; }
function showTopError(msg){
  console.error(msg);
  let el = document.getElementById('top-error');
  if (!el){
    el = document.createElement('div');
    el.id = 'top-error';
    el.style.cssText = 'margin:10px 16px;color:#fca5a5';
    document.body.prepend(el);
  }
  el.textContent = `⚠️ ${msg}`;
}

function workingDaysBetween(startISO, end = new Date()){
  const start = new Date(startISO); const d = new Date(start);
  let days = 0;
  while (d <= end){
    const w = d.getDay();
    if (w!==0 && w!==6 && !HOLIDAYS.has(isoDate(d))) days++;
    d.setDate(d.getDate()+1);
  }
  return Math.max(0, days-1);
}
function canonizePhase(s){
  const m = String(s).match(PHASE_RE);
  if (!m) return capWords(s);
  return `Phase ${m[2].toLowerCase()}`.replace(/\b\w/g,c=>c.toUpperCase());
}
function groupLabels(labels){
  const nature=[], phase=[], platform=[], status=[], product=[];
  for (const raw of labels||[]){
    const base = splitPrefix(raw);
    const canon = capWords(base);
    if (NATURE.has(canon)){ nature.push(canon); continue; }
    if (PHASE_RE.test(base)){ phase.push(canonizePhase(base)); continue; }
    if (PLATFORM.has(canon)){ platform.push(canon); continue; }
    if (STATUS_LIST.includes(canon)){ status.push(canon); continue; }
    product.push(base);
  }
  return { nature, phase, platform, status, product };
}
function deriveSLA(g){
  if (g.status.some(s=>PAUSE_STATUS.has(s))) return { type:'paused' };
  const nat = g.nature[0];
  if (nat==='Bug' || nat==='Questions') return { type:'timed', limit:SLA_LIMITS[nat] };
  if (g.nature.length===0 || g.status.includes('Under Evaluation')) return { type:'timed', limit:3 };
  if (['Change Request','Test Improvement','Breaking Change'].some(x=>g.nature.includes(x))) return { type:'none' };
  return { type:'none' };
}
function evalSLAStatus(workingDays, g){
  const sla = deriveSLA(g);
  if (sla.type==='paused') return { label:'SLA Paused', cls:'paused', rank:2 };
  if (sla.type==='none')   return { label:'No SLA',   cls:'none',   rank:0 };
  const over = workingDays > sla.limit;
  return over? { label:'Over SLA', cls:'over', rank:3 } : { label:'Within SLA', cls:'within', rank:1 };
}

/* ---- Holidays helpers ---- */
function buildBrazilHolidays(startYear, endYear){
  const set = new Set();
  for (let y=startYear; y<=endYear; y++){
    [`${y}-01-01`,`${y}-04-21`,`${y}-05-01`,`${y}-09-07`,`${y}-10-12`,`${y}-11-02`,`${y}-11-15`,`${y}-12-25`]
      .forEach(d=>set.add(d));
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

/* -------------------- Storage (comments) -------------------- */
const NOTE_KEY = 'sla-notes-v2';
const readAllNotes = ()=>{ try{ return JSON.parse(localStorage.getItem(NOTE_KEY)||'{}'); }catch{return{}} };
const writeAllNotes = (m)=> localStorage.setItem(NOTE_KEY, JSON.stringify(m));
const readNote = (url)=> readAllNotes()[url] || '';
function writeNote(url,val){ const m=readAllNotes(); m[url]=val; writeAllNotes(m); }
function clearAllComments(){ localStorage.removeItem(NOTE_KEY); loadAllIssues(); }

/* -------------------- Fetch -------------------- */
async function fetchProjectIssues(projectId, view){
  const base = `https://gitlab.com/api/v4/projects/${projectId}/issues`;
  const params = new URLSearchParams({ per_page:'100', order_by:'created_at', sort:'asc' });
  if (view==='open') params.set('state','opened');
  if (view==='closed7') params.set('state','closed');

  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitLab ${projectId} HTTP ${res.status}`);
  const raw = await res.json();

  let list = raw;
  if (view==='closed7'){
    const since = new Date(); since.setDate(since.getDate()-7);
    list = raw.filter(r => r.closed_at && new Date(r.closed_at) >= since);
  }

  return list.map(r=>{
    const g = groupLabels(r.labels||[]);
    const w = workingDaysBetween(r.created_at);
    return {
      id:r.id, iid:r.iid, title:r.title, web_url:r.web_url,
      created_at:r.created_at, closed_at:r.closed_at||null,
      groupedLabels:g,
      workingDays:w,
      notes: readNote(r.web_url),
      sla: evalSLAStatus(w, g),
    };
  });
}

/* -------------------- Render -------------------- */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

function renderSection(sectionKey, tableId, summaryId){
  const table = document.getElementById(tableId);
  const tbody = table?.querySelector('tbody');
  if (!table || !tbody){ showTopError(`Missing table "${tableId}" in HTML.`); return; }

  // filters
  const f = state.filters;
  const src = state.issues[sectionKey].filter(it =>
    (f.nature.size===0   || it.groupedLabels.nature.some(x=>f.nature.has(x))) &&
    (f.phase.size===0    || it.groupedLabels.phase.some(x=>f.phase.has(x))) &&
    (f.platform.size===0 || it.groupedLabels.platform.some(x=>f.platform.has(x))) &&
    (f.product.size===0  || it.groupedLabels.product.some(x=>f.product.has(x))) &&
    (f.status.size===0   || it.groupedLabels.status.some(x=>f.status.has(x)))
  );

  // sort
  const sortConf = state.sort[tableId] || { key:'iid', dir:'asc' };
  const {key,dir} = sortConf;
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
        <td><textarea class="note" data-url="${it.web_url}" placeholder="Add a comment…">${escapeHtml(it.notes)}</textarea></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('textarea.note').forEach(t=>{
    t.addEventListener('input', e=> writeNote(e.target.dataset.url, e.target.value));
  });

  const summaryEl = document.getElementById(summaryId);
  if (summaryEl){
    const totals = {
      total: sorted.length,
      applicable: sorted.filter(x=>['within','over','paused'].includes(x.sla.cls)).length,
      over: sorted.filter(x=>x.sla.cls==='over').length,
    };
    summaryEl.textContent = `Total: ${totals.total} • SLA-applicable: ${totals.applicable} • Over SLA: ${totals.over}`;
  }
}

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

  const mount = (menuId,set,values,countId)=>{
    const host = document.getElementById(menuId);
    const cnt = document.getElementById(countId);
    if (!host) return;
    host.innerHTML = '';
    [...values].sort().forEach(v=>{
      const el = document.createElement('span');
      el.className = 'chip'+(set.has(v)?' on':'');
      el.textContent = v;
      el.onclick = ()=>{ set.has(v)?set.delete(v):set.add(v); buildMenus(); renderAll(); };
      host.appendChild(el);
    });
    if (cnt) cnt.textContent = String(set.size);
  };

  mount('menu-nature',   state.filters.nature,   pools.nature,   'count-nature');
  mount('menu-phase',    state.filters.phase,    pools.phase,    'count-phase');
  mount('menu-platform', state.filters.platform, pools.platform, 'count-platform');
  mount('menu-product',  state.filters.product,  pools.product,  'count-product');
  mount('menu-status',   state.filters.status,   pools.status,   'count-status');

  const chips = document.getElementById('chips');
  if (chips){
    chips.innerHTML = '';
    Object.entries(state.filters).forEach(([k,set])=>{
      [...set].forEach(v=>{
        const c = document.createElement('span');
        c.className='chip on';
        c.textContent=`${k}: ${v}`;
        c.onclick=()=>{ state.filters[k].delete(v); buildMenus(); renderAll(); };
        chips.appendChild(c);
      });
    });
  }
}

function resetAllFilters(){
  Object.values(state.filters).forEach(s=>s.clear());
  buildMenus(); renderAll();
}

function changeSort(tableId, key){
  const cur = state.sort[tableId] || { key:'iid', dir:'asc' };
  const dir = (cur.key===key && cur.dir==='asc') ? 'desc' : 'asc';
  state.sort[tableId] = { key, dir };
  renderAll();
}

/* -------------------- Main -------------------- */
async function loadAllIssues(){
  try{
    const viewSel = document.getElementById('viewMode');
    if (!viewSel){ showTopError('Missing #viewMode select in HTML.'); return; }

    state.view = viewSel.value;
    const fLabel = document.getElementById('finance-date-label');
    const iLabel = document.getElementById('insurance-date-label');
    if (fLabel) fLabel.textContent = state.view==='closed7' ? 'Closed At' : 'Created At';
    if (iLabel) iLabel.textContent = state.view==='closed7' ? 'Closed At' : 'Created At';

    showLoading(true);
    const [finance, insurance] = await Promise.all([
      fetchProjectIssues(PROJECTS.finance.id, state.view),
      fetchProjectIssues(PROJECTS.insurance.id, state.view),
    ]);
    state.issues.finance = finance;
    state.issues.insurance = insurance;

    buildMenus();
    renderAll();
  } catch(err){
    showTopError(`Load error: ${err.message}`);
  } finally{
    showLoading(false);
  }
}

function renderAll(){
  renderSection('finance','finance-table','finance-summary');
  renderSection('insurance','insurance-table','insurance-summary');
}

/* -------------------- Init -------------------- */
window.addEventListener('DOMContentLoaded', loadAllIssues);
