# Hale.

Hale. is a personal gym session tracker for resistance training. It runs entirely in the browser with no server, no account, and no cloud. Your data lives on your device in IndexedDB. It is designed for one to three people who train seriously and want a precise, private record of their progress.

---

## Setup

No build step required.

1. Clone or download this repository.
2. Serve the `hale/` directory over HTTP. Any static file server works:
   ```
   npx serve hale
   ```
   Or use the VS Code Live Server extension, Python's `http.server`, or deploy directly to GitHub Pages.
3. Open in a mobile browser (Chrome on Android, Safari on iOS). For the best experience, add to your home screen using the browser's "Add to Home Screen" option.

> **Do not open `index.html` directly as a `file://` URL.** ES modules and IndexedDB require an HTTP origin.

---

## Data Storage

All data is stored in the browser's IndexedDB under the database name `HaleDB`. Nothing is sent anywhere. There is no account. There is no sync.

**What persists:** sessions, sets, exercises, blocks, settings — everything.

**What does not persist:** if you clear your browser's site data, all training history is permanently deleted.

**Export regularly.** Use the Export button in Tools to download a CSV of all your sessions and sets. Do this at least once a month.

---

## Adding a New Exercise

1. Open the app and tap the **Tools** tab (bottom right).
2. Tap **Exercise Library**.
3. Find the block you want to add to (Upper Body, Lower Body, etc.).
4. Tap **Add exercise** at the bottom of that block.
5. Enter the exercise name, tracking type, and sets target.
6. Tap **Add**.

The exercise will appear immediately in that block when you log a session.

---

## Adding a New Block

1. Open the app and tap the **Tools** tab.
2. Tap **Exercise Library**.
3. Scroll to the bottom and tap **New Block**.
4. Enter a name and tap **Create**.
5. The new block will appear in the Library and in the Log session screen.

Add exercises to the block using the **Add exercise** button that appears within it.

---

## Starting a New Cycle

Hale. does not automatically manage cycles. To begin a new training cycle:

1. Open Tools → Settings.
2. (Optional) Note your current cycle number for your records.
3. Update the `current_cycle` value via the browser's DevTools console if you need to change it:
   ```javascript
   // Open DevTools → Console
   const db = await new Promise(r => { const req = indexedDB.open('HaleDB', 1); req.onsuccess = () => r(req.result); });
   const tx = db.transaction('settings', 'readwrite');
   tx.objectStore('settings').put({ key: 'current_cycle', value: 2 });
   ```

All historical data from previous cycles is preserved. Sessions carry their cycle number and nothing is deleted when a new cycle begins.

---

## Schema Version History

| DB Version | Changes |
|---|---|
| 1 (initial) | `sessions`, `sets`, `exercises`, `blocks`, `settings` stores created. Indexes on all foreign key fields. Migration function reads from `FitPalDB` (the previous app's database) and imports into HaleDB on first open if `migration_complete` is not set. |

**Schema change policy:** All future versions add fields or stores only. Existing fields and store names are never removed or renamed. The `onupgradeneeded` handler must remain backwards-compatible from any prior version.

---

*Hale. — Version 1.0*
