import { getSetting, setSetting } from './db.js';

const DEFAULT_BLOCKS = [
  { id: 'upper',      name: 'Upper Body', order: 0, isActive: true, isDefault: true },
  { id: 'lower',      name: 'Lower Body', order: 1, isActive: true, isDefault: true },
  { id: 'full',       name: 'Full Body',  order: 2, isActive: true, isDefault: true },
  { id: 'kettlebell', name: 'Kettlebell', order: 3, isActive: true, isDefault: true },
];

const DEFAULT_EXERCISES = [
  // ── Upper Body ───────────────────────────────────────────────────────
  { id: 'incline-barbell-bench-press', name: 'Incline Barbell Bench Press', blockId: 'upper', trackingType: 'kg',           setsTarget: '4x8-10',    notes: '', order: 0, isActive: true },
  { id: 'pull-ups-weighted',           name: 'Pull-Ups / Weighted',         blockId: 'upper', trackingType: 'bodyweight_kg', setsTarget: '4x6-10',    notes: '', order: 1, isActive: true },
  { id: 'bent-over-barbell-row',       name: 'Bent-Over Barbell Row',       blockId: 'upper', trackingType: 'kg',           setsTarget: '4x8-10',    notes: '', order: 2, isActive: true },
  { id: 'dips',                        name: 'Dips',                        blockId: 'upper', trackingType: 'bodyweight_kg', setsTarget: '3x10-15',   notes: '', order: 3, isActive: true },
  { id: 'face-pulls',                  name: 'Face Pulls',                  blockId: 'upper', trackingType: 'kg',           setsTarget: '3x15-20',   notes: '', order: 4, isActive: true },
  { id: 'barbell-curl',                name: 'Barbell Curl',                blockId: 'upper', trackingType: 'kg',           setsTarget: '3x10-12',   notes: '', order: 5, isActive: true },
  { id: 'overhead-tricep-extension',   name: 'Overhead Tricep Extension',   blockId: 'upper', trackingType: 'kg',           setsTarget: '3x10-12',   notes: '', order: 6, isActive: true },
  { id: 'dead-hangs',                  name: 'Dead Hangs',                  blockId: 'upper', trackingType: 'time',         setsTarget: '3x30-45s',  notes: '', order: 7, isActive: true },

  // ── Lower Body ───────────────────────────────────────────────────────
  { id: 'back-squat',          name: 'Back Squat',          blockId: 'lower', trackingType: 'kg',   setsTarget: '4x8-10',    notes: '', order: 0, isActive: true },
  { id: 'romanian-deadlift',   name: 'Romanian Deadlift',   blockId: 'lower', trackingType: 'kg',   setsTarget: '4x8-10',    notes: '', order: 1, isActive: true },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', blockId: 'lower', trackingType: 'kg', setsTarget: '3x10-12/leg', notes: '', order: 2, isActive: true },
  { id: 'lying-leg-curl',      name: 'Lying Leg Curl',      blockId: 'lower', trackingType: 'kg',   setsTarget: '3x12-15',   notes: '', order: 3, isActive: true },
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', blockId: 'lower', trackingType: 'kg',   setsTarget: '4x15-20',   notes: '', order: 4, isActive: true },
  { id: 'hanging-leg-raises',  name: 'Hanging Leg Raises',  blockId: 'lower', trackingType: 'reps', setsTarget: '3x12-15',   notes: '', order: 5, isActive: true },
  { id: 'goblet-squat',        name: 'Goblet Squat',        blockId: 'lower', trackingType: 'kg',   setsTarget: '2x15',      notes: '', order: 6, isActive: true },

  // ── Full Body ────────────────────────────────────────────────────────
  { id: 'deadlift',              name: 'Deadlift',              blockId: 'full', trackingType: 'kg',   setsTarget: '4x5-8',   notes: '', order: 0, isActive: true },
  { id: 'overhead-press',        name: 'Overhead Press',        blockId: 'full', trackingType: 'kg',   setsTarget: '4x8-10',  notes: '', order: 1, isActive: true },
  { id: 'lat-pulldown',          name: 'Lat Pulldown',          blockId: 'full', trackingType: 'kg',   setsTarget: '3x10-12', notes: '', order: 2, isActive: true },
  { id: 'goblet-squat-full',     name: 'Goblet Squat',          blockId: 'full', trackingType: 'kg',   setsTarget: '3x12-15', notes: '', order: 3, isActive: true },
  { id: 'flat-dumbbell-press',   name: 'Flat Dumbbell Press',   blockId: 'full', trackingType: 'kg',   setsTarget: '3x10-12', notes: '', order: 4, isActive: true },
  { id: 'kettlebell-swings-full',name: 'Kettlebell Swings',     blockId: 'full', trackingType: 'kg',   setsTarget: '4x15-20', notes: '', order: 5, isActive: true },
  { id: 'ab-wheel-plank',        name: 'Ab Wheel / Plank',      blockId: 'full', trackingType: 'time', setsTarget: '3x45s',   notes: '', order: 6, isActive: true },
  { id: 'mobility-work',         name: 'Mobility Work',         blockId: 'full', trackingType: 'reps', setsTarget: '2x rounds', notes: '', order: 7, isActive: true },

  // ── Kettlebell ───────────────────────────────────────────────────────
  { id: 'squat-pushup-warmup', name: 'Squat / Pushup Warmup', blockId: 'kettlebell', trackingType: 'reps', setsTarget: '2x10',    notes: '', order: 0, isActive: true },
  { id: 'kettlebell-swings',   name: 'Kettlebell Swings',     blockId: 'kettlebell', trackingType: 'kg',   setsTarget: '4x15-20', notes: '', order: 1, isActive: true },
  { id: 'kettlebell-press',    name: 'Kettlebell Press',      blockId: 'kettlebell', trackingType: 'kg',   setsTarget: '3x8-10',  notes: '', order: 2, isActive: true },
  { id: 'windmill',            name: 'Windmill',              blockId: 'kettlebell', trackingType: 'kg',   setsTarget: '3x8/side', notes: '', order: 3, isActive: true },
  { id: 'renegade-row',        name: 'Renegade Row',          blockId: 'kettlebell', trackingType: 'kg',   setsTarget: '3x8/side', notes: '', order: 4, isActive: true },
];

export async function seedDefaultData(db) {
  const seeded = await getSetting(db, 'default_data_seeded');
  if (seeded) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['blocks', 'exercises', 'settings'], 'readwrite');
    const blocks = tx.objectStore('blocks');
    const exercises = tx.objectStore('exercises');
    const settings = tx.objectStore('settings');

    for (const b of DEFAULT_BLOCKS) blocks.put(b);
    for (const e of DEFAULT_EXERCISES) exercises.put(e);

    settings.put({ key: 'default_data_seeded', value: true });
    settings.put({ key: 'current_cycle', value: 1 });
    settings.put({ key: 'current_week', value: 1 });

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export { DEFAULT_BLOCKS, DEFAULT_EXERCISES };
