import { getSetting, setSetting } from '../data/db.js';
import { exportCSV } from '../data/export.js';
import { mountSettings } from './ExerciseLibrary.js';

let _overlay = null;
let _sheet = null;

export async function openTools(db, onNavigate) {
  removeTools();

  const lastExport = await getSetting(db, 'last_export_timestamp');

  _overlay = document.createElement('div');
  _overlay.className = 'sheet-overlay';
  _overlay.addEventListener('click', (e) => {
    if (e.target === _overlay) removeTools();
  });

  _sheet = document.createElement('div');
  _sheet.className = 'sheet';

  const handle = document.createElement('div');
  handle.className = 'sheet-handle';
  _sheet.appendChild(handle);

  const inner = document.createElement('div');
  inner.className = 'sheet-inner';

  // Title
  const title = document.createElement('h2');
  title.style.cssText = `font-size:var(--text-h2);font-weight:var(--weight-bold);margin-bottom:var(--space-5);`;
  title.textContent = 'Tools';
  inner.appendChild(title);

  // ── Unit Converter ─────────────────────────────────────────────────

  const convLabel = document.createElement('div');
  convLabel.className = 'section-label';
  convLabel.style.paddingTop = '0';
  convLabel.textContent = 'Unit Converter';
  inner.appendChild(convLabel);

  let lbsValue = '';
  let kgValue = '';

  const convRow = document.createElement('div');
  convRow.className = 'converter-row';

  const lbsInput = document.createElement('input');
  lbsInput.type = 'number';
  lbsInput.inputMode = 'decimal';
  lbsInput.placeholder = 'lb';
  lbsInput.setAttribute('aria-label', 'pounds');

  const lbsLabel = document.createElement('span');
  lbsLabel.className = 'weight-unit';
  lbsLabel.textContent = 'lb';

  const swapBtn = document.createElement('button');
  swapBtn.className = 'btn-icon';
  swapBtn.setAttribute('aria-label', 'Swap units');
  swapBtn.innerHTML = `<svg data-lucide="arrow-left-right" width="20" height="20" stroke-width="1.5"></svg>`;

  const kgInput = document.createElement('input');
  kgInput.type = 'number';
  kgInput.inputMode = 'decimal';
  kgInput.placeholder = 'kg';
  kgInput.setAttribute('aria-label', 'kilograms');

  const kgLabel = document.createElement('span');
  kgLabel.className = 'weight-unit';
  kgLabel.textContent = 'kg';

  lbsInput.addEventListener('input', () => {
    const v = parseFloat(lbsInput.value);
    if (!isNaN(v)) {
      kgInput.value = (v * 0.453592).toFixed(2);
    } else {
      kgInput.value = '';
    }
  });

  kgInput.addEventListener('input', () => {
    const v = parseFloat(kgInput.value);
    if (!isNaN(v)) {
      lbsInput.value = (v / 0.453592).toFixed(2);
    } else {
      lbsInput.value = '';
    }
  });

  swapBtn.addEventListener('click', () => {
    const tmp = lbsInput.value;
    lbsInput.value = kgInput.value;
    kgInput.value = tmp;
  });

  convRow.appendChild(lbsInput);
  convRow.appendChild(lbsLabel);
  convRow.appendChild(swapBtn);
  convRow.appendChild(kgInput);
  convRow.appendChild(kgLabel);
  inner.appendChild(convRow);

  // ── Export ────────────────────────────────────────────────────────

  const exportLabel = document.createElement('div');
  exportLabel.className = 'section-label';
  exportLabel.textContent = 'Data';
  inner.appendChild(exportLabel);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-secondary';
  exportBtn.style.width = 'auto';
  exportBtn.innerHTML = `<svg data-lucide="download" width="20" height="20" stroke-width="1.5"></svg> Export training data`;
  exportBtn.addEventListener('click', async () => {
    const result = await exportCSV(db);
    if (!result) {
      statusEl.textContent = 'Nothing to export yet.';
      statusEl.className = 'export-status';
    } else {
      statusEl.textContent = 'Exported successfully.';
      statusEl.className = 'export-status';
      // Update display
      setTimeout(() => renderExportStatus(statusEl, Date.now()), 1000);
    }
  });
  inner.appendChild(exportBtn);

  const statusEl = document.createElement('div');
  statusEl.style.marginTop = 'var(--space-2)';
  renderExportStatus(statusEl, lastExport);
  inner.appendChild(statusEl);

  // ── Library ────────────────────────────────────────────────────────

  const libraryLabel = document.createElement('div');
  libraryLabel.className = 'section-label';
  libraryLabel.textContent = 'Programme';
  inner.appendChild(libraryLabel);

  const libBtn = document.createElement('button');
  libBtn.className = 'btn btn-secondary';
  libBtn.style.width = 'auto';
  libBtn.innerHTML = `<svg data-lucide="list" width="20" height="20" stroke-width="1.5"></svg> Exercise Library`;
  libBtn.addEventListener('click', () => {
    removeTools();
    onNavigate('library');
  });
  inner.appendChild(libBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn btn-secondary';
  settingsBtn.style.cssText = 'width:auto;margin-top:var(--space-3);';
  settingsBtn.innerHTML = `<svg data-lucide="settings" width="20" height="20" stroke-width="1.5"></svg> Settings`;
  settingsBtn.addEventListener('click', () => {
    removeTools();
    onNavigate('settings');
  });
  inner.appendChild(settingsBtn);

  // ── About ──────────────────────────────────────────────────────────

  const aboutLabel = document.createElement('div');
  aboutLabel.className = 'section-label';
  aboutLabel.textContent = 'About';
  inner.appendChild(aboutLabel);

  const about = document.createElement('div');
  about.style.cssText = `font-size:var(--text-body);color:var(--color-ink-muted);line-height:var(--leading-body);`;
  about.innerHTML = `Hale. tracks your resistance training sessions.<br>Data is stored locally on this device.`;
  inner.appendChild(about);

  _sheet.appendChild(inner);
  _overlay.appendChild(_sheet);
  document.body.appendChild(_overlay);

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [_sheet] });
}

function renderExportStatus(el, lastExport) {
  if (!lastExport) {
    el.textContent = 'Never exported';
    el.className = 'export-status warn';
    return;
  }
  const diffMs = Date.now() - lastExport;
  const days = Math.floor(diffMs / 86400000);
  el.className = days > 30 ? 'export-status warn' : 'export-status';
  if (days === 0) el.textContent = 'Last export: today';
  else if (days === 1) el.textContent = 'Last export: yesterday';
  else if (days < 30) el.textContent = `Last export: ${new Date(lastExport).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  else el.textContent = `Last export: ${Math.round(days / 30)} month${days > 60 ? 's' : ''} ago`;
}

export function removeTools() {
  if (_overlay) { _overlay.remove(); _overlay = null; _sheet = null; }
}
