// ==========================================================================
// MOID (RAIS-Pro) — Interactive Prototype Engine & FloatingDetailModal
// ==========================================================================

let globalOriginRect = null;
let isSourceViewActive = false;

(function () {
  // 1. Initialize Theme from localStorage
  const savedTheme = localStorage.getItem('moid_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeButtonLabel(savedTheme);

  // 2. Click tracker for origin card FLIP animation
  window.addEventListener('click', (e) => {
    const card = e.target.closest('.kpi-card, .standard-card, .funnel-gate, [role="button"], button');
    if (card) {
      globalOriginRect = card.getBoundingClientRect();
    }
  }, true);

  // 3. Global Hotkey listener for Command Palette (⌘K) & Escape
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
    if (e.key === 'Escape') {
      closeFloatingModal();
      closeCommandPalette();
    }
  });
})();

function toggleThemeMode() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = (current === 'dark' || current === 'obsidian') ? 'light' : 'dark';

  document.body.setAttribute('data-theme', next);
  localStorage.setItem('moid_theme', next);
  updateThemeButtonLabel(next);
  showToast(`Theme switched to ${next === 'dark' ? 'Industrial Obsidian Dark' : 'Clinical Porcelain Light'}`);
}

function updateThemeButtonLabel(theme) {
  const labels = document.querySelectorAll('#theme-btn-text');
  const isDark = (theme === 'dark' || theme === 'obsidian');
  
  labels.forEach(l => {
    if (isDark) {
      l.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>Light Mode
      `;
    } else {
      l.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>Dark Mode
      `;
    }
  });
}

function setGrain(btn) {
  document.querySelectorAll('.grain-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  showToast(`Interval set to ${btn.innerText} (${btn.innerText === 'M' ? 'Monthly' : btn.innerText === 'D' ? 'Daily' : btn.innerText === 'W' ? 'Weekly' : 'Financial Year'})`);
}

// ==========================================================================
// FLOATING DETAIL MODAL (Provenance Engine & Formula HUD)
// ==========================================================================

function openFloatingDetail(options) {
  const modal = document.getElementById('floating-detail-modal');
  const panel = document.getElementById('floating-modal-panel');
  if (!modal || !panel) return;

  const {
    title = 'Metric Drill-down',
    value = '8.07%',
    detail = '1,095 rejected of 13,562 checked',
    insight = 'Overall rejection rate is 8.07%, a 0.57% pt deviation above plant limit. Visual Inspection carries 61.9% of total rejections.',
    formula = 'Rejection Rate = (Total Rejections / Total Inflow Checked) × 100<br/>= (1,095 / 13,562) × 100 = <strong>8.0740%</strong>',
    chartType = 'trend'
  } = options || {};

  document.getElementById('floating-title').innerText = title;
  document.getElementById('floating-value-badge').innerText = value;
  document.getElementById('floating-computed-val').innerText = value;
  document.getElementById('floating-computed-detail').innerText = detail;
  document.getElementById('floating-insight-text').innerText = insight;
  document.getElementById('floating-formula-hud').innerHTML = formula;

  // Reset to default drilldown chart view
  isSourceViewActive = false;
  updateSourceViewToggle();

  modal.classList.add('active');

  // FLIP Morph Animation from origin card rect
  if (globalOriginRect) {
    const targetRect = panel.getBoundingClientRect();
    const originCenterX = globalOriginRect.left + globalOriginRect.width / 2;
    const originCenterY = globalOriginRect.top + globalOriginRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const transX = originCenterX - targetCenterX;
    const transY = originCenterY - targetCenterY;
    const scaleX = Math.max(0.1, globalOriginRect.width / targetRect.width);
    const scaleY = Math.max(0.1, globalOriginRect.height / targetRect.height);

    panel.animate(
      [
        {
          transform: `translate3d(${transX}px, ${transY}px, 0) scale(${scaleX}, ${scaleY})`,
          opacity: 0.35,
          borderRadius: 'var(--r-card)'
        },
        {
          transform: 'translate3d(0, 0, 0) scale(1)',
          opacity: 1,
          borderRadius: 'var(--r-outer)'
        }
      ],
      {
        duration: 280,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      }
    );
  }
}

function toggleSourceView() {
  isSourceViewActive = !isSourceViewActive;
  updateSourceViewToggle();
  if (isSourceViewActive) {
    setTimeout(drawBezierBeam, 50);
  }
}

function updateSourceViewToggle() {
  const panel = document.getElementById('floating-modal-panel');
  const btn = document.getElementById('toggle-source-btn');
  const chartPane = document.getElementById('drilldown-chart-pane');
  const sourcePane = document.getElementById('source-split-pane');

  if (!panel || !btn) return;

  if (isSourceViewActive) {
    panel.classList.add('source-expanded');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>Hide Source
    `;
    btn.className = 'btn-pill btn-pill-primary';
    if (chartPane) chartPane.classList.add('hidden');
    if (sourcePane) sourcePane.classList.add('active');
  } else {
    panel.classList.remove('source-expanded');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>View Source
    `;
    btn.className = 'btn-pill';
    if (chartPane) chartPane.classList.remove('hidden');
    if (sourcePane) sourcePane.classList.remove('active');
  }
}

function closeFloatingModal() {
  const modal = document.getElementById('floating-detail-modal');
  if (modal) modal.classList.remove('active');
}

function drawBezierBeam(targetRow) {
  const anchor = document.getElementById('floating-computed-anchor');
  const row = targetRow || document.querySelector('.ledger-source-row');
  const svg = document.getElementById('bezier-beam-svg');
  const container = document.getElementById('source-split-pane');

  if (!anchor || !row || !svg || !container || !isSourceViewActive) return;

  const aRect = anchor.getBoundingClientRect();
  const rRect = row.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();

  const x1 = aRect.right - cRect.left;
  const y1 = aRect.top + aRect.height / 2 - cRect.top;
  const x2 = rRect.left - cRect.left + 16;
  const y2 = rRect.top + rRect.height / 2 - cRect.top;

  const dx = (x2 - x1) * 0.5;
  const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--cobalt)" stop-opacity="0.8" />
        <stop offset="100%" stop-color="var(--cobalt)" stop-opacity="0.2" />
      </linearGradient>
    </defs>
    <path d="${pathData}" fill="none" stroke="url(#beamGrad)" stroke-width="2" stroke-dasharray="4 2" />
    <circle cx="${x1}" cy="${y1}" r="3.5" fill="var(--cobalt)" />
    <circle cx="${x2}" cy="${y2}" r="3.5" fill="var(--cobalt)" />
  `;
}

function switchSourceSurface(surface) {
  document.querySelectorAll('.surface-tab-btn').forEach(b => b.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  const classifiedTable = document.getElementById('classified-source-table');
  const spreadsheetTable = document.getElementById('spreadsheet-source-table');

  if (!classifiedTable || !spreadsheetTable) return;

  if (surface === 'spreadsheet') {
    classifiedTable.style.display = 'none';
    spreadsheetTable.style.display = 'table';
  } else {
    classifiedTable.style.display = 'table';
    spreadsheetTable.style.display = 'none';
  }
  setTimeout(drawBezierBeam, 30);
}

function toggleCommandPalette() {
  const pal = document.getElementById('command-palette-modal');
  if (pal) {
    pal.classList.toggle('active');
    if (pal.classList.contains('active')) {
      const input = pal.querySelector('input');
      if (input) setTimeout(() => input.focus(), 50);
    }
  }
}

function closeCommandPalette() {
  const pal = document.getElementById('command-palette-modal');
  if (pal) pal.classList.remove('active');
}

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--cobalt)"></span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 160ms ease';
    setTimeout(() => toast.remove(), 180);
  }, 2200);
}
