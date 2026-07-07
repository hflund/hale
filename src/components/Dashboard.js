import { getAllSessions, getAllSets, getAllExercises, getAllBlocks, getSetting, getRecoveryWeeks } from '../data/db.js';
import { renderHeatmap, renderGoalHero, renderVolumeChart } from './Charts.js';
import { getISOWeekKey, dateKey } from '../data/db.js';

let _db = null;

export async function mountDashboard(container, db) {
  _db = db;
  container.innerHTML = '';

  const [sessions, sets, exercises, blocks, weeklyGoal, recoveryWeeks] = await Promise.all([
    getAllSessions(db),
    getAllSets(db),
    getAllExercises(db),
    getAllBlocks(db),
    getSetting(db, 'weekly_goal'),
    getRecoveryWeeks(db),
  ]);

  const goal = weeklyGoal || 3;
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]));
  const recoveryWeekSet = new Set(recoveryWeeks);

  // Pre-compute
  const now = Date.now();
  const oneYearAgo = now - 365 * 86400000;

  // Sessions by date key
  const sessionsByDay = {};
  const sessionsByWeek = {};
  for (const s of sessions) {
    if (!s.sessionEnd) continue; // skip open sessions
    const dk = dateKey(s.sessionStart);
    sessionsByDay[dk] = (sessionsByDay[dk] || 0) + 1;
    const wk = getISOWeekKey(s.sessionStart);
    sessionsByWeek[wk] = (sessionsByWeek[wk] || 0) + 1;
  }

  // Current week sessions
  const thisWeekKey = getISOWeekKey(now);
  const thisWeekCount = sessionsByWeek[thisWeekKey] || 0;
  const isRecoveryThisWeek = recoveryWeekSet.has(thisWeekKey);

  // Streak
  const streak = calcStreak(sessionsByWeek, goal, now, recoveryWeekSet);

  // Weekly volume (last 8 weeks)
  const volumeByWeek = calcVolumeByWeek(sessions, sets, exerciseMap, 8);

  // Current week volume
  const currentWeekVolume = volumeByWeek[volumeByWeek.length - 1]?.value || 0;
  const prevWeekVolume = volumeByWeek[volumeByWeek.length - 2]?.value || 0;
  const last4Volume = volumeByWeek.slice(-4).reduce((a, w) => a + w.value, 0);
  const prev4Volume = volumeByWeek.slice(-8, -4).reduce((a, w) => a + w.value, 0);
  const allTimeVolume = calcAllTimeVolume(sessions, sets, exerciseMap);

  // Personal bests
  const pbs = calcPBs(sets, exercises, sessions);

  // Recent sessions (last 5 completed)
  const recentSessions = [...sessions]
    .filter(s => s.sessionEnd)
    .sort((a, b) => b.sessionStart - a.sessionStart)
    .slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────

  const wrap = document.createElement('div');
  wrap.className = 'page-content';

  const stack = document.createElement('div');
  stack.className = 'section-stack';

  // ── Stats card ──────────────────────────────────────────────────────

  const statsCard = document.createElement('div');
  statsCard.className = 'card';
  statsCard.style.display = 'flex';
  statsCard.style.flexDirection = 'column';
  statsCard.style.gap = 'var(--space-5)';

  // Goal hero
  const heroWrap = document.createElement('div');
  renderGoalHero(heroWrap, thisWeekCount, goal, isRecoveryThisWeek);
  statsCard.appendChild(heroWrap);

  // Streak with stakes
  const streakRow = document.createElement('div');
  streakRow.style.cssText = 'display:flex;align-items:center;gap:var(--space-2);';
  if (isRecoveryThisWeek) {
    streakRow.innerHTML = `
      <svg data-lucide="shield" width="16" height="16" stroke-width="1.5" style="color:var(--color-recovery)"></svg>
      <span style="font-size:var(--text-small);color:var(--color-ink-muted);">Streak frozen at ${streak} week${streak !== 1 ? 's' : ''} during recovery</span>
    `;
  } else if (streak > 0 && thisWeekCount < goal) {
    const remaining = goal - thisWeekCount;
    streakRow.innerHTML = `
      <svg data-lucide="flame" width="16" height="16" stroke-width="1.5" style="color:var(--color-accent)"></svg>
      <span style="font-size:var(--text-small);color:var(--color-ink-muted);">${streak} week streak — ${remaining} session${remaining !== 1 ? 's' : ''} to keep it</span>
    `;
  } else if (streak > 0) {
    streakRow.innerHTML = `
      <svg data-lucide="flame" width="16" height="16" stroke-width="1.5" style="color:var(--color-accent)"></svg>
      <span style="font-size:var(--text-small);color:var(--color-ink-muted);">${streak} week streak</span>
    `;
  }
  if (streakRow.innerHTML) {
    statsCard.appendChild(streakRow);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [streakRow] });
  }

  // Divider
  statsCard.appendChild(makeDivider());

  // Heatmap (365 days)
  const heatWrap = document.createElement('div');
  renderHeatmap(heatWrap, sessionsByDay, recoveryWeekSet, getISOWeekKey);
  statsCard.appendChild(heatWrap);

  // Divider
  statsCard.appendChild(makeDivider());

  // Headline volume stats: This week / 4 weeks / All-time
  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:flex;justify-content:space-between;gap:var(--space-3);';
  statsRow.appendChild(makeVolumeStat('This week', currentWeekVolume, prevWeekVolume));
  statsRow.appendChild(makeVolumeStat('4 weeks', last4Volume, prev4Volume));
  statsRow.appendChild(makeVolumeStat('All time', allTimeVolume, null));
  statsCard.appendChild(statsRow);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [statsRow] });

  // Volume chart (8 weeks)
  if (volumeByWeek.length > 1) {
    statsCard.appendChild(makeDivider());
    const chartWrap = document.createElement('div');
    chartWrap.style.height = '80px';
    statsCard.appendChild(chartWrap);
    // Render after append so clientWidth is available
    requestAnimationFrame(() => renderVolumeChart(chartWrap, volumeByWeek));
  }

  // ── PBs ─────────────────────────────────────────────────────────────

  if (pbs.length) {
    statsCard.appendChild(makeDivider());
    const pbLabel = document.createElement('div');
    pbLabel.className = 'section-label';
    pbLabel.textContent = 'Personal Bests';
    statsCard.appendChild(pbLabel);

    for (const pb of pbs.slice(0, 3)) {
      const row = document.createElement('div');
      row.className = 'pb-row';
      row.innerHTML = `
        <span style="font-size:var(--text-body);font-weight:var(--weight-medium);">${pb.name}</span>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <span style="font-size:var(--text-body);font-weight:var(--weight-bold);">${formatPBValue(pb.value, pb.trackingType)}</span>
          <svg data-lucide="award" width="16" height="16" stroke-width="1.5" style="color:var(--color-accent)"></svg>
        </div>
      `;
      statsCard.appendChild(row);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [statsCard] });
  }

  stack.appendChild(statsCard);

  // ── Recent Sessions card ─────────────────────────────────────────────

  const recentCard = document.createElement('div');
  recentCard.className = 'card';
  recentCard.style.cssText = 'display:flex;flex-direction:column;';

  const recentLabel = document.createElement('div');
  recentLabel.className = 'section-label';
  recentLabel.style.paddingTop = '0';
  recentLabel.textContent = 'Recent Sessions';
  recentCard.appendChild(recentLabel);

  if (recentSessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No sessions yet. Tap + to log your first.';
    recentCard.appendChild(empty);
  } else {
    const expandedSessions = new Set();

    function renderRecentRows() {
      const existing = recentCard.querySelectorAll('.session-row, .session-row-expanded');
      existing.forEach(el => el.remove());

      for (const sess of recentSessions) {
        const blockName = blockMap[sess.blockId]?.name || sess.blockId;
        const date = new Date(sess.sessionStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const sessSets = sets.filter(s => s.sessionId === sess.id && s.completed);
        const vol = calcSessionVolume(sessSets, exerciseMap);

        const row = document.createElement('div');
        row.className = 'session-row';
        row.innerHTML = `
          <div style="flex:1;">
            <div style="font-size:var(--text-body);font-weight:var(--weight-semibold);">${blockName}</div>
            <div style="font-size:var(--text-small);color:var(--color-ink-muted);">${date}</div>
          </div>
          <div style="font-size:var(--text-small);font-weight:var(--weight-medium);color:var(--color-ink-muted);">${vol > 0 ? `${Math.round(vol)}kg` : ''}</div>
          <svg data-lucide="chevron-down" width="16" height="16" stroke-width="1.5" style="color:var(--color-ink-muted);transition:transform 0.2s;margin-left:var(--space-2);flex-shrink:0;${expandedSessions.has(sess.id) ? 'transform:rotate(180deg);' : ''}"></svg>
        `;
        row.addEventListener('click', () => {
          if (expandedSessions.has(sess.id)) expandedSessions.delete(sess.id);
          else expandedSessions.add(sess.id);
          renderRecentRows();
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [recentCard] });
        });
        recentCard.appendChild(row);

        if (expandedSessions.has(sess.id)) {
          const expanded = document.createElement('div');
          expanded.className = 'session-row-expanded';
          const sessByEx = groupSetsByExercise(sets.filter(s => s.sessionId === sess.id), exerciseMap);
          expanded.innerHTML = sessByEx.map(({ name, sets: exSets, trackingType }) =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:var(--text-small);">
              <span style="color:var(--color-ink-muted);">${name}</span>
              <span style="font-weight:var(--weight-medium);">${summariseSets(exSets, trackingType)}</span>
            </div>`
          ).join('');
          recentCard.appendChild(expanded);
        }
      }

      const viewAll = recentCard.querySelector('.btn-view-all');
      if (!viewAll) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-view-all';
        btn.style.marginTop = 'var(--space-4)';
        btn.textContent = 'View all in Progress';
        btn.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('hale:navigate', { detail: 'progress' }));
        });
        recentCard.appendChild(btn);
      }
    }

    renderRecentRows();
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [recentCard] });
  }

  stack.appendChild(recentCard);

  wrap.appendChild(stack);
  container.appendChild(wrap);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [statsCard] });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function makeDivider() {
  const d = document.createElement('div');
  d.className = 'card-divider';
  return d;
}

function calcStreak(sessionsByWeek, goal, now, recoveryWeekSet = new Set()) {
  const currentWeek = getISOWeekKey(now);
  let streak = 0;
  let d = new Date(now);
  d.setDate(d.getDate() - 7); // start from last completed week

  for (let i = 0; i < 104; i++) {
    const wk = getISOWeekKey(d);
    if (wk === currentWeek) { d.setDate(d.getDate() - 7); continue; }
    if (recoveryWeekSet.has(wk)) { d.setDate(d.getDate() - 7); continue; } // frozen, not broken
    if ((sessionsByWeek[wk] || 0) >= goal) {
      streak++;
      d.setDate(d.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

function calcAllTimeVolume(sessions, sets, exerciseMap) {
  const setsBySession = {};
  for (const s of sets) {
    if (!setsBySession[s.sessionId]) setsBySession[s.sessionId] = [];
    setsBySession[s.sessionId].push(s);
  }
  let total = 0;
  for (const sess of sessions) {
    if (!sess.sessionEnd) continue;
    total += calcSessionVolume(setsBySession[sess.id] || [], exerciseMap);
  }
  return total;
}

function makeVolumeStat(label, value, prevValue) {
  const item = document.createElement('div');
  item.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

  const labelEl = document.createElement('div');
  labelEl.style.cssText = 'font-size:var(--text-caption);color:var(--color-ink-muted);';
  labelEl.textContent = label;
  item.appendChild(labelEl);

  const valueEl = document.createElement('div');
  valueEl.style.cssText = 'font-size:var(--text-h2);font-weight:var(--weight-bold);letter-spacing:var(--tracking-tight);';
  valueEl.textContent = value > 0 ? `${Math.round(value)}kg` : '—';
  item.appendChild(valueEl);

  if (prevValue !== null && (value > 0 || prevValue > 0)) {
    const pct = prevValue !== 0 ? ((value - prevValue) / prevValue) * 100 : 100;
    const isUp = pct >= 0;
    const badge = document.createElement('div');
    badge.style.cssText = `display:flex;align-items:center;gap:2px;font-size:var(--text-caption);font-weight:var(--weight-semibold);color:${isUp ? 'var(--color-accent)' : 'var(--color-ink-muted)'};`;
    badge.innerHTML = `<svg data-lucide="${isUp ? 'trending-up' : 'trending-down'}" width="11" height="11" stroke-width="2"></svg> ${isUp ? '+' : ''}${pct.toFixed(0)}%`;
    item.appendChild(badge);
  }

  return item;
}

function calcVolumeByWeek(sessions, sets, exerciseMap, numWeeks) {
  const now = Date.now();
  const weeks = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getISOWeekKey(d));
  }

  const setsBySession = {};
  for (const s of sets) {
    if (!setsBySession[s.sessionId]) setsBySession[s.sessionId] = [];
    setsBySession[s.sessionId].push(s);
  }

  return weeks.map(wk => {
    const weekSessions = sessions.filter(s => getISOWeekKey(s.sessionStart) === wk && s.sessionEnd);
    let vol = 0;
    for (const s of weekSessions) {
      const sessSets = setsBySession[s.id] || [];
      vol += calcSessionVolume(sessSets, exerciseMap);
    }
    return { date: wk, value: vol };
  });
}

function calcSessionVolume(sets, exerciseMap) {
  let vol = 0;
  for (const s of sets) {
    if (!s.completed) continue;
    const ex = exerciseMap[s.exerciseId];
    if (!ex) continue;
    if (ex.trackingType === 'kg' || ex.trackingType === 'bodyweight_kg') {
      vol += s.value;
    }
  }
  return vol;
}

function calcPBs(sets, exercises, sessions) {
  const sessionTimestamps = Object.fromEntries(sessions.map(s => [s.id, s.sessionStart]));
  const pbMap = {};
  for (const s of sets) {
    if (!s.completed) continue;
    if (!pbMap[s.exerciseId] || s.value > pbMap[s.exerciseId].value) {
      pbMap[s.exerciseId] = { value: s.value, ts: sessionTimestamps[s.sessionId] || 0 };
    }
  }
  return Object.entries(pbMap)
    .map(([id, pb]) => {
      const ex = exercises.find(e => e.id === id);
      if (!ex) return null;
      return { id, name: ex.name, trackingType: ex.trackingType, value: pb.value, ts: pb.ts };
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts);
}

function formatPBValue(value, trackingType) {
  if (trackingType === 'time') {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }
  if (trackingType === 'bodyweight') return 'BW';
  if (trackingType === 'bodyweight_kg') return `BW + ${value}kg`;
  if (trackingType === 'reps') return `${value} reps`;
  return `${value}kg`;
}

function groupSetsByExercise(sets, exerciseMap) {
  const map = {};
  for (const s of sets) {
    if (!map[s.exerciseId]) map[s.exerciseId] = { sets: [], name: exerciseMap[s.exerciseId]?.name || s.exerciseId, trackingType: exerciseMap[s.exerciseId]?.trackingType || 'kg' };
    map[s.exerciseId].sets.push(s);
  }
  return Object.values(map);
}

function summariseSets(sets, trackingType) {
  const completed = sets.filter(s => s.completed);
  if (!completed.length) return '—';
  if (trackingType === 'bodyweight') return `${completed.length} sets BW`;
  const vals = completed.map(s => s.value);
  const max = Math.max(...vals);
  if (trackingType === 'time') {
    const m = Math.floor(max / 60); const s = Math.round(max % 60);
    return `${completed.length}×${m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's'}`;
  }
  const unit = (trackingType === 'reps') ? ' reps' : 'kg';
  return `${completed.length}×${max}${unit}`;
}
