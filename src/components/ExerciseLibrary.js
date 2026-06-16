import {
  getAllBlocks, getAllExercises, putBlock, putExercise, getSetting, setSetting,
} from '../data/db.js';

// ── Exercise Library screen ────────────────────────────────────────────────

export function mountExerciseLibrary(appContainer, db, onBack) {
  const screen = buildScreen('Exercise Library', onBack);
  const body = screen.querySelector('.screen-body');

  loadLibrary(body, db);
  appContainer.appendChild(screen);
}

async function loadLibrary(body, db) {
  body.innerHTML = '';
  const [blocks, exercises] = await Promise.all([getAllBlocks(db), getAllExercises(db)]);
  const activeBlocks = blocks.filter(b => b.isActive).sort((a, b) => a.order - b.order);

  const stack = document.createElement('div');
  stack.className = 'section-stack';

  for (const block of activeBlocks) {
    const blockLabel = document.createElement('div');
    blockLabel.className = 'section-label';
    blockLabel.textContent = block.name;
    stack.appendChild(blockLabel);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '0';

    const blockExercises = exercises
      .filter(e => e.blockId === block.id && e.isActive)
      .sort((a, b) => a.order - b.order);

    for (const ex of blockExercises) {
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:var(--space-4) var(--space-5);
        border-bottom:var(--border-sub);
      `;

      const info = document.createElement('div');
      info.innerHTML = `
        <div style="font-size:var(--text-body);font-weight:var(--weight-medium);">${ex.name}</div>
        <div style="font-size:var(--text-small);color:var(--color-ink-muted);">${ex.setsTarget} · ${trackingLabel(ex.trackingType)}</div>
      `;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-icon';
      removeBtn.setAttribute('aria-label', `Remove ${ex.name}`);
      removeBtn.innerHTML = `<svg data-lucide="x" width="16" height="16" stroke-width="2"></svg>`;
      removeBtn.addEventListener('click', async () => {
        ex.isActive = false;
        await putExercise(db, ex);
        row.remove();
      });

      row.appendChild(info);
      row.appendChild(removeBtn);
      card.appendChild(row);
    }

    // Add exercise row
    const addRow = document.createElement('div');
    addRow.style.cssText = `padding:var(--space-4) var(--space-5);`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary';
    addBtn.style.cssText = 'width:auto;font-size:var(--text-small);min-height:36px;padding:var(--space-2) var(--space-4);';
    addBtn.innerHTML = `<svg data-lucide="plus" width="14" height="14" stroke-width="2"></svg> Add exercise`;
    addBtn.addEventListener('click', () => showAddExercisePrompt(card, db, block.id, exercises, () => loadLibrary(body, db)));
    addRow.appendChild(addBtn);
    card.appendChild(addRow);

    stack.appendChild(card);
  }

  // Add new block
  const newBlockBtn = document.createElement('button');
  newBlockBtn.className = 'btn btn-secondary';
  newBlockBtn.innerHTML = `<svg data-lucide="plus" width="20" height="20" stroke-width="1.5"></svg> New Block`;
  newBlockBtn.addEventListener('click', () => showNewBlockPrompt(body, db, () => loadLibrary(body, db)));
  stack.appendChild(newBlockBtn);

  body.appendChild(stack);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [body] });
}

function showAddExercisePrompt(card, db, blockId, allExercises, onDone) {
  // Simple inline form
  const form = document.createElement('div');
  form.style.cssText = `padding:var(--space-4) var(--space-5);background:var(--color-bg);border-top:var(--border-sub);`;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Exercise name';
  nameInput.style.marginBottom = 'var(--space-3)';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'input';
  typeSelect.style.marginBottom = 'var(--space-3)';
  for (const [val, label] of [['kg','Weight (kg)'],['reps','Reps'],['time','Time'],['bodyweight','Bodyweight'],['bodyweight_kg','Bodyweight + kg']]) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    typeSelect.appendChild(opt);
  }

  const setsInput = document.createElement('input');
  setsInput.type = 'text';
  setsInput.placeholder = 'Sets target e.g. 3x10-12';
  setsInput.style.marginBottom = 'var(--space-3)';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:var(--space-3);';

  const save = document.createElement('button');
  save.className = 'btn btn-primary';
  save.style.cssText = 'flex:1;min-height:40px;';
  save.textContent = 'Add';
  save.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const id = slugify(name) + '-' + blockId;
    const maxOrder = allExercises.filter(e => e.blockId === blockId).reduce((m, e) => Math.max(m, e.order), -1);
    await putExercise(db, {
      id, name, blockId,
      trackingType: typeSelect.value,
      setsTarget: setsInput.value || '3x10-12',
      notes: '', order: maxOrder + 1, isActive: true,
    });
    form.remove();
    onDone();
  });

  const cancel = document.createElement('button');
  cancel.className = 'btn btn-secondary';
  cancel.style.cssText = 'flex:1;min-height:40px;';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => form.remove());

  btnRow.appendChild(save);
  btnRow.appendChild(cancel);
  form.appendChild(nameInput);
  form.appendChild(typeSelect);
  form.appendChild(setsInput);
  form.appendChild(btnRow);
  card.appendChild(form);
  nameInput.focus();
}

function showNewBlockPrompt(body, db, onDone) {
  const form = document.createElement('div');
  form.className = 'card';
  form.style.cssText = ``;

  const label = document.createElement('div');
  label.className = 'section-label';
  label.style.paddingTop = '0';
  label.textContent = 'New Block';
  form.appendChild(label);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Block name';
  nameInput.style.marginBottom = 'var(--space-4)';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:var(--space-3);';

  const save = document.createElement('button');
  save.className = 'btn btn-primary';
  save.style.cssText = 'flex:1;';
  save.textContent = 'Create';
  save.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const allBlocks = await getAllBlocks(db);
    const maxOrder = allBlocks.reduce((m, b) => Math.max(m, b.order), -1);
    await putBlock(db, { id: slugify(name), name, order: maxOrder + 1, isActive: true, isDefault: false });
    form.remove();
    onDone();
  });

  const cancel = document.createElement('button');
  cancel.className = 'btn btn-secondary';
  cancel.style.cssText = 'flex:1;';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => form.remove());

  btnRow.appendChild(save);
  btnRow.appendChild(cancel);
  form.appendChild(nameInput);
  form.appendChild(btnRow);
  body.insertBefore(form, body.firstChild);
  nameInput.focus();
}

// ── Settings screen ────────────────────────────────────────────────────────

export function mountSettings(appContainer, db, onBack) {
  const screen = buildScreen('Settings', onBack);
  const body = screen.querySelector('.screen-body');
  loadSettings(body, db);
  appContainer.appendChild(screen);
}

async function loadSettings(body, db) {
  const [goal, bw] = await Promise.all([
    getSetting(db, 'weekly_goal'),
    getSetting(db, 'bodyweight_kg'),
  ]);

  const stack = document.createElement('div');
  stack.className = 'section-stack';

  // Weekly goal
  const goalCard = document.createElement('div');
  goalCard.className = 'card';
  goalCard.style.display = 'flex';
  goalCard.style.flexDirection = 'column';
  goalCard.style.gap = 'var(--space-4)';

  const goalLabel = document.createElement('div');
  goalLabel.className = 'section-label';
  goalLabel.style.cssText += 'padding-top:0;';
  goalLabel.textContent = 'Weekly Session Goal';
  goalCard.appendChild(goalLabel);

  let selectedGoal = goal || 3;
  const selector = document.createElement('div');
  selector.className = 'number-selector';
  for (let i = 1; i <= 5; i++) {
    const tile = document.createElement('div');
    tile.className = `number-tile${selectedGoal === i ? ' selected' : ''}`;
    tile.textContent = i;
    tile.addEventListener('click', async () => {
      selectedGoal = i;
      selector.querySelectorAll('.number-tile').forEach((t, idx) => {
        t.classList.toggle('selected', idx + 1 === i);
      });
      await setSetting(db, 'weekly_goal', i);
    });
    selector.appendChild(tile);
  }
  goalCard.appendChild(selector);
  stack.appendChild(goalCard);

  // Bodyweight
  const bwCard = document.createElement('div');
  bwCard.className = 'card';
  bwCard.style.display = 'flex';
  bwCard.style.flexDirection = 'column';
  bwCard.style.gap = 'var(--space-4)';

  const bwLabel = document.createElement('div');
  bwLabel.className = 'section-label';
  bwLabel.style.cssText += 'padding-top:0;';
  bwLabel.textContent = 'Bodyweight';

  const bwRow = document.createElement('div');
  bwRow.className = 'weight-row';
  const bwInput = document.createElement('input');
  bwInput.type = 'number';
  bwInput.inputMode = 'decimal';
  bwInput.placeholder = '0';
  bwInput.value = bw || '';
  bwInput.style.maxWidth = '120px';
  const bwUnit = document.createElement('span');
  bwUnit.className = 'weight-unit';
  bwUnit.textContent = 'kg';

  let saveTimeout;
  bwInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const v = parseFloat(bwInput.value);
      if (!isNaN(v)) await setSetting(db, 'bodyweight_kg', v);
    }, 600);
  });

  bwRow.appendChild(bwInput);
  bwRow.appendChild(bwUnit);
  bwCard.appendChild(bwLabel);
  bwCard.appendChild(bwRow);
  stack.appendChild(bwCard);

  // Data notice
  const notice = document.createElement('div');
  notice.style.cssText = `font-size:var(--text-small);color:var(--color-ink-muted);line-height:var(--leading-body);`;
  notice.textContent = 'Data is stored locally on this device only. Export regularly to keep a backup.';
  stack.appendChild(notice);

  body.appendChild(stack);
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function buildScreen(title, onBack) {
  const el = document.createElement('div');
  el.className = 'screen-overlay';

  const header = document.createElement('div');
  header.className = 'screen-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-icon';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.innerHTML = `<svg data-lucide="chevron-left" width="20" height="20" stroke-width="2"></svg>`;
  backBtn.addEventListener('click', () => { el.remove(); onBack(); });

  const heading = document.createElement('h1');
  heading.textContent = title;

  header.appendChild(backBtn);
  header.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'screen-body';

  el.appendChild(header);
  el.appendChild(body);

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [header] });
  return el;
}

function trackingLabel(type) {
  return { kg: 'Weight', reps: 'Reps', time: 'Time', bodyweight: 'Bodyweight', bodyweight_kg: 'BW + kg' }[type] || type;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
