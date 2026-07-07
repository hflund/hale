let _activeTab = 'dashboard';
let _onTabChange = null;
let _el = null;

const TABS = [
  { id: 'dashboard', icon: 'house',              label: 'Dashboard' },
  { id: 'log',       icon: 'plus',                label: 'Log' },
  { id: 'progress',  icon: 'trending-up',         label: 'Progress' },
  { id: 'tools',     icon: 'sliders-horizontal',  label: 'Tools' },
];

export function mountBottomNav(container, onTabChange) {
  _onTabChange = onTabChange;

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'tablist');

  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.tab = tab.id;
    btn.setAttribute('aria-label', tab.label);
    btn.innerHTML = `
      <svg data-lucide="${tab.icon}" width="${getComputedStyle(document.documentElement).getPropertyValue('--icon-md') || '20'}" height="20" stroke-width="1.5"></svg>
    `;
    btn.addEventListener('click', () => {
      if (tab.id !== 'tools') setActiveTab(tab.id);
      _onTabChange(tab.id);
    });
    nav.appendChild(btn);
  }

  container.appendChild(nav);
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
