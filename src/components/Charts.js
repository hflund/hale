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

export function renderFullChart(container, data) {
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
  for (const pt of pts) {
    svg.appendChild(svgNS('circle', {
      cx: n(pt[0]), cy: n(pt[1]), r: 4,
      fill: 'var(--color-accent)',
      stroke: 'var(--color-surface)',
      'stroke-width': 1.5,
    }));
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

// ── Heatmap (30 days) ─────────────────────────────────────────────────────

export function renderHeatmap(container, sessionsByDay) {
  container.innerHTML = '';

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start30 = new Date(today);
  start30.setDate(start30.getDate() - 29);
  start30.setHours(0, 0, 0, 0);

  // Align to Monday
  const gridStart = new Date(start30);
  const dow = (gridStart.getDay() + 6) % 7; // Mon=0
  gridStart.setDate(gridStart.getDate() - dow);

  const cells = [];
  const cursor = new Date(gridStart);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    cells.push({
      key,
      count: sessionsByDay[key] || 0,
      inRange: cursor >= start30,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const div = document.createElement('div');
  div.style.cssText = `display:grid;grid-template-columns:repeat(7,1fr);gap:3px;`;

  for (const cell of cells) {
    const c = document.createElement('div');
    c.style.cssText = `
      aspect-ratio:1;
      border-radius: var(--radius-sm);
      background: ${heatColor(cell.count, cell.inRange)};
    `;
    c.title = cell.inRange ? `${cell.key}: ${cell.count} session${cell.count !== 1 ? 's' : ''}` : '';
    div.appendChild(c);
  }

  container.appendChild(div);
}

function heatColor(count, inRange) {
  if (!inRange) return 'transparent';
  if (count === 0) return 'var(--color-border)';
  if (count === 1) return 'var(--color-accent-sub)';
  if (count === 2) return 'rgba(184,92,56,0.6)';
  return 'var(--color-accent)';
}

// ── Sessions/week bar ─────────────────────────────────────────────────────

export function renderSessionsBar(container, current, goal) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:3px;align-items:center;';
  for (let i = 0; i < goal; i++) {
    const seg = document.createElement('div');
    seg.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: ${i < current ? 'var(--color-accent)' : 'var(--color-border)'};
    `;
    wrap.appendChild(seg);
  }
  container.appendChild(wrap);
}
