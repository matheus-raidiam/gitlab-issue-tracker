/* Dashboard logic with selectable period (default 30 days) */

/* ======= Label taxonomy (keep in sync with script.js) ======= */
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

/* ======= Theme / Lang ======= */
function getTheme(){ return localStorage.getItem('theme') || 'dark'; }
function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function getLang(){ return localStorage.getItem('lang') || 'en'; }
function setLang(l){ localStorage.setItem('lang', l); applyI18n(); setPeriodLabels(getPeriodDays()); }

const I18N = {
  en: {
    backToIssues: "Back to issues",
    activity: "Activity",
    breakdown: "Breakdown",
    dashTitle: "Open Finance Brasil — Dashboard",
    period: "Period",
    days: "days",
    openNow: "Open now",
    createdPerDay: "Created per day",
    closedPerDay: "Closed per day",
    byWeekday: "By weekday",
    topAuthors: "Top authors",
    byWg: "By WG",
    byProduct: "By product",
    topCommented: "Top 5 most commented",
    topUpvoted: "Top 5 most 👍",
    kpiOpened: "Opened (last {n} days)",
    kpiClosed: "Closed (last {n} days)",
    kpiAvg: "Avg closure (business days, last {n} days)",
    periodLabel: "(last {n} days)",
  },
  pt: {
    backToIssues: "Voltar para Issues",
    activity: "Atividade",
    breakdown: "Detalhamento",
    dashTitle: "Open Finance Brasil — Painel",
    period: "Período",
    days: "dias",
    openNow: "Abertas agora",
    createdPerDay: "Criadas por dia",
    closedPerDay: "Fechadas por dia",
    byWeekday: "Por dia da semana",
    topAuthors: "Top autores",
    byWg: "Por GT",
    byProduct: "Por produto",
    topCommented: "Top 5 mais comentadas",
    topUpvoted: "Top 5 mais 👍",
    kpiOpened: "Abertas (últimos {n} dias)",
    kpiClosed: "Fechadas (últimos {n} dias)",
    kpiAvg: "Média de fechamento (últimos {n} dias)",
    periodLabel: "(últimos {n} dias)",
  }
};
function t(k){
  const lang = getLang();
  return (I18N[lang] && I18N[lang][k]) || (I18N.en[k] || k);
}
function applyI18n(){
  const lang = getLang();
  document.documentElement.setAttribute('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  
  localizePeriodSelect();
});
}

/* ======= Charts (line with tooltips) ======= */
function renderLine(el, labels, values){
  const W = el.clientWidth || 600, H = el.clientHeight || 180;
  const pad = {l:28, r:8, t:8, b:24};
  const maxY = Math.max(1, ...values);
  const scaleX = (W - pad.l - pad.r) / Math.max(1, (labels.length - 1));
  const xs = (i)=> pad.l + i * scaleX;
  const ys = (v)=> pad.t + (H-pad.t-pad.b) * (1 - (v/maxY));
  const points = values.map((v,i)=> `${xs(i)},${ys(v)}`).join(' ');

  const step = Math.ceil(labels.length/6) || 1;
  const xTicks = labels.map((lab,i)=> (i%step===0||i===labels.length-1) ?
    `<text x="${xs(i)}" y="${H-6}" font-size="10" text-anchor="middle" fill="var(--text)">${lab}</text>` : ""
  ).join("");

  let yTicks = ""; const ticks = 4;
  for(let t=0;t<=ticks;t++){
    const val = Math.round(maxY * t / ticks);
    const y = ys(val);
    yTicks += `<text x="2" y="${y+4}" font-size="10" fill="var(--text)">${val}</text>`;
    yTicks += `<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="rgba(255,255,255,.08)"/>`;
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none">
    <polyline fill="none" stroke="#00e38c" stroke-width="2" points="${points}" />
    <g id="marker" style="display:none">
      <circle r="3" fill="#00e38c" stroke="var(--bg)" stroke-width="1"></circle>
    </g>
    <rect id="hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"></rect>
    ${yTicks}
    ${xTicks}
  </svg>`;
  // Tooltip div
  let tip = el.querySelector('.chart-tooltip');
  if (!tip){
    tip = document.createElement('div'); tip.className = 'chart-tooltip'; tip.style.display='none';
    el.appendChild(tip);
  }
  const svg = el.querySelector('svg');
  const marker = svg.querySelector('#marker');
  const circle = marker.querySelector('circle');
  const hit = svg.querySelector('#hit');

  function showAtIdx(i){
    const x = xs(i), y = ys(values[i]);
    marker.setAttribute('transform', `translate(${x},${y})`);
    marker.style.display = 'block';
    tip.style.left = x+'px';
    tip.style.top = y+'px';
    tip.textContent = `${labels[i]} — ${values[i]}`;
    tip.style.display = 'block';
  }
  function hide(){
    marker.style.display='none';
    tip.style.display='none';
  }
  hit.addEventListener('mousemove', (ev)=>{
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    let idx = Math.round((x - pad.l) / scaleX);
    if (idx < 0) idx = 0;
    if (idx > labels.length-1) idx = labels.length-1;
    showAtIdx(idx);
  });
  hit.addEventListener('mouseleave', hide);
}

/* ======= Data ======= */
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
  const lang = getLang();
  const lbl = (lang==='pt') ? `(últimos ${n} dias)` : `(last ${n} days)`;
  ['periodCreated','periodClosed','periodWg','periodProd','periodAuthors','periodWeekday','periodComments','periodUpvotes']
    .forEach(id => { const el=document.getElementById(id); if (el) el.textContent = lbl; });
  const k1=document.getElementById('kpiClosedTitle'); if (k1) k1.textContent = t('kpiClosed').replace('{n}', n);
  const k2=document.getElementById('kpiAvgTitle');    if (k2) k2.textContent = t('kpiAvg').replace('{n}', n);
  const k3=document.getElementById('kpiOpenedTitle'); if (k3) k3.textContent = t('kpiOpened').replace('{n}', n);
}

async function run(){
  const projectId = 26426113;
  const n = getPeriodDays();
  setPeriodLabels(n);
  applyI18n();

  const now = new Date();
  const since = new Date(now); since.setDate(now.getDate()-n);

  let openAll = [], closedN = [], createdN = [];
  try{
    openAll  = await fetchIssues(projectId, 'state=opened');
    const dataClosed = await fetchIssues(projectId, `state=closed&updated_after=${encodeURIComponent(since.toISOString())}`);
    closedN = dataClosed.filter(i => i.closed_at && new Date(i.closed_at) >= since);
    createdN = await fetchIssues(projectId, `created_after=${encodeURIComponent(since.toISOString())}`);
  }catch(e){ console.error('Fetch error', e); }

  // KPIs
  const avgCloseDays = closedN.length
    ? (closedN.reduce((acc,i)=> acc + Math.max(0, workingDays24hBetween(new Date(i.created_at), new Date(i.closed_at))), 0) / closedN.length).toFixed(1)
    : '—';
  document.getElementById('kpiOpen').textContent   = openAll.length;
  document.getElementById('kpiClosed').textContent = closedN.length;
  document.getElementById('kpiAvgClose').textContent = avgCloseDays;
  document.getElementById('kpiOpened').textContent = createdN.length;
  document.getElementById('lastUpdated').textContent = (getLang()==='pt'?'Atualizado ':'Updated ') + new Date().toLocaleString();

  // Trends
  const labelsCreated = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const createMap = new Map(labelsCreated.map(l=>[l,0]));
  createdN.forEach(i=>{ const lab=new Date(i.created_at).toLocaleDateString(); if (createMap.has(lab)) createMap.set(lab, createMap.get(lab)+1); });
  renderLine(document.getElementById('chartOpened'), labelsCreated, [...createMap.values()]);

  const labelsClosed = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const closeMap = new Map(labelsClosed.map(l=>[l,0]));
  closedN.forEach(i=>{ const lab=new Date(i.closed_at).toLocaleDateString(); if (closeMap.has(lab)) closeMap.set(lab, closeMap.get(lab)+1); });
  renderLine(document.getElementById('chartClosed'), labelsClosed, [...closeMap.values()]);

  // Weekday distribution
  const weekdayOrder = (getLang()==='pt') ? ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekdayCounts = new Array(7).fill(0);
  createdN.forEach(i=>{ const d = new Date(i.created_at).getDay(); weekdayCounts[d]++; });
  renderLine(document.getElementById('chartWeekday'), weekdayOrder, weekdayCounts);

  // Distributions & Top
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

  // Top Authors (created in last N days)
  const auth = new Map();
  createdN.forEach(i => { const name = (i.author && (i.author.name || i.author.username)) || '—'; auth.set(name, (auth.get(name)||0)+1); });
  listTo('listAuthors', topEntries(auth, 10));

  // Top 5 commented / upvoted (union to increase sample)
  const unionMap = new Map(); [...createdN, ...closedN].forEach(i => unionMap.set(i.id, i)); const union = [...unionMap.values()];
  const mostCommented = [...union].sort((a,b)=> (b.user_notes_count||0) - (a.user_notes_count||0)).slice(0,5);
  const mostUpvotes   = [...union].sort((a,b)=> (b.upvotes||0) - (a.upvotes||0)).slice(0,5);
  const link = (i) => `<a href="${i.web_url}" target="_blank" style="color:var(--accent)">#${i.iid}</a>`;

  // (2) no author names here, just issue link + counts
  document.getElementById('listComments').innerHTML = mostCommented.length
    ? mostCommented.map(i=> `<li>${link(i)} — ${i.user_notes_count||0} ${(getLang()==='pt'?'comentários':'comments')}</li>`).join('')
    : '<div style="opacity:.7">—</div>';

  document.getElementById('listUpvotes').innerHTML = mostUpvotes.length
    ? mostUpvotes.map(i=> `<li>${link(i)} — ${i.upvotes||0} 👍</li>`).join('')
    : '<div style="opacity:.7">—</div>';
}

/* ======= Working days ======= */
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

/* ======= Boot ======= */
document.addEventListener('DOMContentLoaded', ()=>{
  setTheme(getTheme());
  applyI18n();
  const sel = document.getElementById('periodSelect');
  if (sel) sel.addEventListener('change', run);
  document.getElementById('themeToggleDash')?.addEventListener('click', ()=> setTheme(getTheme()==='dark'?'light':'dark'));
  document.getElementById('langToggleDash')?.addEventListener('click', ()=> { setLang(getLang()==='pt'?'en':'pt'); run(); });
  run();
});


function localizePeriodSelect(){
  const sel = document.getElementById('periodSelect');
  if (!sel) return;
  const lang = getLang();
  for (const opt of sel.options){
    const n = parseInt(opt.value,10);
    if (!isNaN(n)) opt.textContent = (lang==='pt') ? `Últimos ${n} dias` : `Last ${n} days`;
  }
}
