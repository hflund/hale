let _activeTab = 'dashboard';
let _onTabChange = null;
let _el = null;

const TABS = [
  { id: 'dashboard', icon: 'house',              label: 'Dashboard' },
  { id: '_fab',      icon: null,                  label: null },
  { id: 'progress',  icon: 'trending-up',         label: 'Progress' },
  { id: 'tools',     icon: 'sliders-horizontal',  label: 'Tools' },
];

export function mountBottomNav(container, onTabChange) {
  _onTabChange = onTabChange;

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'tablist');

  for (const tab of TABS) {
    if (tab.id === '_fab') {
      // FAB placeholder — actual FAB is rendered separately
      const spacer = document.createElement('div');
      nav.appendChild(spacer);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.tab = tab.id;
    btn.innerHTML = `
      <svg data-lucide="${tab.icon}" width="${getComputedStyle(document.documentElement).getPropertyValue('--icon-md') || '20'}" height="20" stroke-width="1.5"></svg>
      <span class="nav-tab-label">${tab.label}</span>
    `;
    btn.addEventListener('click', () => {
      if (tab.id !== 'tools') setActiveTab(tab.id);
      _onTabChange(tab.id);
    });
    nav.appendChild(btn);
  }

  // FAB
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.setAttribute('aria-label', 'Log session');
  fab.innerHTML = `<svg data-lucide="plus" width="24" height="24" stroke-width="1.5"></svg>`;
  fab.addEventListener('click', () => _onTabChange('log'));

  container.appendChild(nav);
  container.appendChild(fab);
  _el = nav;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function setActiveTab(tabId) {
  _activeTab = tabId;
  if (!_el) return;
  _el.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabId ? 'true' : 'false');
  });
}
