import { escapeHtml, hydrateIcons, iconSvg, showToast } from './icons.js';
import { CLASSIFICATIONS, getToolById, searchTools, TOOL_CATEGORIES, TOOLS } from './data/tools-catalog.js';
import {
  applySettings,
  clearAllLocalData,
  exportAllLocalData,
  getFavorites,
  getRecentTools,
  getSettings,
  isFavorite,
  recordRecentTool,
  resetSettingsOnly,
  toggleFavorite,
  updateSettings
} from './state.js';
import { renderFlagshipTool } from './tools/flagship.js';
import { renderPrivacyTool } from './tools/privacy.js';
import { renderNetworkTool } from './tools/network.js';
import { renderCryptoTool } from './tools/crypto.js';
import { renderSecurityTool } from './tools/security.js';
import { renderDataTool } from './tools/data.js';
import { renderIdentityTool } from './tools/identity.js';
import { renderUtilityTool } from './tools/utilities.js';
import { renderEducationalTool } from './tools/educational.js';

const mainEl = document.getElementById('main-content');
const breadcrumbEl = document.getElementById('breadcrumb-current');
const sidebarEl = document.getElementById('app-sidebar');
const backdropEl = document.getElementById('sidebar-backdrop');
const searchInputEl = document.getElementById('global-search-input');
const searchDropdownEl = document.getElementById('global-search-results');

let directoryState = {
  category: 'All',
  classification: 'All',
  query: ''
};

function closeMobileSidebar() {
  sidebarEl.classList.remove('open');
  backdropEl.hidden = true;
  document.getElementById('sidebar-open-btn')?.setAttribute('aria-expanded', 'false');
}

function openMobileSidebar() {
  sidebarEl.classList.add('open');
  backdropEl.hidden = false;
  document.getElementById('sidebar-open-btn')?.setAttribute('aria-expanded', 'true');
}

function navigate(hashPath) {
  window.location.hash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  closeMobileSidebar();
}

function renderToolCard(tool) {
  const fav = isFavorite(tool.id);
  return `
    <article class="tool-card">
      <div>
        <div class="tool-card-top">
          <div>
            <h3 class="tool-card-title">
              <a href="#/tool/${escapeHtml(tool.id)}">${escapeHtml(tool.name)}</a>
            </h3>
            <div class="tool-meta-line">
              <span>${escapeHtml(tool.category)}</span>
              <span aria-hidden="true">·</span>
              <span>${escapeHtml(tool.availability)}</span>
            </div>
          </div>
          <button
            type="button"
            class="icon-btn fav-toggle ${fav ? 'fav-active' : ''}"
            data-fav-id="${escapeHtml(tool.id)}"
            aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}: ${escapeHtml(tool.name)}"
            title="${fav ? 'Remove favorite' : 'Add to favorites'}"
          >
            ${iconSvg('star', fav)}
          </button>
        </div>
        <p class="tool-card-desc" style="margin-top: 10px;">${escapeHtml(tool.shortDesc)}</p>
      </div>
      <div class="tool-card-bottom">
        <span class="class-tag class-${escapeHtml(tool.classification)}" title="${escapeHtml(CLASSIFICATIONS[tool.classification]?.description || '')}">
          ${escapeHtml(tool.classification)}
        </span>
        <a href="#/tool/${escapeHtml(tool.id)}" class="section-link">Open tool</a>
      </div>
    </article>
  `;
}

function bindFavoriteButtons(scope = mainEl) {
  scope.querySelectorAll('.fav-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.favId;
      toggleFavorite(id);
      const fav = isFavorite(id);
      btn.classList.toggle('fav-active', fav);
      btn.innerHTML = iconSvg('star', fav);
      btn.setAttribute('aria-label', `${fav ? 'Remove from favorites' : 'Add to favorites'}`);
      showToast(fav ? 'Added to local favorites' : 'Removed from local favorites');
    });
  });
}

function renderOverview() {
  breadcrumbEl.textContent = 'Overview';
  const localCount = TOOLS.filter((t) => t.classification === 'LOCAL').length;
  const apiCount = TOOLS.filter((t) => t.classification === 'API').length;
  const eduCount = TOOLS.filter((t) => t.classification === 'EDUCATIONAL').length;
  const limitedCount = TOOLS.filter((t) => t.classification === 'LIMITED').length;

  const favTools = getFavorites().map(getToolById).filter(Boolean);
  const recentTools = getRecentTools()
    .map((r) => ({ tool: getToolById(r.id), visitedAt: r.visitedAt }))
    .filter((x) => x.tool);
  const flagshipTools = TOOLS.filter((t) => t.featured);

  mainEl.innerHTML = `
    <section class="hero-surface">
      <div>
        <div class="hero-kicker">Open-Source Privacy Toolkit · ${TOOLS.length} Modular Tools</div>
        <h1 class="hero-title">Privacy. Control. Clarity.</h1>
        <p class="hero-copy">
          Browser-first tools for privacy inspection, Web Crypto encryption, network diagnostics, security awareness, and local data protection — built with honest boundaries and zero tracking.
        </p>
        <div class="hero-actions">
          <a href="#/tool/privacy-check" class="btn btn-primary">Run Privacy Check</a>
          <a href="#/tools" class="btn btn-secondary">Browse All ${TOOLS.length} Tools</a>
          <button type="button" class="btn btn-ghost" id="ov-open-prefs">Local Data &amp; Settings</button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="stat-cell">
          <div class="stat-value">${localCount}</div>
          <div class="stat-label">LOCAL (Browser-only)</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">${limitedCount}</div>
          <div class="stat-label">LIMITED (Sandbox-bound)</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">${apiCount}</div>
          <div class="stat-label">API (Public / SSRF-guarded)</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">${eduCount}</div>
          <div class="stat-label">EDUCATIONAL (Guides &amp; Audits)</div>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <h2 class="section-title">Core Tool Shortcuts</h2>
        <a href="#/tools" class="section-link">Explore full directory</a>
      </div>
      <div class="tools-grid">
        ${flagshipTools.map(renderToolCard).join('')}
      </div>
    </section>

    <section class="section-block grid-2">
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Favorite Tools</h2>
          <span class="field-hint mono">${favTools.length} saved locally</span>
        </div>
        ${favTools.length === 0
          ? '<div class="notice">No favorites pinned yet. Click the star button on any tool card to pin it here locally.</div>'
          : `<div style="display:flex;flex-direction:column;gap:8px;">${favTools.map((t) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border-hairline);border-radius:var(--radius-sm);">
                <div>
                  <a href="#/tool/${escapeHtml(t.id)}" style="font-weight:600;font-size:13.5px;">${escapeHtml(t.name)}</a>
                  <div class="field-hint">${escapeHtml(t.category)} · ${escapeHtml(t.classification)}</div>
                </div>
                <a href="#/tool/${escapeHtml(t.id)}" class="btn btn-secondary btn-sm">Open</a>
              </div>
            `).join('')}</div>`}
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Recent Local Activity</h2>
          <span class="field-hint mono">${recentTools.length} entries</span>
        </div>
        ${recentTools.length === 0
          ? '<div class="notice">Tools you open appear here in localStorage so you can resume quickly without server accounts.</div>'
          : `<div style="display:flex;flex-direction:column;gap:8px;">${recentTools.slice(0, 6).map(({ tool, visitedAt }) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border-hairline);border-radius:var(--radius-sm);">
                <div>
                  <a href="#/tool/${escapeHtml(tool.id)}" style="font-weight:600;font-size:13.5px;">${escapeHtml(tool.name)}</a>
                  <div class="field-hint">${escapeHtml(tool.classification)} · ${new Date(visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <a href="#/tool/${escapeHtml(tool.id)}" class="btn btn-secondary btn-sm">Reopen</a>
              </div>
            `).join('')}</div>`}
      </div>
    </section>

    <section class="section-block">
      <div class="section-head">
        <h2 class="section-title">Tool Categories</h2>
      </div>
      <div class="grid-3">
        ${TOOL_CATEGORIES.map((cat) => {
          const count = TOOLS.filter((t) => t.category === cat).length;
          return `
            <a href="#/tools?category=${encodeURIComponent(cat)}" class="panel" style="display:block;">
              <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(cat)}</div>
              <div class="field-hint mono">${count} tools</div>
            </a>
          `;
        }).join('')}
      </div>
    </section>

    <section class="section-block panel">
      <h2 class="panel-title" style="margin-bottom: 10px;">Privacy Principles &amp; Tool Availability</h2>
      <div class="grid-3">
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Zero Hidden Telemetry</div>
          <div class="field-hint">No analytics scripts, no tracking pixels, no third-party ad requests, and no logging of user inputs or passwords.</div>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Strict Local-First Execution</div>
          <div class="field-hint">Web Crypto AES-GCM, password generation, EXIF inspection, QR generation, and file hashing run directly in your browser.</div>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Transparent Browser Limits</div>
          <div class="field-hint">Every tool displays whether it is LOCAL, API, LIMITED, or EDUCATIONAL and never fabricates security verdicts.</div>
        </div>
      </div>
    </section>
  `;

  document.getElementById('ov-open-prefs')?.addEventListener('click', openSettingsModal);
  bindFavoriteButtons();
}

function renderToolsDirectory(queryParams) {
  breadcrumbEl.textContent = 'Privacy Tools';
  const urlCat = queryParams.get('category');
  if (urlCat && (urlCat === 'All' || TOOL_CATEGORIES.includes(urlCat))) {
    directoryState.category = urlCat;
  }

  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Privacy Tool Directory</h1>
        <p class="page-subtitle">Browse all ${TOOLS.length} modular tools across seven categories. Every tool displays its real execution scope.</p>
      </div>
      <div style="min-width: 260px; flex: 0 1 320px;">
        <input id="dir-search" class="input" type="search" placeholder="Filter directory..." value="${escapeHtml(directoryState.query)}" aria-label="Filter tool directory" />
      </div>
    </div>

    <div class="filter-bar" role="tablist" aria-label="Category filter">
      <button type="button" class="filter-tab ${directoryState.category === 'All' ? 'active' : ''}" data-cat="All">All (${TOOLS.length})</button>
      ${TOOL_CATEGORIES.map((cat) => {
        const count = TOOLS.filter((t) => t.category === cat).length;
        return `<button type="button" class="filter-tab ${directoryState.category === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</button>`;
      }).join('')}
    </div>

    <div class="filter-bar" aria-label="Execution classification filter">
      ${['All', 'LOCAL', 'API', 'LIMITED', 'EDUCATIONAL'].map((cls) => `
        <button type="button" class="filter-tab ${directoryState.classification === cls ? 'active' : ''}" data-cls="${cls}">${cls === 'All' ? 'All Classifications' : cls}</button>
      `).join('')}
    </div>

    <div id="dir-count" class="field-hint mono" style="margin-bottom: 12px;"></div>
    <div id="dir-grid" class="tools-grid"></div>
  `;

  function paintList() {
    let list = searchTools(directoryState.query);
    if (directoryState.category !== 'All') {
      list = list.filter((t) => t.category === directoryState.category);
    }
    if (directoryState.classification !== 'All') {
      list = list.filter((t) => t.classification === directoryState.classification);
    }

    document.getElementById('dir-count').textContent = `Showing ${list.length} of ${TOOLS.length} tools`;
    const grid = document.getElementById('dir-grid');
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="panel" style="grid-column: 1 / -1;">
          <div style="font-weight:600;margin-bottom:6px;">No matching tools found</div>
          <div class="field-hint" style="margin-bottom:12px;">Try clearing your search filter or switching category tabs.</div>
          <button type="button" class="btn btn-secondary btn-sm" id="dir-reset-filters">Reset Filters</button>
        </div>
      `;
      document.getElementById('dir-reset-filters').addEventListener('click', () => {
        directoryState = { category: 'All', classification: 'All', query: '' };
        renderToolsDirectory(new URLSearchParams());
      });
      return;
    }

    grid.innerHTML = list.map(renderToolCard).join('');
    bindFavoriteButtons(grid);
  }

  document.getElementById('dir-search').addEventListener('input', (e) => {
    directoryState.query = e.target.value;
    paintList();
  });

  mainEl.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      directoryState.category = btn.dataset.cat;
      mainEl.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b === btn));
      paintList();
    });
  });

  mainEl.querySelectorAll('[data-cls]').forEach((btn) => {
    btn.addEventListener('click', () => {
      directoryState.classification = btn.dataset.cls;
      mainEl.querySelectorAll('[data-cls]').forEach((b) => b.classList.toggle('active', b === btn));
      paintList();
    });
  });

  paintList();
}

function renderCategoryHub(categoryName, title, subtitle) {
  breadcrumbEl.textContent = title;
  const list = TOOLS.filter((t) => t.category === categoryName);
  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <a href="#/tools?category=${encodeURIComponent(categoryName)}" class="btn btn-secondary btn-sm">Filter in Directory</a>
    </div>
    <div class="tools-grid">
      ${list.map(renderToolCard).join('')}
    </div>
  `;
  bindFavoriteButtons();
}

function renderLearnPage() {
  breadcrumbEl.textContent = 'Learn';
  const eduTools = TOOLS.filter((t) => t.classification === 'EDUCATIONAL');
  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Privacy &amp; Security Knowledge Hub</h1>
        <p class="page-subtitle">Interactive self-audit checklists, threat-modeling guides, glossary terms, and transparent explanations of browser and network boundaries.</p>
      </div>
    </div>
    <div class="tools-grid">
      ${eduTools.map(renderToolCard).join('')}
    </div>
  `;
  bindFavoriteButtons();
}

function renderAboutPage() {
  breadcrumbEl.textContent = 'About';
  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">About PRIVACORE</h1>
        <p class="page-subtitle">Privacy. Control. Clarity. An open-source, lightweight browser-first privacy toolkit.</p>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h2 class="panel-title" style="margin-bottom: 10px;">Architecture &amp; Design Goals</h2>
        <p style="color: var(--text-secondary); margin-top: 0;">
          PRIVACORE is built with semantic HTML, modern CSS, and dependency-free Vanilla JavaScript so it remains fast on older computers, auditable without complex bundler chains, and deployable on static or serverless hosts like Vercel.
        </p>
        <p style="color: var(--text-secondary); margin-bottom: 0;">
          Cryptographic utilities rely strictly on the browser Web Crypto API (<code>crypto.subtle</code> and <code>crypto.getRandomValues</code>). Server-assisted tools (DNS, IP, Security Headers, HTTP Status) enforce strict input validation, SSRF guards, and sliding-window rate limits.
        </p>
      </div>
      <div class="panel">
        <h2 class="panel-title" style="margin-bottom: 10px;">Open Source &amp; Links</h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a class="section-link" href="https://github.com/muhammedameen991/PRIVACORE" target="_blank" rel="noopener noreferrer">GitHub Repository (muhammedameen991/PRIVACORE)</a>
          <a class="section-link" href="#/privacy-policy">PRIVACORE Privacy Policy</a>
          <a class="section-link" href="#/tool/privacy-faq">Transparency FAQ</a>
          <a class="section-link" href="#/tool/local-data-manager">Local Data Control Center</a>
        </div>
      </div>
    </div>
  `;
}

function renderPrivacyPolicyPage() {
  breadcrumbEl.textContent = 'Privacy Policy';
  mainEl.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">PRIVACORE Privacy Policy</h1>
        <p class="page-subtitle">Plain-language commitments regarding local execution, serverless APIs, and zero tracking.</p>
      </div>
    </div>
    <div class="panel" style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <h2 class="panel-title" style="margin-bottom: 6px;">1. No Tracking, Analytics, or Ad Pixels</h2>
        <p style="color: var(--text-secondary); margin: 0;">PRIVACORE does not embed analytics trackers, behavioral profiling, fingerprinting scripts, or third-party advertising pixels.</p>
      </div>
      <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
        <h2 class="panel-title" style="margin-bottom: 6px;">2. Local-First Processing</h2>
        <p style="color: var(--text-secondary); margin: 0;">Tools labeled <strong>LOCAL</strong> or <strong>LIMITED</strong> execute inside your browser memory. Passwords, encryption keys, plaintext notes, QR payloads, and selected local files are never uploaded to any server.</p>
      </div>
      <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
        <h2 class="panel-title" style="margin-bottom: 6px;">3. Serverless API Endpoints</h2>
        <p style="color: var(--text-secondary); margin: 0;">Tools labeled <strong>API</strong> (DNS Explorer, IP Explorer, Security Headers, HTTP Status) send only the domain, IP, or URL you explicitly submit. Ephemeral in-memory rate-limiting hashes client keys with a per-process random salt and never writes visitor IPs to disk or databases. External providers queried (Cloudflare DoH, Google Public DNS, ipwho.is) are subject to their own network policies.</p>
      </div>
      <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
        <h2 class="panel-title" style="margin-bottom: 6px;">4. Local Browser Storage</h2>
        <p style="color: var(--text-secondary); margin: 0;">Favorites, recent tool history, theme/motion settings, checklists, and optional scratchpad notes are saved exclusively in your browser's <code>localStorage</code>. You can export or delete all stored data at any time.</p>
      </div>
    </div>
  `;
}

function renderNotFoundPage() {
  breadcrumbEl.textContent = '404 Not Found';
  mainEl.innerHTML = `
    <div class="panel" style="max-width: 620px; margin: 24px auto;">
      <div class="field-hint mono">HTTP 404 · Route Not Found</div>
      <h1 class="page-title" style="margin-top: 6px;">Page or tool not found</h1>
      <p style="color: var(--text-secondary);">The requested route does not exist in PRIVACORE. Return to the dashboard or browse the full tool directory.</p>
      <div class="hero-actions" style="margin-top: 16px;">
        <a href="#/" class="btn btn-primary">Go to Overview</a>
        <a href="#/tools" class="btn btn-secondary">Browse Privacy Tools</a>
      </div>
    </div>
  `;
}

async function renderToolDetail(toolId) {
  const tool = getToolById(toolId);
  if (!tool) {
    renderNotFoundPage();
    return;
  }

  recordRecentTool(tool.id);
  breadcrumbEl.textContent = tool.name;
  const fav = isFavorite(tool.id);

  mainEl.innerHTML = `
    <div class="tool-workspace">
      <div class="tool-banner">
        <div>
          <div class="tool-banner-meta">
            <a href="#/tools" class="section-link">All Tools</a>
            <span aria-hidden="true">/</span>
            <span>${escapeHtml(tool.category)}</span>
            <span aria-hidden="true">·</span>
            <span class="class-tag class-${escapeHtml(tool.classification)}">${escapeHtml(tool.classification)}</span>
            <span aria-hidden="true">·</span>
            <span>${escapeHtml(tool.availability)}</span>
          </div>
          <h1 class="page-title" style="margin-bottom: 6px;">${escapeHtml(tool.name)}</h1>
          <p class="page-subtitle">${escapeHtml(tool.shortDesc)}</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-secondary btn-sm fav-toggle ${fav ? 'fav-active' : ''}" data-fav-id="${escapeHtml(tool.id)}">
            ${iconSvg('star', fav)} <span>${fav ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      <div id="tool-workbench-mount"></div>

      <div class="grid-2">
        <div class="notice">
          <strong>Privacy Guarantee:</strong> ${escapeHtml(tool.privacyNote)}
        </div>
        <div class="notice">
          <strong>Scope &amp; Limitations:</strong> ${escapeHtml(tool.limitations)}
        </div>
      </div>
    </div>
  `;

  bindFavoriteButtons();
  const mount = document.getElementById('tool-workbench-mount');
  const wb = tool.workbench;

  if (wb.module === 'flagship') await renderFlagshipTool(wb.kind, mount);
  else if (wb.module === 'privacy') await renderPrivacyTool(wb.kind, mount);
  else if (wb.module === 'network') await renderNetworkTool(wb.kind, mount);
  else if (wb.module === 'crypto') await renderCryptoTool(wb.kind, mount);
  else if (wb.module === 'security') await renderSecurityTool(wb.kind, mount);
  else if (wb.module === 'data') await renderDataTool(wb.kind, mount);
  else if (wb.module === 'identity') await renderIdentityTool(wb.kind, mount);
  else if (wb.module === 'utilities') await renderUtilityTool(wb.kind, mount);
  else if (wb.module === 'educational') await renderEducationalTool(wb, mount);
  else mount.innerHTML = '<div class="notice">Workbench unavailable.</div>';
}

function updateActiveNav(routeKey, toolId = null) {
  document.querySelectorAll('.sidebar-nav .nav-link').forEach((link) => {
    const matchesRoute = link.dataset.route && link.dataset.route === routeKey;
    const matchesTool = toolId && link.dataset.toolLink === toolId;
    link.classList.toggle('active', Boolean(matchesRoute || matchesTool));
  });
}

async function handleRoute() {
  const rawHash = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = rawHash.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const queryParams = new URLSearchParams(queryPart || '');

  if (path === '/' || path === '/overview') {
    updateActiveNav('overview');
    renderOverview();
  } else if (path === '/tools') {
    updateActiveNav('tools');
    renderToolsDirectory(queryParams);
  } else if (path === '/network') {
    updateActiveNav('network');
    renderCategoryHub('Network & Internet', 'Network & Diagnostics', 'DNS lookup, public IP inspection, security headers, subnetting, and leak awareness.');
  } else if (path === '/security') {
    updateActiveNav('security');
    renderCategoryHub('Security & Protection', 'Security & Protection', 'URL structural analysis, CSP/SRI builders, email header inspection, and defensive checklists.');
  } else if (path === '/learn') {
    updateActiveNav('learn');
    renderLearnPage();
  } else if (path === '/about') {
    updateActiveNav('about');
    renderAboutPage();
  } else if (path === '/privacy-policy') {
    updateActiveNav('about');
    renderPrivacyPolicyPage();
  } else if (path.startsWith('/tool/')) {
    const id = decodeURIComponent(path.slice('/tool/'.length));
    updateActiveNav('tools', id);
    await renderToolDetail(id);
  } else {
    updateActiveNav('');
    renderNotFoundPage();
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
}

// Global Search Dropdown & Keyboard Shortcuts
function setupGlobalSearch() {
  let activeIdx = -1;
  let currentMatches = [];

  function closeDropdown() {
    searchDropdownEl.hidden = true;
    activeIdx = -1;
  }

  function renderResults(q) {
    if (!q.trim()) {
      closeDropdown();
      return;
    }
    currentMatches = searchTools(q).slice(0, 8);
    if (currentMatches.length === 0) {
      searchDropdownEl.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--text-muted);">No tools found for that query.</div>';
      searchDropdownEl.hidden = false;
      return;
    }
    searchDropdownEl.innerHTML = currentMatches
      .map((t, idx) => `
        <button type="button" class="search-result-item" role="option" aria-selected="${idx === activeIdx}" data-tool-id="${escapeHtml(t.id)}">
          <div>
            <div class="search-result-title">${escapeHtml(t.name)}</div>
            <div class="search-result-meta">${escapeHtml(t.category)} · ${escapeHtml(t.classification)}</div>
          </div>
          <span class="class-tag class-${escapeHtml(t.classification)}">${escapeHtml(t.classification)}</span>
        </button>
      `)
      .join('');
    searchDropdownEl.hidden = false;

    searchDropdownEl.querySelectorAll('.search-result-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate(`/tool/${btn.dataset.toolId}`);
        searchInputEl.value = '';
        closeDropdown();
      });
    });
  }

  searchInputEl.addEventListener('input', (e) => {
    activeIdx = -1;
    renderResults(e.target.value);
  });

  searchInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
      searchInputEl.blur();
      return;
    }
    if (searchDropdownEl.hidden || currentMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % currentMatches.length;
      renderResults(searchInputEl.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
      renderResults(searchInputEl.value);
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const chosen = currentMatches[activeIdx];
      if (chosen) {
        navigate(`/tool/${chosen.id}`);
        searchInputEl.value = '';
        closeDropdown();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search')) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
      e.preventDefault();
      searchInputEl.focus();
    }
  });
}

// Settings Modal
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-modal-body');
  const settings = getSettings();

  body.innerHTML = `
    <div class="field-group">
      <label class="field-label" for="pref-theme">Interface Theme</label>
      <select id="pref-theme" class="select">
        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Charcoal (Default)</option>
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Slate</option>
      </select>
    </div>

    <label class="checkbox-row">
      <input type="checkbox" id="pref-motion" ${settings.reducedMotion ? 'checked' : ''} />
      Reduce interface transitions and motion
    </label>

    <div class="notice">
      <strong>Local Privacy Information:</strong> PRIVACORE stores preferences, favorites, recent history, checklists, and optional scratchpad notes exclusively in browser <code>localStorage</code>. Nothing is synced externally.
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 6px; border-top: 1px solid var(--border-hairline);">
      <button type="button" class="btn btn-secondary btn-sm" id="pref-export">Export Local Data</button>
      <button type="button" class="btn btn-secondary btn-sm" id="pref-reset-settings">Reset Settings</button>
      <button type="button" class="btn btn-danger btn-sm" id="pref-clear-all">Clear All Local Data</button>
    </div>
  `;

  modal.hidden = false;

  document.getElementById('pref-theme').addEventListener('change', (e) => {
    updateSettings({ theme: e.target.value });
    showToast(`Theme switched to ${e.target.value}`);
  });

  document.getElementById('pref-motion').addEventListener('change', (e) => {
    updateSettings({ reducedMotion: e.target.checked });
    showToast(e.target.checked ? 'Reduced motion enabled' : 'Standard motion enabled');
  });

  document.getElementById('pref-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportAllLocalData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacore-local-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Local data exported');
  });

  document.getElementById('pref-reset-settings').addEventListener('click', () => {
    resetSettingsOnly();
    openSettingsModal();
    showToast('Settings reset to defaults');
  });

  document.getElementById('pref-clear-all').addEventListener('click', () => {
    clearAllLocalData();
    modal.hidden = true;
    handleRoute();
    showToast('All local PRIVACORE data cleared');
  });
}

function init() {
  applySettings();
  hydrateIcons();

  const countBadge = document.getElementById('nav-tool-count');
  if (countBadge) countBadge.textContent = String(TOOLS.length);

  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  backdropEl?.addEventListener('click', closeMobileSidebar);
  sidebarEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobileSidebar));

  document.getElementById('open-settings-btn')?.addEventListener('click', openSettingsModal);
  document.getElementById('close-settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal').hidden = true;
  });
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') e.currentTarget.hidden = true;
  });

  setupGlobalSearch();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
