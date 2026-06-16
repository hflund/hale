import { openDB, getSetting, migrateFromFitPal } from './data/db.js';
import { seedDefaultData } from './data/schema.js';
import { mountBottomNav, setActiveTab } from './components/BottomNav.js';
import { mountOnboarding } from './components/Onboarding.js';
import { mountDashboard } from './components/Dashboard.js';
import { mountProgress } from './components/Progress.js';
import { openLogSession } from './components/LogSession.js';
import { openTools } from './components/Tools.js';
import { mountExerciseLibrary, mountSettings } from './components/ExerciseLibrary.js';

let _db = null;
let _currentTab = 'dashboard';
const appEl = document.getElementById('app');

async function init() {
  _db = await openDB();
  await seedDefaultData(_db);
  await migrateFromFitPal(_db);

  const onboardingDone = await getSetting(_db, 'onboarding_complete');

  if (!onboardingDone) {
    mountOnboarding(appEl, _db, () => startApp());
  } else {
    startApp();
  }
}

function startApp() {
  // Clear onboarding if present
  appEl.innerHTML = '';

  // Content container
  const contentEl = document.createElement('div');
  contentEl.id = 'tab-content';
  appEl.appendChild(contentEl);

  // Bottom nav
  mountBottomNav(appEl, handleTabChange);

  // Navigate to dashboard
  navigateTo('dashboard');

  // Listen for internal navigation events
  document.addEventListener('hale:navigate', (e) => {
    navigateTo(e.detail);
  });
}

function handleTabChange(tab) {
  if (tab === 'log') {
    openLogSession(_db, () => {
      // Refresh current tab after session ends
      if (_currentTab === 'dashboard') navigateTo('dashboard');
    });
    return;
  }

  if (tab === 'tools') {
    openTools(_db, (dest) => navigateTo(dest));
    return;
  }

  navigateTo(tab);
}

async function navigateTo(dest) {
  const contentEl = document.getElementById('tab-content');
  if (!contentEl) return;

  if (dest === 'library') {
    mountExerciseLibrary(appEl, _db, () => {});
    return;
  }

  if (dest === 'settings') {
    mountSettings(appEl, _db, () => {});
    return;
  }

  // Main tabs
  contentEl.innerHTML = '';
  _currentTab = dest;

  if (dest !== 'tools') {
    setActiveTab(dest);
  }

  if (dest === 'dashboard') {
    await mountDashboard(contentEl, _db);
  } else if (dest === 'progress') {
    contentEl._db = _db;
    await mountProgress(contentEl);
  }
}

init().catch(err => {
  console.error('Hale init failed:', err);
  appEl.innerHTML = `<div style="padding:24px;color:#1C1814;font-family:Manrope,sans-serif;">
    <p>Something went wrong loading Hale.</p>
    <p style="font-size:12px;color:#78706A;margin-top:8px;">${err.message}</p>
  </div>`;
});
