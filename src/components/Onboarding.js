import { setSetting } from '../data/db.js';

export function mountOnboarding(container, db, onComplete) {
  let screen = 1;
  let goal = null;

  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: var(--space-10) var(--space-6);
    background: var(--color-bg);
    text-align: center;
    gap: var(--space-8);
  `;

  function render() {
    el.innerHTML = '';

    // Logo mark
    const logo = document.createElement('div');
    logo.style.cssText = `
      font-size: var(--text-display);
      font-weight: var(--weight-bold);
      color: var(--color-accent);
      letter-spacing: var(--tracking-tight);
      line-height: var(--leading-tight);
    `;
    logo.textContent = 'H.';
    el.appendChild(logo);

    if (screen === 1) renderScreen1();
    else renderScreen2();
  }

  function renderScreen1() {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-8);width:100%;';

    const heading = document.createElement('div');
    heading.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-3);';
    heading.innerHTML = `
      <h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);line-height:var(--leading-tight);letter-spacing:var(--tracking-tight);">Welcome to Hale.</h1>
      <p style="font-size:var(--text-body);color:var(--color-ink-muted);line-height:var(--leading-body);">How many sessions per week is your goal?</p>
    `;

    const selector = document.createElement('div');
    selector.className = 'number-selector';
    for (let i = 1; i <= 5; i++) {
      const tile = document.createElement('div');
      tile.className = `number-tile${goal === i ? ' selected' : ''}`;
      tile.textContent = i;
      tile.addEventListener('click', () => {
        goal = i;
        render();
      });
      selector.appendChild(tile);
    }

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Continue';
    btn.disabled = goal === null;
    btn.addEventListener('click', () => {
      screen = 2;
      render();
    });

    body.appendChild(heading);
    body.appendChild(selector);
    body.appendChild(btn);
    el.appendChild(body);
  }

  function renderScreen2() {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-8);width:100%;';

    const text = document.createElement('div');
    text.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-4);';
    text.innerHTML = `
      <h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);line-height:var(--leading-tight);letter-spacing:var(--tracking-tight);">Your programme starts with four blocks:</h1>
      <p style="font-size:var(--text-body);color:var(--color-ink-muted);line-height:var(--leading-body);">
        Upper Body, Lower Body, Full Body, and Kettlebell.
      </p>
      <p style="font-size:var(--text-body);color:var(--color-ink-muted);line-height:var(--leading-body);">
        You can add or remove exercises within any block, or create entirely new blocks to suit your training.
      </p>
      <p style="font-size:var(--text-body);color:var(--color-ink-muted);line-height:var(--leading-body);">
        Everything is editable from the Library section in Tools.
      </p>
      <p style="font-size:var(--text-small);color:var(--color-ink-muted);line-height:var(--leading-body);font-style:normal;">
        Hale stores your data locally on this device. Clearing your browser data will permanently delete your training history. Export monthly to keep a backup.
      </p>
    `;

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Start training';
    btn.addEventListener('click', async () => {
      await setSetting(db, 'weekly_goal', goal);
      await setSetting(db, 'onboarding_complete', true);
      await setSetting(db, 'risk_notice_seen', true);
      el.remove();
      onComplete();
    });

    body.appendChild(text);
    body.appendChild(btn);
    el.appendChild(body);
  }

  render();
  container.appendChild(el);
}
