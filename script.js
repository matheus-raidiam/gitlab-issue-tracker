/* ================= CONFIG ================= */
// SLA rules text injected into footer (easy to update here)
const SLA_RULES_TEXT = "SLA rules: Bug & Questions = 10 working days; Under Evaluation or no Nature = 3 working days; Under WG Evaluation or Waiting Participant = SLA Paused; Others = No SLA.";

/* ================= STATE ================= */
const issues = { finance: [], insurance: [] };
const tableSort = {
  'finance-table': { key: 'daysOpen', asc: false },
  'insurance-table': { key: 'daysOpen', asc: false }
};
const STATUS_LABELS = new Set([
  'Under Evaluation', 'Waiting Participant', 'Under WG Evaluation', 'Evaluated by WG'
]);
const NATURE_LABELS = new Set([
  'Questions', 'Bug', 'Change Request', 'Test Improvement', 'Breaking Change'
]);

const selected = { nature:new Set(), product:new Set(), status:new Set() };

/* ================= UTILITIES ================= */
function classifyLabels(labels = []) {
  const status = [], nature = [], product = [];
  labels.forEach(l => {
    if (STATUS_LABELS.has(l)) status.push(l);
    else if (NATURE_LABELS.has(l)) nature.push(l);
    else product.push(l);
  });
  return { status, nature, product };
}

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

// SLA mapping:
// - Bug -> 10 working days
// - Under Evaluation (status) OR no Nature -> 3 working days
// - Questions -> 10 working days
// - Else -> No SLA
function getSLAFor(labels) {
  const { status, nature } = classifyLabels(labels || []);
  const hasBug = nature.includes('Bug');
  const hasQuestions = nature.includes('Questions');
  const underEval = status.includes('Under Evaluation');
  const noNature = nature.length === 0;

  if (hasBug) return { days: 10, reason: 'Bug' };
  if (underEval || noNature) return { days: 3, reason: underEval ? 'Under Evaluation' : 'No Nature' };
  if (hasQuestions) return { days: 10, reason: 'Questions' };
  return { days: null, reason: 'No SLA' };
}

/* SLA text + sorting rank (includes "SLA Paused") */
function slaLabelAndRank(issue){
  const labels = issue.labels || [];
  const { status } = classifyLabels(labels);

  const paused = status.includes('Under WG Evaluation') || status.includes('Waiting Participant');
  if (paused) {
    // Over SLA = 3, Paused = 2, Within = 1, No SLA = 0
    return { text:'SLA Paused', class:'paused', rank:2 };
  }

  const slaDays = issue.sla.days;
  const hasSLA = Number.isInteger(slaDays);
  const over = hasSLA ? (issue.daysOpen > slaDays) : false;

  if (!hasSLA) return { text:'No SLA', class:'nosla', rank:0 };
  if (over)     return { text:'Over SLA', class:'over-sla', rank:3 };
  return { text:'Within SLA', class:'within-sla', rank:1 };
}

function setLoading(on){ document.getElementById('loading').style.display = on ? 'block' : 'none'; }
function saveComment(key, value){ localStorage.setItem(key, value); }
function clearAllComments(){
  document.querySelectorAll('.comment-box').forEach(a => { localStorage.removeItem(a.dataset.key); a.value = ''; });
}

/* ================= FILTER UI ================= */
function renderFilterMenus() {
  const natureSet = new Set(), productSet = new Set(), statusSet = new Set();
  [...issues.finance, ...issues.insurance].forEach(i => {
    const { status, nature, product } = classifyLabels(i.labels || []);
    status.forEach(l => statusSet.add(l));
    nature.forEach(l => natureSet.add(l));
    product.forEach(l => productSet.add(l));
  });

  const fill = (containerId, values, cat) => {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.row').forEach(r => r.remove());
    [...values].sort().forEach(tag => {
      const row = document.createElement('div');
      row.className = 'row';
      const id = `${cat}-${tag.replace(/[^a-z0-9-_]+/gi,'_')}`;
      row.innerHTML = `
        <input type="checkbox" id="${id}" ${selected[cat].has(tag) ? 'checked':''} />
        <label for="${id}">${tag}</label>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selected[cat].add(tag); else selected[cat].delete(tag);
        updateCounts(); renderChips(); renderIssues();
      });
      container.appendChild(row);
    });
  };

  fill('menu-nature', natureSet, 'nature');
  fill('menu-product', productSet, 'product');
  fill('menu-status', statusSet, 'status');

  updateCounts(); renderChips();
}

function updateCounts(){
  document.getElementById('count-nature').textContent = selected.nature.size;
  document.getElementById('count-product').textContent = selected.product.size;
  document.getElementById('count-status').textContent = selected.status.size;
}

function clearCategory(cat){
  selected[cat].clear();
  renderFilterMenus(); renderIssues();
}

function renderChips(){
  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  ['nature','product','status'].forEach(cat => {
    selected[cat].forEach(tag => {
      const el = document.createElement('span');
      el.className = 'chip';
      el.innerHTML = `${cat}: ${tag} <span class=\"x\" title=\"Remove\">✕</span>`;
      el.querySelector('.x').onclick = () => {
        selected[cat].delete(tag);
        renderFilterMenus(); renderIssues();
      };
      chips.appendChild(el);
    });
  });
}

function resetAllFilters(){
  selected.nature.clear(); selected.product.clear(); selected.status.clear();
  document.querySelectorAll('.filter details[open]').forEach(d => { d.open = false; });
  renderFilterMenus(); renderIssues();
}

/* Collapse filters when clicking outside */
document.addEventListener('click', (e) => {
  const insideFilter = e.target.closest('.filter');
  if (!insideFilter) {
    document.querySelectorAll('.filter details[open]').forEach(d => d.removeAttribute('open'));
  }
});

/* ================= SORTING ================= */
function changeSort(tableId, key){
  const s = tableSort[tableId];
  if (s.key === key) s.asc = !s.asc; else { s.key = key; s.asc = (key === 'title'); }
  updateSortArrows(tableId); renderIssues();
}

function updateSortArrows(tableId){
  const table = document.getElementById(tableId);
  table.querySelectorAll('.sort-arrow').forEach(el => el.textContent = '');
  const s = tableSort[tableId];
  const arrow = table.querySelector(`.sort-arrow[data-for=\"${s.key}\"]`);
  if (arrow) arrow.textContent = s.asc ? '▲' : '▼';
}

function getViewMode(){ return document.getElementById('viewMode').value; }

/* ================= DATA ================= */
async function loadAllIssues(){
  setLoading(true);
  issues.finance = []; issues.insurance = [];

  const mode = getViewMode();
  document.getElementById('finance-date-label').textContent = mode === 'closed7' ? 'Closed At' : 'Created At';
  document.getElementById('insurance-date-label').textContent = mode === 'closed7' ? 'Closed At' : 'Created At';

  await Promise.all([
    loadProjectIssues(26426113, 'finance'),  // Open Finance
    loadProjectIssues(32299006, 'insurance') // Open Insurance
  ]);

  renderFilterMenus();
  updateSortArrows('finance-table');
  updateSortArrows('insurance-table');
  renderIssues();
  setLoading(false);
}

async function loadProjectIssues(projectId, key){
  const mode = getViewMode();
  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  let url = `https://gitlab.com/api/v4/projects/${projectId}/issues`;
  if (mode === 'closed7') url += `?state=closed&updated_after=${since}`;
  else url += `?state=opened`;

  const res = await fetch(url);
  const data = await res.json();

  let list = data.map(issue => ({ ...issue, projectId }));
  if (mode === 'closed7') {
    const cutoff = new Date(since);
    list = list.filter(i => i.closed_at && new Date(i.closed_at) >= cutoff);
  }
  issues[key] = list;
}

/* ================= RENDER ================= */
function renderIssues(){
  const mode = getViewMode();
  document.querySelectorAll('tbody').forEach(tb => tb.innerHTML = '');

  const now = new Date();
  const decorate = (list) => list.map(i => {
    const created = new Date(i.created_at);
    const endDate = (mode === 'closed7' && i.closed_at) ? new Date(i.closed_at) : now;
    const daysOpen = workingDaysBetween(created, endDate);
    const sla = getSLAFor(i.labels || []);
    const base = { ...i, daysOpen, dateCol: (mode === 'closed7' && i.closed_at) ? i.closed_at : i.created_at, sla };
    const { text, rank, class:klass } = slaLabelAndRank(base);
    return { ...base, slaText: text, slaRank: rank, slaClass: klass };
  });

  renderTable('finance');
  renderTable('insurance');

  function renderTable(which){
    const tableId = which === 'finance' ? 'finance-table' : 'insurance-table';
    const summaryId = which === 'finance' ? 'finance-summary' : 'insurance-summary';
    const sort = tableSort[tableId];

    const base = decorate(issues[which]);

    const filtered = base.filter(i => {
      const { status, nature, product } = classifyLabels(i.labels || []);
      const matchNature  = selected.nature.size  ? nature.some(n => selected.nature.has(n))   : true;
      const matchProduct = selected.product.size ? product.some(p => selected.product.has(p)) : true;
      const matchStatus  = selected.status.size  ? status.some(s => selected.status.has(s))   : true;
      return matchNature && matchProduct && matchStatus;
    });

    const sorted = filtered.sort((a,b)=>{
      let va,vb;
      switch (sort.key){
        case 'iid': va=Number(a.iid); vb=Number(b.iid); break;
        case 'daysOpen': va=Number(a.daysOpen); vb=Number(b.daysOpen); break;
        case 'dateCol': va=new Date(a.dateCol).getTime(); vb=new Date(b.dateCol).getTime(); break;
        case 'slaRank': va=Number(a.slaRank); vb=Number(b.slaRank); break;
        case 'title': default: va=(a.title||'').toLowerCase(); vb=(b.title||'').toLowerCase();
      }
      if (va<vb) return sort.asc?-1:1;
      if (va>vb) return sort.asc?1:-1;
      return 0;
    });

    const tbody = document.querySelector(`#${tableId} tbody`);
    const counters = { total:0, slaApplicable:0, over:0 };

    sorted.forEach(issue=>{
      const dateShown = (mode === 'closed7' && issue.closed_at) ? new Date(issue.closed_at) : new Date(issue.created_at);
      const slaDays = issue.sla.days;
      const hasSLA = Number.isInteger(slaDays);
      const over = hasSLA ? (issue.daysOpen > slaDays) : false;

      const key = `comment-${issue.projectId}-${issue.iid}`;
      const saved = localStorage.getItem(key) || '';

      const { status, nature, product } = classifyLabels(issue.labels || []);
      const badges = (arr) => arr.length ? arr.map(l => `<span class=\"badge\">${l}</span>`).join(' ') : '<span style=\"opacity:.5;\">—</span>';

      const statusCell = `<span class=\"${issue.slaClass}\">${issue.slaText}</span>`;

      const tr = document.createElement('tr');
      tr.className = (mode === 'closed7') ? 'closed-issue' : '';
      tr.innerHTML = `
        <td><a href=\"${issue.web_url}\" target=\"_blank\" style=\"color:var(--accent);\">#${issue.iid}</a></td>
        <td>${issue.title}${mode === 'closed7' ? '<span class=\"closed-badge\">Closed</span>' : ''}</td>
        <td>${dateShown.toLocaleDateString()}</td>
        <td>${issue.daysOpen}</td>
        <td>${statusCell}</td>
        <td>${badges(nature)}</td>
        <td>${badges(product)}</td>
        <td>${badges(status)}</td>
        <td><textarea class=\"comment-box\" rows=\"2\" data-key=\"${key}\" oninput=\"saveComment('${key}', this.value)\">${saved}</textarea></td>
      `;
      tbody.appendChild(tr);

      counters.total++;
      if (hasSLA) { counters.slaApplicable++; if (over) counters.over++; }
    });

    document.getElementById(summaryId).textContent =
      (mode === 'closed7')
        ? `${counters.total} issues closed in last 7 days — SLA-applicable: ${counters.slaApplicable}, Over SLA: ${counters.over}`
        : `${counters.total} open issues — SLA-applicable: ${counters.slaApplicable}, Over SLA: ${counters.over}`;

    updateSortArrows(tableId);
  }
}

/* ================= INIT ================= */
// Inject footer SLA rules text
document.addEventListener('DOMContentLoaded', () => {
  const p = document.getElementById('sla-rules');
  if (p) p.textContent = SLA_RULES_TEXT;
  loadAllIssues();
});
