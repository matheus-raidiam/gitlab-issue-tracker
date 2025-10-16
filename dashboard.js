/* Dashboard logic (line charts, responsive) */

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

/* ======= Helpers ======= */
const DAY_MS = 24*60*60*1000;
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=startOfDay(d); x.setDate(x.getDate()+1); return x; }
function businessMsBetween(s,e){ const total=Math.max(0,e.getTime()-s.getTime()); return Math.max(0, total - weekendMsBetween(s,e)); }
function overlapMs(a1,a2,b1,b2){ const s=Math.max(a1.getTime(),b1.getTime()); const e=Math.min(a2.getTime(),b2.getTime()); return Math.max(0,e-s); }
function weekendMsBetween(s,e){
  if (e<=s) return 0; let ms=0, cur=startOfDay(s);
  while(cur<e){ const nxt=endOfDay(cur), wk=[0,6].includes(cur.getDay()); if (wk) ms+=overlapMs(s,e,cur,nxt); cur=nxt; }
  return ms;
}
function workingDays24hBetween(s,e){ return Math.floor(businessMsBetween(s,e)/DAY_MS); }
function ymd(d){ const x=new Date(d); return x.toISOString().slice(0,10); }
function lastNDays(n){ const arr=[]; const now=new Date(); for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); arr.push(ymd(d)); } return arr; }

/* ======= Rendering: line chart (SVG) ======= */
function renderLine(el, labels, values){
  const W = el.clientWidth || 600, H = el.clientHeight || 180;
  const pad = {l:28, r:8, t:8, b:22};
  const maxY = Math.max(1, ...values);
  const xs = (i)=> pad.l + (i*(W-pad.l-pad.r)/(labels.length-1 || 1));
  const ys = (v)=> pad.t + (H-pad.t-pad.b) * (1 - v/maxY);

  const points = values.map((v,i)=> `${xs(i)},${ys(v)}`).join(' ');
  const ticks = 4;
  let yTicks = '';
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

/* ======= Data fetch ======= */
async function fetchIssues(projectId, params){
  const url = `https://gitlab.com/api/v4/projects/${projectId}/issues?per_page=100&${params}`;
  const r = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ======= Main ======= */
(async function init(){
  const projectId = 26426113; // same project

  const now = new Date();
  const since14 = new Date(now); since14.setDate(now.getDate()-14);
  const since30 = new Date(now); since30.setDate(now.getDate()-30);
  const since7  = new Date(now); since7.setDate(now.getDate()-7);

  let opened = [], closed14 = [], closed30 = [];
  try{
    opened   = await fetchIssues(projectId, 'state=opened');
    const dataClosed14 = await fetchIssues(projectId, `state=closed&updated_after=${encodeURIComponent(since14.toISOString())}`);
    closed14 = dataClosed14.filter(i => i.closed_at && new Date(i.closed_at) >= since14);
    const dataClosed30 = await fetchIssues(projectId, `state=closed&updated_after=${encodeURIComponent(since30.toISOString())}`);
    closed30 = dataClosed30.filter(i => i.closed_at && new Date(i.closed_at) >= since30);
  }catch(e){
    console.error('Fetch error', e);
  }

  // all issues created in the last 30 days (open + closed)
  const all30 = [...opened, ...closed30].filter(i => new Date(i.created_at) >= since30);

  // KPIs
  const opened7 = all30.filter(i => new Date(i.created_at) >= since7);
  const avgCloseDays = (()=>{
    if (!closed14.length) return '—';
    const sum = closed14.reduce((acc,i)=> acc + Math.max(0, workingDays24hBetween(new Date(i.created_at), new Date(i.closed_at))), 0);
    return (sum/closed14.length).toFixed(1);
  })();
  document.getElementById('kpiOpen').textContent = opened.length;
  document.getElementById('kpiClosed14').textContent = closed14.length;
  document.getElementById('kpiAvgClose14').textContent = avgCloseDays;
  document.getElementById('kpiOpened7').textContent = opened7.length;
  document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleString()}`;

  // Trends — line charts
  const labelsOpen30 = (function(){ const arr=[]; for(let i=29;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); arr.push(d.toLocaleDateString()); } return arr; })();
  const labelsClosed14 = (function(){ const arr=[]; for(let i=13;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); arr.push(d.toLocaleDateString()); } return arr; })();

  const openByDateMap = new Map(labelsOpen30.map(l=>[l,0]));
  all30.forEach(i=>{
    const lab = new Date(i.created_at).toLocaleDateString();
    if (openByDateMap.has(lab)) openByDateMap.set(lab, openByDateMap.get(lab)+1);
  });
  renderLine(document.getElementById('chartOpened'), labelsOpen30, [...openByDateMap.values()]);

  const closeByDateMap = new Map(labelsClosed14.map(l=>[l,0]));
  closed14.forEach(i=>{
    const lab = new Date(i.closed_at).toLocaleDateString();
    if (closeByDateMap.has(lab)) closeByDateMap.set(lab, closeByDateMap.get(lab)+1);
  });
  renderLine(document.getElementById('chartClosed'), labelsClosed14, [...closeByDateMap.values()]);

  // Breakdown (last 30 days)
  const wgCount = new Map(), prodCount = new Map();
  const addTo = (map, key) => map.set(key, (map.get(key)||0)+1);
  all30.forEach(i=>{
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

  // Top Authors (created in last 30 days)
  const auth = new Map();
  all30.forEach(i => { const k = (i.author && (i.author.name || i.author.username)) || '—'; auth.set(k, (auth.get(k)||0)+1); });
  listTo('listAuthors', topEntries(auth, 10));

  // Weekday distribution (last 30 days; created_at)
  const weekdayOrder = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekdayCounts = new Array(7).fill(0);
  all30.forEach(i=>{ const d = new Date(i.created_at).getDay(); weekdayCounts[d]++; });
  renderLine(document.getElementById('chartWeekday'), weekdayOrder, weekdayCounts);

  // Top 5 commented / upvoted (last 30 days for consistency)
  const mostBase = all30.length ? all30 : [...opened, ...closed30]; // fallback
  const mostCommented = [...mostBase].sort((a,b)=> (b.user_notes_count||0) - (a.user_notes_count||0)).slice(0,5);
  const mostUpvotes   = [...mostBase].sort((a,b)=> (b.upvotes||0) - (a.upvotes||0)).slice(0,5);
  const link = (i) => `<a href="${i.web_url}" target="_blank" style="color:var(--accent)">#${i.iid}</a>`;
  document.getElementById('listComments').innerHTML = mostCommented.map(i=> `<li>${link(i)} — ${i.user_notes_count||0} comments</li>`).join('') || '<div style="opacity:.7">—</div>';
  document.getElementById('listUpvotes').innerHTML  = mostUpvotes.map(i=>   `<li>${link(i)} — ${i.upvotes||0} 👍</li>`).join('') || '<div style="opacity:.7">—</div>';
})();
