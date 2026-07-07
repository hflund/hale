import { getAllSessions, getAllSets, getAllExercises, getAllBlocks } from '../data/db.js';
import { dateKey } from '../data/db.js';
import { renderSparkline, renderFullChart } from './Charts.js';

export async function mountProgress(container) {
  container.innerHTML = '';

  const db = container._db;
  if (!db) return;

  const [sessions, sets, exercises, blocks] = await Promise.all([
    getAllSessions(db),
    getAllSets(db),
    getAllExercises(db),
    getAllBlocks(db),
  ]);

  const wrap = document.createElement('div');
  wrap.className = 'page-content';

  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No sessions yet. Log your first to start tracking progress.';
    wrap.appendChild(empty);
    container.appendChild(wrap);
    return;
  }

  // Pre-compute: sets by exercise for the last 365 days
  const oneYearAgo = Date.now() - 365 * 86400000;
  const recentSessionIds = new Set(sessions.filter(s => s.sessionStart >= oneYearAgo && s.sessionEnd).map(s => s.id));

  // Best value per exercise per date
  const bestByExDate = {}; // exerciseId → { dateKey → maxValue }
  for (const s of sets) {
    if (!recentSessionIds.has(s.sessionId) || !s.completed) continue;
    const sess = sessions.find(se => se.id === s.sessionId);
    if (!sess) continue;
    const dk = dateKey(sess.sessionStart);
    if (!bestByExDate[s.exerciseId]) bestByExDate[s.exerciseId] = {};
    const current = bestByExDate[s.exerciseId][dk] ?? -Infinity;
    if (s.value > current) bestByExDate[s.exerciseId][dk] = s.value;
  }

  // Sorted by date for each exercise
  const chartDataByEx = {};
  for (const [exId, byDate] of Object.entries(bestByExDate)) {
    chartDataByEx[exId] = Object.entries(byDate)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Expanded rows state
  const expanded = new Set();

  const activeBlocks = blocks.filter(b => b.isActive).sort((a, b) => a.order - b.order);

  const stack = document.createElement('div');
  stack.className = 'section-stack';

  for (const block of activeBlocks) {
    const blockExercises = exercises
      .filter(e => e.blockId === block.id && e.isActive)
      .sort((a, b) => a.order - b.order);

    const hasData = blockExercises.some(e => chartDataByEx[e.id]?.length > 0);
    if (!hasData) continue;

    const blockLabel = document.createElement('div');
    blockLabel.className = 'section-label';
    blockLabel.textContent = block.name;
    stack.appendChild(blockLabel);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '0';

    for (const ex of blockExercises) {
      const data = chartDataByEx[ex.id] || [];
      if (!data.length) continue;

      const exWrap = document.createElement('div');

      const row = document.createElement('div');
      row.className = 'accordion-row';
      row.style.padding = 'var(--space-4) var(--space-5)';

      // Sparkline
      const sparkWrap = document.createElement('div');
      sparkWrap.style.cssText = 'width:64px;height:32px;flex-shrink:0;';
      renderSparkline(sparkWrap, data);

      // Delta
      const delta = calcDelta(data);
      const isPositive = delta.pct >= 0;
      const deltaColor = isPositive ? 'var(--color-accent)' : 'var(--color-ink-muted)';
      const deltaIcon = isPositive ? 'trending-up' : 'trending-down';
      const firstDate = new Date(data[0].date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;';
      right.innerHTML = `
        <div style="display:flex;align-items:center;gap:3px;font-size:var(--text-small);font-weight:var(--weight-semibold);color:${deltaColor};">
          <svg data-lucide="${deltaIcon}" width="12" height="12" stroke-width="2"></svg>
          ${delta.pct >= 0 ? '+' : ''}${delta.pct.toFixed(1)}%
        </div>
        <div style="font-size:var(--text-caption);color:var(--color-ink-muted);">since ${firstDate}</div>
      `;

      row.innerHTML = `<div style="flex:1;font-size:var(--text-h3);font-weight:var(--weight-semibold);">${ex.name}</div>`;
      row.appendChild(sparkWrap);
      row.appendChild(right);

      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        if (expanded.has(ex.id)) {
          expanded.delete(ex.id);
          const detail = exWrap.querySelector('.accordion-expanded');
          if (detail) detail.remove();
        } else {
          expanded.add(ex.id);
          const pbIndices = calcPBIndices(data);
          const detail = renderExpandedChart(ex, data, pbIndices);
          exWrap.appendChild(detail);
          requestAnimationFrame(() => {
            const chartEl = detail.querySelector('.chart-container');
            if (chartEl) renderFullChart(chartEl, data, pbIndices);
          });
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [detail] });
        }
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
      });

      exWrap.appendChild(row);
      card.appendChild(exWrap);
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
    }

    stack.appendChild(card);
  }

  if (!stack.children.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Log some sessions to see your progress here.';
    wrap.appendChild(empty);
  } else {
    wrap.appendChild(stack);
  }

  container.appendChild(wrap);
}

function renderExpandedChart(ex, data, pbIndices) {
  const el = document.createElement('div');
  el.className = 'accordion-expanded';
  el.style.padding = 'var(--space-4) var(--space-5)';

  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-container';
  chartContainer.style.width = '100%';
  el.appendChild(chartContainer);

  const first = data[0];
  const last = data[data.length - 1];
  const diff = last.value - first.value;
  const pct = first.value !== 0 ? (diff / first.value) * 100 : 0;
  const sinceDate = new Date(first.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const unit = trackingUnit(ex.trackingType);
  const statsRow = document.createElement('div');
  statsRow.className = 'stats-row';
  statsRow.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">First</span>
      <span class="stat-value">${first.value}${unit}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Latest</span>
      <span class="stat-value">${last.value}${unit}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label" style="color:${diff >= 0 ? 'var(--color-accent)' : 'var(--color-ink-muted)'};">
        ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${unit} (${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%)
      </span>
      <span class="stat-value" style="font-size:var(--text-small);color:var(--color-ink-muted);font-weight:var(--weight-regular);">since ${sinceDate}</span>
    </div>
  `;

  if (pbIndices && pbIndices.size) {
    const lastPBIdx = Math.max(...pbIndices);
    const pbPoint = data[lastPBIdx];
    const pbItem = document.createElement('div');
    pbItem.className = 'stat-item';
    pbItem.innerHTML = `
      <span class="stat-label" style="display:flex;align-items:center;gap:3px;color:var(--color-accent-dim);">
        <svg data-lucide="award" width="12" height="12" stroke-width="2"></svg> PB
      </span>
      <span class="stat-value">${pbPoint.value}${unit} <span style="font-size:var(--text-small);color:var(--color-ink-muted);font-weight:var(--weight-regular);">${formatRelativeTime(pbPoint.date)}</span></span>
    `;
    statsRow.appendChild(pbItem);
  }

  el.appendChild(statsRow);

  return el;
}

function calcDelta(data) {
  if (data.length < 2) return { pct: 0, abs: 0 };
  const first = data[0].value;
  const last = data[data.length - 1].value;
  const abs = last - first;
  const pct = first !== 0 ? (abs / first) * 100 : 0;
  return { abs, pct };
}

function calcPBIndices(data) {
  const indices = new Set();
  let runningMax = -Infinity;
  data.forEach((d, i) => {
    if (d.value > runningMax) {
      runningMax = d.value;
      indices.add(i);
    }
  });
  return indices;
}

function formatRelativeTime(dateKeyStr) {
  const days = Math.floor((Date.now() - new Date(dateKeyStr).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function trackingUnit(type) {
  if (type === 'kg' || type === 'bodyweight_kg') return 'kg';
  if (type === 'reps') return '';
  if (type === 'time') return 's';
  if (type === 'bodyweight') return '';
  return 'kg';
}
