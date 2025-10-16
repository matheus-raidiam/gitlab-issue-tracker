/* Dashboard logic — layout-preserving (no HTML/CSS changes) */

/* ======= Theme / Lang ======= */
function getTheme(){ return localStorage.getItem('theme') || 'dark'; }
function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function getLang(){ return localStorage.getItem('lang') || 'en'; }
function setLang(l){ localStorage.setItem('lang', l); applyI18n(); setPeriodLabels(getPeriodDays()); try{ run(); }catch(e){} }

/* ======= i18n texts (no data-i18n attributes required) ======= */
const I18N = {
  en: {
    kpiOpened: "Opened (last {n} days)",
    kpiClosed: "Closed (last {n} days)",
    kpiAvg: "Avg closure (business days, last {n} days)",
    createdPerDay: "Created per day",
    closedPerDay: "Closed per day",
    byWeekday: "By weekday",
    topAuthors: "Top authors",
    byWg: "By WG",
    byProduct: "By product",
    topCommented: "Top 5 most commented",
    topUpvoted: "Top 5 most 👍",
    period: "(last {n} days)",
    updated: "Updated ",
    comments: "comments",
  },
  pt: {
    kpiOpened: "Abertas (últimos {n} dias)",
    kpiClosed: "Fechadas (últimos {n} dias)",
    kpiAvg: "Média de fechamento (dias úteis, últimos {n} dias)",
    createdPerDay: "Criadas por dia",
    closedPerDay: "Fechadas por dia",
    byWeekday: "Por dia da semana",
    topAuthors: "Top autores",
    byWg: "Por GT",
    byProduct: "Por produto",
    topCommented: "Top 5 mais comentadas",
    topUpvoted: "Top 5 mais 👍",
    period: "(últimos {n} dias)",
    updated: "Atualizado ",
    comments: "comentários",
  }
};
function t(k){ const lang=getLang(); return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }

function applyI18n(){
  const n = getPeriodDays();
  const setText = (id, key) => { const el=document.getElementById(id); if (el) el.textContent = t(key).replace('{n}', n); };
  const setSmall = (id) => { const el=document.getElementById(id); if (el) el.textContent = t('period').replace('{n}', n); };

  setText('kpiOpenedTitle','kpiOpened');
  setText('kpiClosedTitle','kpiClosed');
  setText('kpiAvgTitle','kpiAvg');

  const mapTitles = [
    ['titleCreated','createdPerDay'],
    ['titleClosed','closedPerDay'],
    ['titleWeekday','byWeekday'],
    ['titleAuthors','topAuthors'],
    ['titleWg','byWg'],
    ['titleProd','byProduct'],
    ['titleComments','topCommented'],
    ['titleUpvotes','topUpvoted'],
  ];
  mapTitles.forEach(([id,key])=>{ const el=document.getElementById(id); if (el) el.textContent = t(key); });

  ['periodCreated','periodClosed','periodWg','periodProd','periodAuthors','periodWeekday','periodComments','periodUpvotes']
    .forEach(setSmall);
}

/* ======= Charts (SVG, tooltip on hover) ======= */
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

  // Tooltip div (uses .chart-tooltip class from your CSS if exists; otherwise fallback inline)
  let tip = el.querySelector('.chart-tooltip');
  if (!tip){
    tip = document.createElement('div'); tip.className = 'chart-tooltip'; tip.style.display='none';
    tip.style.position='absolute'; tip.style.pointerEvents='none'; tip.style.transform='translate(-50%,-120%)';
    el.appendChild(tip);
  }
  const svg = el.querySelector('svg');
  const marker = svg.querySelector('#marker');
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
  function hide(){ marker.style.display='none'; tip.style.display='none'; }
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
  const set = (id, text) => { const el=document.getElementById(id); if (el) el.textContent = text; };
  set('periodCreated', t('period').replace('{n}', n));
  set('periodClosed',  t('period').replace('{n}', n));
  set('periodWg',      t('period').replace('{n}', n));
  set('periodProd',    t('period').replace('{n}', n));
  set('periodAuthors', t('period').replace('{n}', n));
  set('periodWeekday', t('period').replace('{n}', n));
  set('periodComments',t('period').replace('{n}', n));
  set('periodUpvotes', t('period').replace('{n}', n));
}

function weekdayLabels(){
  return (getLang()==='pt') ? ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
}

async function run(){
  const projectId = 26426113;
  const n = getPeriodDays();
  applyI18n();
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

  // KPIs
  const avgCloseDays = closedN.length
    ? (closedN.reduce((acc,i)=> acc + Math.max(0, workingDays24hBetween(new Date(i.created_at), new Date(i.closed_at))), 0) / closedN.length).toFixed(1)
    : '—';
  const setTxt = (id, v)=>{ const el=document.getElementById(id); if (el) el.textContent = v; };
  setTxt('kpiOpen', openAll.length);
  setTxt('kpiClosed', closedN.length);
  setTxt('kpiAvgClose', avgCloseDays);
  setTxt('kpiOpened', createdN.length);
  setTxt('lastUpdated', (getLang()==='pt' ? t('updated') : t('updated')) + new Date().toLocaleString());

  // Trends (created / closed per day)
  const labelsCreated = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const createMap = new Map(labelsCreated.map(l=>[l,0]));
  createdN.forEach(i=>{ const lab=new Date(i.created_at).toLocaleDateString(); if (createMap.has(lab)) createMap.set(lab, createMap.get(lab)+1); });
  renderLine(document.getElementById('chartOpened'), labelsCreated, [...createMap.values()]);

  const labelsClosed = Array.from({length:n}, (_,k)=>{ const d=new Date(now); d.setDate(now.getDate()-(n-1-k)); return d.toLocaleDateString(); });
  const closeMap = new Map(labelsClosed.map(l=>[l,0]));
  closedN.forEach(i=>{ const lab=new Date(i.closed_at).toLocaleDateString(); if (closeMap.has(lab)) closeMap.set(lab, closeMap.get(lab)+1); });
  renderLine(document.getElementById('chartClosed'), labelsClosed, [...closeMap.values()]);

  // Weekday distribution
  const weekdayOrder = weekdayLabels();
  const weekdayCounts = new Array(7).fill(0);
  createdN.forEach(i=>{ const d = new Date(i.created_at).getDay(); weekdayCounts[d]++; });
  renderLine(document.getElementById('chartWeekday'), weekdayOrder, weekdayCounts);

  // Distributions & Top
  const wgCount = new Map(), prodCount = new Map();
  const addTo = (map, key) => map.set(key, (map.get(key)||0)+1);
  createdN.forEach(i=>{
    const labels = i.labels || [];
    // Very light classifier: keep your existing product/WG grouping if IDs exist
    labels.forEach(lb=>{
      const base = String(lb).split('::')[0].trim();
      if (/^GT/i.test(base) || /Squad/i.test(base)) addTo(wgCount, base);
      else addTo(prodCount, base);
    });
  });
  const topEntries = (map, k=5)=> [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k);
  const listTo = (elId, arr) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = arr.map(([k,v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('') || '<div style="opacity:.7">—</div>';
  };
  listTo('listWg',   topEntries(wgCount, 5));
  listTo('listProd', topEntries(prodCount, 5));

  // Top Authors (created in last N days)
  const auth = new Map();
  createdN.forEach(i => { const name = (i.author && (i.author.name || i.author.username)) || '—'; auth.set(name, (auth.get(name)||0)+1); });
  listTo('listAuthors', topEntries(auth, 10));

  // Top 5 commented / upvoted (union to increase sample) — no author names
  const unionMap = new Map(); [...createdN, ...closedN].forEach(i => unionMap.set(i.id, i)); const union = [...unionMap.values()];
  const mostCommented = [...union].sort((a,b)=> (b.user_notes_count||0) - (a.user_notes_count||0)).slice(0,5);
  const mostUpvotes   = [...union].sort((a,b)=> (b.upvotes||0) - (a.upvotes||0)).slice(0,5);
  const link = (i) => `<a href="${i.web_url}" target="_blank" style="color:var(--accent)">#${i.iid}</a>`;

  document.getElementById('listComments') && (document.getElementById('listComments').innerHTML =
    mostCommented.length ? mostCommented.map(i=> `<li>${link(i)} — ${i.user_notes_count||0} ${t('comments')}</li>`).join('')
                         : '<div style="opacity:.7">—</div>');

  document.getElementById('listUpvotes') && (document.getElementById('listUpvotes').innerHTML =
    mostUpvotes.length ? mostUpvotes.map(i=> `<li>${link(i)} — ${i.upvotes||0} 👍</li>`).join('')
                       : '<div style="opacity:.7">—</div>');
}

/* ======= Working days (business) ======= */
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
  // Optional toggles (if exist in your layout)
  const themeBtn = document.getElementById('themeToggleDash');
  if (themeBtn) themeBtn.addEventListener('click', ()=> setTheme(getTheme()==='dark'?'light':'dark'));
  const langBtn  = document.getElementById('langToggleDash');
  if (langBtn)  langBtn.addEventListener('click', ()=> setLang(getLang()==='pt'?'en':'pt'));
  run();
});
