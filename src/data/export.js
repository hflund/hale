import { getAllSessions, getAllSets, getAllExercises, getAllBlocks, setSetting } from './db.js';

export async function exportCSV(db) {
  const [sessions, sets, exercises, blocks] = await Promise.all([
    getAllSessions(db),
    getAllSets(db),
    getAllExercises(db),
    getAllBlocks(db),
  ]);

  if (sessions.length === 0 && sets.length === 0) return null;

  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b.name]));
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

  const rows = [
    ['Date', 'Block', 'Exercise', 'Tracking Type', 'Set', 'Value', 'Completed', 'Session ID'],
  ];

  // Group sets by session then exercise for ordered output
  const setsBySession = {};
  for (const set of sets) {
    if (!setsBySession[set.sessionId]) setsBySession[set.sessionId] = [];
    setsBySession[set.sessionId].push(set);
  }

  const sortedSessions = [...sessions].sort((a, b) => a.sessionStart - b.sessionStart);

  for (const session of sortedSessions) {
    const date = new Date(session.sessionStart).toISOString().slice(0, 10);
    const blockName = blockMap[session.blockId] || session.blockId;
    const sessionSets = (setsBySession[session.id] || []).sort((a, b) => a.setIndex - b.setIndex);

    // Group by exercise within session
    const byExercise = {};
    for (const s of sessionSets) {
      if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = [];
      byExercise[s.exerciseId].push(s);
    }

    for (const [exerciseId, exSets] of Object.entries(byExercise)) {
      const ex = exerciseMap[exerciseId];
      const exName = ex ? ex.name : exerciseId;
      const trackingType = ex ? ex.trackingType : 'kg';

      exSets.forEach((s, idx) => {
        rows.push([
          date,
          blockName,
          exName,
          trackingType,
          idx + 1,
          formatValue(s.value, trackingType),
          s.completed ? 'yes' : 'no',
          session.id,
        ]);
      });
    }
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hale-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  await setSetting(db, 'last_export_timestamp', Date.now());
  return true;
}

function formatValue(value, trackingType) {
  if (trackingType === 'time') {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (trackingType === 'bodyweight') return 'BW';
  if (trackingType === 'bodyweight_kg') return `BW+${value}kg`;
  if (trackingType === 'reps') return `${value} reps`;
  return `${value}kg`;
}
