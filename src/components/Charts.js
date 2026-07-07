// Catmull-Rom spline → cubic Bézier path
function crPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;

  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${n(cp1x)} ${n(cp1y)} ${n(cp2x)} ${n(cp2y)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

function n(v) { return Math.round(v * 100) / 100; }

function mapPoints(data, w, h, pad) {
  if (!data.length) return [];
  const vals = data.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const xStep = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  return data.map((d, i) => [
    pad + i * xStep,
    pad + (1 - (d.value - minV) / range) * (h - pad * 2),
  ]);
}

function svgNS(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ── Sparkline ─────────────────────────────────────────────────────────────

export function renderSparkline(container, data) {
  container.innerHTML = '';
  const W = 64, H = 32, P = 2;
  const svg = svgNS('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, overflow: 'visible' });

  if (!data.length) {
    const line = svgNS('line', { x1: P, y1: H / 2, x2: W - P, y2: H / 2,
      stroke: 'var(--color-border)', 'stroke-width': 1.5 });
    svg.appendChild(line);
    container.appendChild(svg);
    return;
  }

  const pts = mapPoints(data, W, H, P);
  const path = crPath(pts);

  const gradId = `sg-${Math.random().toString(36).slice(2)}`;
  const defs = svgNS('defs');
  const grad = svgNS('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(svgNS('stop', { offset: '0%', 'stop-color': 'rgba(184,92,56,0.22)' }));
  grad.appendChild(svgNS('stop', { offset: '100%', 'stop-color': 'rgba(184,92,56,0)' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${path} L ${n(last[0])} ${H} L ${n(first[0])} ${H} Z`;
  svg.appendChild(svgNS('path', { d: areaPath, fill: `url(#${gradId})` }));
  svg.appendChild(svgNS('path', { d: path, fill: 'none', stroke: 'var(--color-accent)', 'stroke-width': 1.5 }));

  container.appendChild(svg);
}

// ── Full exercise chart ────────────────────────────────────────────────────

export function renderFullChart(container, data, pbIndices = new Set()) {
  container.innerHTML = '';
  const W = container.clientWidth || 300;
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 28, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const svg = svgNS('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  if (!data.length) {
    container.appendChild(svg);
    return;
  }

  const vals = data.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const xScale = i => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const yScale = v => PAD.top + (1 - (v - minV) / range) * innerH;

  const pts = data.map((d, i) => [xScale(i), yScale(d.value)]);

  // Horizontal gridlines (max 4)
  const gridCount = Math.min(4, Math.ceil(range / 5));
  for (let g = 0; g <= gridCount; g++) {
    const y = PAD.top + (g / gridCount) * innerH;
    svg.appendChild(svgNS('line', {
      x1: PAD.left, y1: n(y), x2: W - PAD.right, y2: n(y),
      stroke: 'var(--color-border-sub)', 'stroke-width': 1,
    }));
    const labelVal = maxV - (g / gridCount) * range;
    const label = svgNS('text', {
      x: PAD.left - 6, y: n(y + 4),
      'text-anchor': 'end',
      'font-family': 'Manrope, sans-serif',
      'font-size': '10',
      'font-weight': '500',
      fill: 'var(--color-ink-muted)',
    });
    label.textContent = Math.round(labelVal);
    svg.appendChild(label);
  }

  // X-axis labels (sparse — every N weeks)
  const labelInterval = Math.max(1, Math.ceil(data.length / 6));
  for (let i = 0; i < data.length; i += labelInterval) {
    const d = data[i];
    const x = xScale(i);
    const date = new Date(d.date);
    const text = svgNS('text', {
      x: n(x), y: H - 4,
      'text-anchor': 'middle',
      'font-family': 'Manrope, sans-serif',
      'font-size': '10',
      'font-weight': '500',
      fill: 'var(--color-ink-muted)',
    });
    text.textContent = date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    svg.appendChild(text);
  }

  // Gradient defs
  const gradId = `fc-${Math.random().toString(36).slice(2)}`;
  const defs = svgNS('defs');
  const grad = svgNS('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(svgNS('stop', { offset: '0%', 'stop-color': 'rgba(184,92,56,0.22)' }));
  grad.appendChild(svgNS('stop', { offset: '100%', 'stop-color': 'rgba(184,92,56,0)' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Area + line
  const path = crPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const bottomY = PAD.top + innerH;
  const areaPath = `${path} L ${n(last[0])} ${n(bottomY)} L ${n(first[0])} ${n(bottomY)} Z`;
  svg.appendChild(svgNS('path', { d: areaPath, fill: `url(#${gradId})` }));
  svg.appendChild(svgNS('path', { d: path, fill: 'none', stroke: 'var(--color-accent)', 'stroke-width': 2.5 }));

  // Data point dots
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const isPB = pbIndices.has(i);
    svg.appendChild(svgNS('circle', {
      cx: n(pt[0]), cy: n(pt[1]), r: isPB ? 5 : 4,
      fill: isPB ? 'var(--color-accent-dim)' : 'var(--color-accent)',
      stroke: 'var(--color-surface)',
      'stroke-width': 1.5,
    }));

    if (isPB) {
      // Small 4-point sparkle above the PB dot
      const cx = pt[0], cy = pt[1] - 12;
      const s = 4;
      svg.appendChild(svgNS('path', {
        d: `M ${n(cx)} ${n(cy - s)} L ${n(cx + s * 0.35)} ${n(cy - s * 0.35)} L ${n(cx + s)} ${n(cy)} L ${n(cx + s * 0.35)} ${n(cy + s * 0.35)} L ${n(cx)} ${n(cy + s)} L ${n(cx - s * 0.35)} ${n(cy + s * 0.35)} L ${n(cx - s)} ${n(cy)} L ${n(cx - s * 0.35)} ${n(cy - s * 0.35)} Z`,
        fill: 'var(--color-accent-dim)',
      }));
    }
  }

  container.appendChild(svg);
}

// ── Volume line chart (Dashboard, 8 weeks) ────────────────────────────────

export function renderVolumeChart(container, data) {
  container.innerHTML = '';
  if (!data.length) return;

  const W = container.clientWidth || 300;
  const H = 80;
  const P = 4;

  const svg = svgNS('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  const vals = data.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const xStep = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => [P + i * xStep, P + (1 - (d.value - minV) / range) * (H - P * 2)]);

  const gradId = `vc-${Math.random().toString(36).slice(2)}`;
  const defs = svgNS('defs');
  const grad = svgNS('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(svgNS('stop', { offset: '0%', 'stop-color': 'rgba(184,92,56,0.22)' }));
  grad.appendChild(svgNS('stop', { offset: '100%', 'stop-color': 'rgba(184,92,56,0)' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  const path = crPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${path} L ${n(last[0])} ${H} L ${n(first[0])} ${H} Z`;
  svg.appendChild(svgNS('path', { d: areaPath, fill: `url(#${gradId})` }));
  svg.appendChild(svgNS('path', { d: path, fill: 'none', stroke: 'var(--color-accent)', 'stroke-width': 2.5 }));

  container.appendChild(svg);
}

// ── Heatmap (365 days) ─────────────────────────────────────────────────────

export function renderHeatmap(container, sessionsByDay, recoveryWeekSet = new Set(), getWeekKey = null) {
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);

  // Align to Monday
  const gridStart = new Date(start);
  const dow = (gridStart.getDay() + 6) % 7; // Mon=0
  gridStart.setDate(gridStart.getDate() - dow);

  // Build week columns of 7 day-cells each
  const weeks = [];
  let cursor = new Date(gridStart);
  while (cursor <= today) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const inRange = cursor >= start && cursor <= today;
      col.push({
        key,
        date: new Date(cursor),
        count: sessionsByDay[key] || 0,
        inRange,
        isRecovery: inRange && getWeekKey ? recoveryWeekSet.has(getWeekKey(cursor.getTime())) : false,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  // Month labels
  const labelRow = document.createElement('div');
  labelRow.style.cssText = `display:grid;grid-template-columns:repeat(${weeks.length},1fr);gap:2px;`;
  let lastMonth = -1;
  for (const col of weeks) {
    const firstDay = col[0].date;
    const month = firstDay.getMonth();
    const label = document.createElement('div');
    label.style.cssText = `font-size:9px;color:var(--color-ink-muted);`;
    if (month !== lastMonth) {
      label.textContent = firstDay.toLocaleDateString('en-GB', { month: 'short' });
      lastMonth = month;
    }
    labelRow.appendChild(label);
  }
  wrap.appendChild(labelRow);

  // Grid
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${weeks.length},1fr);grid-template-rows:repeat(7,1fr);gap:2px;`;

  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const cell = weeks[w][d];
      const c = document.createElement('div');
      c.style.cssText = `
        grid-column: ${w + 1};
        grid-row: ${d + 1};
        aspect-ratio: 1;
        border-radius: 2px;
        background: ${yearHeatColor(cell)};
      `;
      c.title = cell.inRange
        ? `${cell.key}: ${cell.isRecovery ? 'Recovery week' : `${cell.count} session${cell.count !== 1 ? 's' : ''}`}`
        : '';
      grid.appendChild(c);
    }
  }
  wrap.appendChild(grid);

  container.appendChild(wrap);
}

function yearHeatColor(cell) {
  if (!cell.inRange) return 'transparent';
  if (cell.isRecovery) return 'var(--color-recovery)';
  if (cell.count === 0) return 'var(--color-bg)';
  return 'var(--color-accent)';
}

// ── Goal hero (weekly sessions) ────────────────────────────────────────────

export function renderGoalHero(container, current, goal, isRecovery) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-3);';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;';

  const big = document.createElement('div');
  big.style.cssText = `font-size:var(--text-display);font-weight:var(--weight-bold);line-height:var(--leading-tight);letter-spacing:var(--tracking-tight);color:${isRecovery ? 'var(--color-recovery)' : 'var(--color-ink)'};`;
  big.textContent = `${current} / ${goal}`;

  const label = document.createElement('div');
  label.style.cssText = 'font-size:var(--text-small);color:var(--color-ink-muted);';
  label.textContent = isRecovery ? 'Recovery week' : 'sessions this week';

  topRow.appendChild(big);
  topRow.appendChild(label);
  wrap.appendChild(topRow);

  const segRow = document.createElement('div');
  segRow.style.cssText = 'display:flex;gap:var(--space-2);';
  for (let i = 0; i < goal; i++) {
    const seg = document.createElement('div');
    const filled = i < current;
    seg.style.cssText = `
      flex: 1;
      height: 10px;
      border-radius: var(--radius-full);
      background: ${filled ? (isRecovery ? 'var(--color-recovery)' : 'var(--color-accent)') : 'var(--color-border-sub)'};
    `;
    segRow.appendChild(seg);
  }
  wrap.appendChild(segRow);

  container.appendChild(wrap);
}
