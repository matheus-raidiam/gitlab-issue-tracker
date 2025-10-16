/* Dashboard with selectable period + theme/lang sync */
const STATUS_LABELS   = new Set(['Under Evaluation','Waiting Participant','Under WG/DTO Evaluation','Evaluated by WG/DTO','Backlog','In Progress','Sandbox Testing','Waiting Deploy','Production Testing']);
const NATURE_LABELS   = new Set(['Questions','Bug','Change Request','Test Improvement','Breaking Change']);
const PLATFORM_LABELS = new Set(['FVP','Mock Bank','Mock TPP','Conformance Suite']);
const WG_LABELS       = new Set(['GT Serviços','GT Portabilidade de crédito','Squad Sandbox','Squad JSR']);

function baseLabel(l){ return String(l||'').split('::')[0].trim(); }
function canonLabel(l){
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
  if (/^squad\s*sandbox/i.test(s)) return 'Squad Sandbox';
  if (/^squad\s*jsr/i.test(s)) return 'Squad JSR';
  return baseLabel(s);
}
function classifyLabels(labels = []){
  const status=[], nature=[], product=[], platform=[], wg=[];
  labels.forEach(raw=>{
    const canon = canonLabel(raw);
    if (STATUS_LABELS.has(canon))   { status.push(canon);   return; }
    if (NATURE_LABELS.has(canon))   { nature.push(canon);   return; }
    if (PLATFORM_LABELS.has(canon)) { platform.push(canon); return; }
    if (WG_LABELS.has(canon))       { wg.push(canon);       return; }
    product.push(canon);
  });
  return {status,nature,product,platform,wg};
}

const DAY_MS = 24*60*60*1000;
function workingDays24hBetween(s,e){
  const start=new Date(s), end=new Date(e);
  let cur=new Date(start); cur.setHours(0,0,0,0);
  let ms=0;
  while(cur<end){
    const isWeekend = [0,6].includes(cur.getDay());
    const next = new Date(cur); next.setDate(cur.getDate()+1);
    if (!isWeekend){
      const a=Math.max(start.getTime(),cur.getTime());
      const b=Math.min(end.getTime(),next.getTime());
      if (b>a) ms += (b-a);
    }
    cur = next;
  }
  return Math.floor(ms/DAY_MS);
}

function renderLine(el, labels, values){
  const W = el.clientWidth || 600, H = el.clientHeight || 180;
  const pad = {l:28, r:8, t:8, b:22};
  const maxY = Math.max(1, ...values);
  const xs = (i)=> pad.l + (i*(W-pad.l-pad.r)/(labels.length-1 || 1));
  const ys = (v)=> pad.t + (H-pad.t-pad.b) * (1 - (v/maxY));
  const points = values.map((v,i)=> `${xs(i)},${ys(v)}`).join(' ');

  let yTicks = ''; const ticks=4;
  for(let t=0;t<=ticks;t++){
    const val = Math.round(maxY * t / ticks);
    const y = ys(val);
    yTicks += `<text x="2" y="${y+4}" font-size="10" fill="var(--text)">${val}</text>`;
    yTicks += `<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="rgba(255,255,255,.08)"/>`;
  }
  const step = Math.ceil(labels.length/6) || 1;
  let xLabels='';
  labels.forEach((lab,i)=>{
    if (i % step === 0 || i===labels.length-1){
      xLabels += `<text x="${xs(i)}" y="${H-6}" font-size="10" text-anchor="middle" fill="var(--text)">${lab}</text>`;
    }
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none">
    <polyline fill="none" stroke="#00e38c" stroke-width="2" points="${points}" />
    ${yTicks}
    ${xLabels}
  </svg>`;
}

async function fetchIssues(projectId, params){
  const url = `https://gitlab.com/api/v4/projects/${projectId}/issues?per_page=100&${params}`;
  const r = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function getPeriodDays(){
  const sel = document.getElementById('periodSelect');
  return sel ? parseInt(sel.value,10) || 30 : 30;
}
function setPeriodLabels(n){
  const lbl = `(last ${n} days)`;
  ['periodCreated','periodClosed','periodWg','periodProd','periodAuthors','periodWeekday','periodComments','periodUpvotes']
    .forEach(id => { const el=document.getElementById(id); if (el) el.textContent = lbl; });
  const k1=document.getElementById('kpiClosedTitle'); if (k1) k1.textContent = `Closed (last ${n} days)`;
  const k2=document.getElementById('kpiAvgTitle');    if (k2) k2.textContent = `Avg closure (business days, last ${n} days)`;
  const k3=document.getElementById('kpiOpenedTitle'); if (k3) k3.textContent = `Opened (last ${n} days)`;
}

async function run(){
  const projectId = 26426113;
  const n = getPeriodDays();
  setPeriodLabels(n);

  const now = new Date();
  const since = new Date(now); since.setDate(now.getDate()-n);

  let openAll = [], closedN = [], createdN = [];
  try{
    openAll  = await fetchIssues(projectId, 'state=opened');
    const dataClosed = await fetchIssues(projectId, `state=closed&updated_after=${encodeURIComponent(since.toISOString())}`);
    closedN = dataClosed.filter(i => i.closed_at && new Date(i.closed_at) >= since);
    createdN = await fetchIssues(projectId, `created_after=${encodeURIComponent(since.toISOString())}`);
  }catch(e){ console.error('Fetch error', e); }

  const avgCloseDays = closedN.length
    ? (closedN.reduce((acc,i)=> acc + Math.max(0, workingDays24hBetween(new Date(i.created_at), new Date(i.closed_at))), 0) / closedN.length).toFixed(1)
    : '—';
  document.getElementById('kpiOpen').textContent   = openAll.length;
  document.getElementById('kpiClosed').textContent = closedN.length;
  document.getElementById('kpiAvgClose').textContent = avgCloseDays;
  document.getElementById('kpiOpened').textContent = createdN.length;
  document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleString()}`;

  const labelsCreated = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const createMap = new Map(labelsCreated.map(l=>[l,0]));
  createdN.forEach(i=>{ const lab=new Date(i.created_at).toLocaleDateString(); if (createMap.has(lab)) createMap.set(lab, createMap.get(lab)+1); });
  renderLine(document.getElementById('chartOpened'), labelsCreated, [...createMap.values()]);

  const labelsClosed = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const closeMap = new Map(labelsClosed.map(l=>[l,0]));
  closedN.forEach(i=>{ const lab=new Date(i.closed_at).toLocaleDateString(); if (closeMap.has(lab)) closeMap.set(lab, closeMap.get(lab)+1); });
  renderLine(document.getElementById('chartClosed'), labelsClosed, [...closeMap.values()]);

  const wgCount = new Map(), prodCount = new Map();
  const addTo = (map, key) => map.set(key, (map.get(key)||0)+1);
  createdN.forEach(i=>{
    const {wg, product} = classifyLabels(i.labels||[]);
    wg.forEach(w => addTo(wgCount, w));
    product.forEach(p => addTo(prodCount, p));
  });
  const topEntries = (map, k=5)=> [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k);
  const listTo = (elId, arr) => {
    const el = document.getElementById(elId);
    el.innerHTML = arr.map(([k,v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('') || '<div style="opacity:.7">—</div>';
  };
  listTo('listWg',   topEntries(wgCount, 5));
  listTo('listProd', topEntries(prodCount, 5));

  const auth = new Map();
  createdN.forEach(i => { const name = (i.author && (i.author.name || i.author.username)) || '—'; auth.set(name, (auth.get(name)||0)+1); });
  listTo('listAuthors', topEntries(auth, 10));

  const weekdayOrder = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekdayCounts = new Array(7).fill(0);
  createdN.forEach(i=>{ const d = new Date(i.created_at).getDay(); weekdayCounts[d]++; });
  renderLine(document.getElementById('chartWeekday'), weekdayOrder, weekdayCounts);

  const unionMap = new Map(); [...createdN, ...closedN].forEach(i => unionMap.set(i.id, i)); const union = [...unionMap.values()];
  const mostCommented = [...union].sort((a,b)=> (b.user_notes_count||0) - (a.user_notes_count||0)).slice(0,5);
  const mostUpvotes   = [...union].sort((a,b)=> (b.upvotes||0) - (a.upvotes||0)).slice(0,5);
  const link = (i) => `<a href="${i.web_url}" target="_blank" style="color:var(--accent)">#${i.iid}</a>`;
  const name = (i) => (i.author && (i.author.name || i.author.username)) || '—';
  document.getElementById('listComments').innerHTML = mostCommented.length ? mostCommented.map(i=> `<li>${name(i)} — ${link(i)} — ${i.user_notes_count||0} comments</li>`).join('') : '<div style="opacity:.7">—</div>';
  document.getElementById('listUpvotes').innerHTML  = mostUpvotes.length   ? mostUpvotes.map(i=> `<li>${name(i)} — ${link(i)} — ${i.upvotes||0} 👍</li>`).join('') : '<div style="opacity:.7">—</div>';
}

function getTheme(){ return localStorage.getItem('theme') || 'dark'; }
function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function getLang(){ return localStorage.getItem('lang') || 'en'; }
function setLang(l){ localStorage.setItem('lang', l); }

document.addEventListener('DOMContentLoaded', ()=>{
  setTheme(getTheme());
  const sel = document.getElementById('periodSelect');
  if (sel) sel.addEventListener('change', run);
  document.getElementById('themeToggleDash')?.addEventListener('click', ()=> setTheme(getTheme()==='dark'?'light':'dark'));
  document.getElementById('langToggleDash')?.addEventListener('click', ()=> setLang(getLang()==='pt'?'en':'pt'));
  run();
});
