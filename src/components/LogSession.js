import {
  getAllBlocks, getExercisesByBlock, putSession, putSet, deleteSetsBySession,
  deleteSession, getOpenSession, setSetting, getSetting, getLastExerciseSummary,
} from '../data/db.js';
import { getISOWeekKey } from '../data/db.js';

let _db = null;
let _pageWrap = null;
let _timerInterval = null;
let _midnightTimeout = null;
let _currentSession = null; // { id, blockId, sessionStart, setIndex, exercises }
let _sessionSets = {};       // exerciseId → [{ setLocalIdx, value, done }]
let _lastSummaries = {};     // exerciseId → { count, maxValue, sessionStart } | null

export async function mountLogSession(container, db) {
  _db = db;
  clearTimer();
  container.innerHTML = '';

  _pageWrap = document.createElement('div');
  _pageWrap.className = 'page-content';
  container.appendChild(_pageWrap);

  // Check for open session
  const openSess = await getOpenSession(db);
  if (openSess) {
    _currentSession = openSess;
    const exercises = await getExercisesByBlock(db, openSess.blockId);
    _currentSession._exercises = exercises.filter(e => e.isActive).sort((a, b) => a.order - b.order);
    await loadLastSummaries(_currentSession._exercises);
    renderActiveSession(_pageWrap);
  } else {
    renderSelectBlock(_pageWrap);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [_pageWrap] });

  scheduleMidnightClose();
}

// ── Step 1: Select block ───────────────────────────────────────────────────

async function renderSelectBlock(container) {
  const [blocks] = await Promise.all([getAllBlocks(_db)]);
  const activeBlocks = blocks.filter(b => b.isActive).sort((a, b) => a.order - b.order);

  const title = document.createElement('h2');
  title.style.cssText = `font-size:var(--text-h2);font-weight:var(--weight-bold);line-height:var(--leading-tight);margin-bottom:var(--space-5);`;
  title.textContent = 'Start a session';
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'block-grid';

  for (const block of activeBlocks) {
    const tile = document.createElement('div');
    tile.className = 'block-tile';
    tile.textContent = block.name;
    tile.addEventListener('click', () => startSession(block.id, block.name));
    grid.appendChild(tile);
  }

  // + New Block
  const newBlock = document.createElement('div');
  newBlock.className = 'block-tile';
  newBlock.style.cssText += 'color:var(--color-ink-muted);border-style:dashed;';
  newBlock.innerHTML = `<svg data-lucide="plus" width="16" height="16" stroke-width="1.5"></svg>&nbsp;New Block`;
  newBlock.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('hale:navigate', { detail: 'library' }));
  });
  grid.appendChild(newBlock);

  container.appendChild(grid);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

// ── Start session ──────────────────────────────────────────────────────────

async function startSession(blockId, blockName) {
  const exercises = await getExercisesByBlock(_db, blockId);
  const activeExercises = exercises.filter(e => e.isActive).sort((a, b) => a.order - b.order);

  const sessionStart = Date.now();
  const weekKey = getISOWeekKey(sessionStart);
  const sessionId = `1-${weekKey}-${blockId}-${sessionStart}`;

  const session = {
    id: sessionId,
    cycle: (await getSetting(_db, 'current_cycle')) || 1,
    weekNumber: parseInt(weekKey.split('-W')[1]),
    blockId,
    blockName: blockName || blockId,
    sessionStart,
    sessionEnd: null,
    sessionType: 'gym',
    _exercises: activeExercises,
  };

  await putSession(_db, {
    id: session.id,
    cycle: session.cycle,
    weekNumber: session.weekNumber,
    blockId: session.blockId,
    blockName: session.blockName,
    sessionStart: session.sessionStart,
    sessionEnd: null,
    sessionType: 'gym',
  });
  _currentSession = session;
  _sessionSets = {};

  await loadLastSummaries(activeExercises);

  _pageWrap.innerHTML = '';
  renderActiveSession(_pageWrap);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [_pageWrap] });
}

async function loadLastSummaries(exercises) {
  _lastSummaries = {};
  await Promise.all(exercises.map(async (ex) => {
    _lastSummaries[ex.id] = await getLastExerciseSummary(_db, ex.id, _currentSession?.id);
  }));
}

// ── Step 2: Active session ─────────────────────────────────────────────────

function renderActiveSession(container) {
  const sess = _currentSession;
  if (!sess) return;

  // Header row
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5);';

  const blockName = document.createElement('div');
  blockName.style.cssText = `font-size:var(--text-h2);font-weight:var(--weight-bold);line-height:var(--leading-tight);`;
  blockName.textContent = sess.blockName || sess.blockId;

  const timer = document.createElement('div');
  timer.className = 'session-timer';
  timer.textContent = formatElapsed(Date.now() - sess.sessionStart);
  startTimer(timer, sess.sessionStart);

  header.appendChild(blockName);
  header.appendChild(timer);
  container.appendChild(header);

  // Exercise rows
  const exercises = sess._exercises || [];
  const exerciseListEl = document.createElement('div');
  exerciseListEl.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-5);padding-bottom:calc(var(--space-8) + 44px);';

  for (const ex of exercises) {
    if (!_sessionSets[ex.id]) _sessionSets[ex.id] = { value: '', completedSets: new Set() };
    exerciseListEl.appendChild(renderExerciseRow(ex));
  }

  container.appendChild(exerciseListEl);

  // Fixed End Session button — sticky at bottom of the page
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: sticky;
    bottom: 0;
    background: var(--color-bg);
    padding: var(--space-4) 0;
    margin: 0 calc(-1 * var(--space-4));
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  `;
  const endBtn = document.createElement('button');
  endBtn.className = 'btn btn-primary';
  endBtn.textContent = 'End Session';
  endBtn.addEventListener('click', endSession);
  footer.appendChild(endBtn);
  container.appendChild(footer);
}

function renderExerciseRow(ex) {
  const state = _sessionSets[ex.id];
  const setCount = parseSetCount(ex.setsTarget);

  const row = document.createElement('div');

  // Exercise name + tag
  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);';
  nameRow.innerHTML = `
    <span style="font-size:var(--text-h3);font-weight:var(--weight-bold);">${ex.name}</span>
    <span class="tag">${ex.setsTarget}</span>
  `;
  row.appendChild(nameRow);

  // Last session summary
  const lastSummary = _lastSummaries[ex.id];
  if (lastSummary) {
    const lastRow = document.createElement('div');
    lastRow.style.cssText = 'font-size:var(--text-small);color:var(--color-ink-muted);margin-bottom:var(--space-2);';
    lastRow.textContent = `last: ${formatLastSummary(lastSummary, ex.trackingType)}`;
    row.appendChild(lastRow);
  }

  // Weight input
  const weightRow = document.createElement('div');
  weightRow.className = 'weight-row';
  weightRow.style.marginBottom = 'var(--space-3)';

  if (ex.trackingType === 'bodyweight') {
    const chip = document.createElement('div');
    chip.className = 'bw-chip';
    chip.textContent = 'BW';
    weightRow.appendChild(chip);
  } else if (ex.trackingType === 'bodyweight_kg') {
    const chip = document.createElement('div');
    chip.className = 'bw-chip';
    chip.style.marginRight = 'var(--space-1)';
    chip.textContent = 'BW +';
    const inp = makeWeightInput(ex, state);
    const unit = document.createElement('span');
    unit.className = 'weight-unit';
    unit.textContent = 'kg';
    weightRow.appendChild(chip);
    weightRow.appendChild(inp);
    weightRow.appendChild(unit);
  } else if (ex.trackingType === 'time') {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.placeholder = 'MM:SS';
    inp.value = state.value;
    inp.style.maxWidth = '100px';
    inp.addEventListener('input', () => { state.value = inp.value; });
    weightRow.appendChild(inp);
  } else {
    const inp = makeWeightInput(ex, state);
    const unit = document.createElement('span');
    unit.className = 'weight-unit';
    unit.textContent = ex.trackingType === 'reps' ? 'reps' : 'kg';
    weightRow.appendChild(inp);
    weightRow.appendChild(unit);
  }

  row.appendChild(weightRow);

  // Set checkmarks
  const setRowEl = document.createElement('div');
  setRowEl.className = 'set-row';

  for (let i = 0; i < setCount; i++) {
    const chip = document.createElement('div');
    chip.className = `set-chip${state.completedSets.has(i) ? ' done' : ''}`;
    chip.textContent = state.completedSets.has(i)
      ? ''  // icon via innerHTML below
      : i + 1;

    if (state.completedSets.has(i)) {
      chip.innerHTML = `<svg data-lucide="check" width="14" height="14" stroke-width="2.5"></svg>`;
    }

    chip.addEventListener('click', async () => {
      if (state.completedSets.has(i)) {
        state.completedSets.delete(i);
      } else {
        state.completedSets.add(i);
        await saveSet(ex, i, state);
      }
      // Re-render just this chip
      const chips = setRowEl.querySelectorAll('.set-chip');
      const target = chips[i];
      if (target) {
        target.classList.toggle('done', state.completedSets.has(i));
        if (state.completedSets.has(i)) {
          target.innerHTML = `<svg data-lucide="check" width="14" height="14" stroke-width="2.5"></svg>`;
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [target] });
        } else {
          target.textContent = i + 1;
        }
      }
    });

    setRowEl.appendChild(chip);
  }

  row.appendChild(setRowEl);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
  return row;
}

function makeWeightInput(ex, state) {
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.placeholder = '0';
  inp.value = state.value;
  inp.style.maxWidth = '100px';
  inp.addEventListener('input', () => { state.value = inp.value; });
  return inp;
}

async function saveSet(ex, setLocalIdx, state) {
  if (!_currentSession) return;
  const value = parseValue(state.value, ex.trackingType);

  // Count total completed sets so far across all exercises for global setIndex
  let globalIdx = 0;
  for (const [, s] of Object.entries(_sessionSets)) {
    globalIdx += s.completedSets.size;
  }

  const setId = `${_currentSession.id}-${ex.id}-${setLocalIdx}`;
  await putSet(_db, {
    id: setId,
    sessionId: _currentSession.id,
    exerciseId: ex.id,
    setIndex: setLocalIdx,
    value,
    completed: true,
    timestamp: Date.now(),
  });
}

async function endSession() {
  if (!_currentSession) return;

  const sessionEnd = Date.now();
  await putSession(_db, {
    id: _currentSession.id,
    cycle: _currentSession.cycle,
    weekNumber: _currentSession.weekNumber,
    blockId: _currentSession.blockId,
    blockName: _currentSession.blockName,
    sessionStart: _currentSession.sessionStart,
    sessionEnd,
    sessionType: 'gym',
  });

  _currentSession = null;
  _sessionSets = {};
  clearTimer();

  _pageWrap.innerHTML = '';
  renderSelectBlock(_pageWrap);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [_pageWrap] });
}

// ── Utilities ─────────────────────────────────────────────────────────────

function startTimer(el, startTs) {
  clearTimer();
  el.textContent = formatElapsed(Date.now() - startTs);
  _timerInterval = setInterval(() => {
    el.textContent = formatElapsed(Date.now() - startTs);
  }, 1000);
}

function clearTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

function scheduleMidnightClose() {
  if (_midnightTimeout) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  _midnightTimeout = setTimeout(() => {
    if (_currentSession) endSession();
  }, midnight - now);
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseSetCount(setsTarget) {
  const m = String(setsTarget).match(/^(\d+)x/);
  return m ? parseInt(m[1]) : 3;
}

function parseValue(raw, trackingType) {
  if (trackingType === 'bodyweight') return 0;
  if (trackingType === 'time') {
    const parts = String(raw).match(/^(\d+):(\d{2})$/);
    if (parts) return parseInt(parts[1]) * 60 + parseInt(parts[2]);
    return parseFloat(raw) || 0;
  }
  return parseFloat(raw) || 0;
}

function formatLastSummary(summary, trackingType) {
  const { count, maxValue } = summary;
  if (trackingType === 'bodyweight') return `${count} sets BW`;
  if (trackingType === 'bodyweight_kg') return `${count}×BW+${maxValue}kg`;
  if (trackingType === 'time') {
    const m = Math.floor(maxValue / 60);
    const s = Math.round(maxValue % 60);
    return `${count}×${m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's'}`;
  }
  const unit = trackingType === 'reps' ? ' reps' : 'kg';
  return `${count}×${maxValue}${unit}`;
}
