const DB_NAME = 'HaleDB';
const DB_VERSION = 1;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('blockId', 'blockId', { unique: false });
        s.createIndex('weekNumber', 'weekNumber', { unique: false });
        s.createIndex('sessionStart', 'sessionStart', { unique: false });
        s.createIndex('cycle', 'cycle', { unique: false });
      }

      if (!db.objectStoreNames.contains('sets')) {
        const s = db.createObjectStore('sets', { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId', { unique: false });
        s.createIndex('exerciseId', 'exerciseId', { unique: false });
      }

      if (!db.objectStoreNames.contains('exercises')) {
        const s = db.createObjectStore('exercises', { keyPath: 'id' });
        s.createIndex('blockId', 'blockId', { unique: false });
        s.createIndex('isActive', 'isActive', { unique: false });
      }

      if (!db.objectStoreNames.contains('blocks')) {
        const s = db.createObjectStore('blocks', { keyPath: 'id' });
        s.createIndex('order', 'order', { unique: false });
        s.createIndex('isActive', 'isActive', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

// ── Settings ──────────────────────────────────────────────────────────────

export function getSetting(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export function setSetting(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const req = tx.objectStore('settings').put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSettings(db) {
  const rows = await getAll(db, 'settings');
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

// ── Recovery weeks ────────────────────────────────────────────────────────

export async function getRecoveryWeeks(db) {
  return (await getSetting(db, 'recovery_weeks')) || [];
}

export async function isRecoveryWeek(db, weekKey) {
  const weeks = await getRecoveryWeeks(db);
  return weeks.includes(weekKey);
}

export async function toggleRecoveryWeek(db, weekKey) {
  const weeks = await getRecoveryWeeks(db);
  const next = weeks.includes(weekKey)
    ? weeks.filter(w => w !== weekKey)
    : [...weeks, weekKey];
  await setSetting(db, 'recovery_weeks', next);
  return next;
}

// ── Sessions ──────────────────────────────────────────────────────────────

export function getAllSessions(db) {
  return getAll(db, 'sessions');
}

export function putSession(db, session) {
  return put(db, 'sessions', session);
}

export function deleteSession(db, id) {
  return del(db, 'sessions', id);
}

export function getSession(db, id) {
  return getOne(db, 'sessions', id);
}

export function getOpenSession(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const req = store.getAll();
    req.onsuccess = () => {
      const open = req.result.find(s => s.sessionEnd === null);
      resolve(open || null);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Sets ──────────────────────────────────────────────────────────────────

export function getAllSets(db) {
  return getAll(db, 'sets');
}

export function getSetsBySession(db, sessionId) {
  return getByIndex(db, 'sets', 'sessionId', sessionId);
}

export function getSetsByExercise(db, exerciseId) {
  return getByIndex(db, 'sets', 'exerciseId', exerciseId);
}

export function putSet(db, set) {
  return put(db, 'sets', set);
}

export function deleteSet(db, id) {
  return del(db, 'sets', id);
}

export function deleteSetsBySession(db, sessionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sets', 'readwrite');
    const store = tx.objectStore('sets');
    const index = store.index('sessionId');
    const req = index.openCursor(IDBKeyRange.only(sessionId));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Exercises ─────────────────────────────────────────────────────────────

export function getAllExercises(db) {
  return getAll(db, 'exercises');
}

export function getExercise(db, id) {
  return getOne(db, 'exercises', id);
}

export function getExercisesByBlock(db, blockId) {
  return getByIndex(db, 'exercises', 'blockId', blockId);
}

export function putExercise(db, exercise) {
  return put(db, 'exercises', exercise);
}

// ── Last-session lookups ────────────────────────────────────────────────────

export async function getLastExerciseSummary(db, exerciseId, excludeSessionId) {
  const [sets, sessions] = await Promise.all([
    getSetsByExercise(db, exerciseId),
    getAllSessions(db),
  ]);

  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));
  const eligibleSessionIds = new Set(
    sessions
      .filter(s => s.id !== excludeSessionId && s.sessionEnd)
      .map(s => s.id)
  );

  let lastSessionId = null;
  for (const set of sets) {
    if (!set.completed || !eligibleSessionIds.has(set.sessionId)) continue;
    const sess = sessionMap[set.sessionId];
    if (!lastSessionId || sess.sessionStart > sessionMap[lastSessionId].sessionStart) {
      lastSessionId = set.sessionId;
    }
  }
  if (!lastSessionId) return null;

  const lastSets = sets.filter(s => s.sessionId === lastSessionId && s.completed);
  if (!lastSets.length) return null;

  const count = lastSets.length;
  const maxValue = Math.max(...lastSets.map(s => s.value));
  return { count, maxValue, sessionStart: sessionMap[lastSessionId].sessionStart };
}

// ── Blocks ────────────────────────────────────────────────────────────────

export function getAllBlocks(db) {
  return getAll(db, 'blocks');
}

export function putBlock(db, block) {
  return put(db, 'blocks', block);
}

// ── Migration from FitPalDB ───────────────────────────────────────────────

export async function migrateFromFitPal(db) {
  const done = await getSetting(db, 'migration_complete');
  if (done) return;

  try {
    const fitpalDB = await openFitPalDB();
    const workouts = await getAllFromStore(fitpalDB, 'workouts');
    fitpalDB.close();

    if (workouts.length > 0) {
      await importFitPalWorkouts(db, workouts);
    }
  } catch {
    // FitPalDB does not exist or is inaccessible — safe to skip
  }

  await setSetting(db, 'migration_complete', true);
}

async function importFitPalWorkouts(db, workouts) {
  // Group by (cycle, week, day) → one session per group
  const sessionMap = new Map();
  for (const w of workouts) {
    const key = `${w.cycle}-${w.week}-${w.day}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { cycle: w.cycle, week: w.week, blockId: w.day, exercises: [] });
    }
    sessionMap.get(key).exercises.push(w);
  }

  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const sessionsStore = tx.objectStore('sessions');
  const setsStore = tx.objectStore('sets');

  for (const [, sess] of sessionMap) {
    const ts = sess.exercises.map(e => e.timestamp).filter(Boolean).sort((a, b) => a - b);
    const sessionStart = ts[0] || Date.now();
    const sessionId = `${sess.cycle}-${sess.week}-${sess.blockId}-${sessionStart}`;

    sessionsStore.put({
      id: sessionId,
      cycle: sess.cycle,
      weekNumber: sess.week,
      blockId: sess.blockId,
      sessionStart,
      sessionEnd: sessionStart + 3600000,
      sessionType: 'gym',
    });

    let setIndex = 0;
    for (const ex of sess.exercises) {
      const exerciseId = slugify(ex.exercise);
      const values = parseFitPalWeight(ex.weight);
      for (const value of values) {
        setsStore.put({
          id: `${sessionId}-${exerciseId}-${setIndex}`,
          sessionId,
          exerciseId,
          setIndex,
          value,
          completed: true,
          timestamp: ex.timestamp || sessionStart,
        });
        setIndex++;
      }
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function openFitPalDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FitPalDB');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('FitPalDB unavailable'));
    req.onblocked = () => reject(new Error('FitPalDB blocked'));
    // If database doesn't exist at all, onupgradeneeded fires then onsuccess
    // We'll just close it with no data
    req.onupgradeneeded = () => {
      req.transaction.abort();
      reject(new Error('FitPalDB does not exist'));
    };
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) { resolve([]); return; }
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function parseFitPalWeight(str) {
  if (!str) return [0];
  const s = String(str).trim();

  // "80/75/70" → multiple set values
  if (s.includes('/')) {
    return s.split('/').map(v => parseFloat(v.trim())).filter(n => !isNaN(n));
  }
  // "BW+20" → added weight only
  const bwPlus = s.match(/bw\+(\d+(?:\.\d+)?)/i);
  if (bwPlus) return [parseFloat(bwPlus[1])];
  // Bodyweight only
  if (/^bw$/i.test(s) || /bodyweight/i.test(s)) return [0];
  // "1:30" time → seconds
  const time = s.match(/^(\d+):(\d{2})$/);
  if (time) return [parseInt(time[1]) * 60 + parseInt(time[2])];
  // Plain number or "80s"
  const n = parseFloat(s);
  return isNaN(n) ? [0] : [n];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getOne(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex(db, store, index, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(index).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(db, store, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function del(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dateKey(ts) {
  // Local-date key (not UTC) so late-evening sessions stay on the right day
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
