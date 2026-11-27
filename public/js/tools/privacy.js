import { copyText, escapeHtml, showToast } from '../icons.js';

const TRACKERS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'yclid', 'mc_eid', 'mc_cid',
  'igshid', 'si', '_hsenc', '_hsmi', 'mkt_tok', 'ref_src', 'ref_url', 'vero_id', 'spm'
];

export async function renderPrivacyTool(kind, container) {
  switch (kind) {
    case 'cookie-inspector': return renderCookieInspector(container);
    case 'storage-inspector': return renderStorageInspector(container);
    case 'permissions-audit': return renderPermissionsAudit(container);
    case 'webrtc-surface': return renderWebrtcSurface(container);
    case 'canvas-lab': return renderCanvasLab(container);
    case 'webgl-inspector': return renderWebglInspector(container);
    case 'timezone-locale': return renderTimezoneLocale(container);
    case 'referrer-lab': return renderReferrerLab(container);
    case 'gpc-dnt': return renderGpcDnt(container);
    case 'useragent-parser': return renderUserAgentParser(container);
    case 'clipboard-privacy': return renderClipboardPrivacy(container);
    case 'screen-surface': return renderScreenSurface(container);
    case 'tracker-cleaner': return renderTrackerCleaner(container);
    default:
      container.innerHTML = '<div class="notice">Privacy tool module not found.</div>';
  }
}

function renderCookieInspector(container) {
  const raw = document.cookie || '';
  const pairs = raw ? raw.split(';').map((s) => s.trim()).filter(Boolean) : [];
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Accessible Cookies on Current Origin</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="ci-refresh">Refresh</button>
      </div>
      ${pairs.length === 0
        ? '<div class="notice notice-ok">No JavaScript-accessible cookies are set by PRIVACORE on this origin.</div>'
        : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${pairs.map((p) => {
            const idx = p.indexOf('=');
            const k = idx >= 0 ? p.slice(0, idx) : p;
            const v = idx >= 0 ? p.slice(idx + 1) : '';
            return `<tr><td class="mono">${escapeHtml(k)}</td><td class="mono">${escapeHtml(v)}</td></tr>`;
          }).join('')}</tbody></table></div>`}
      <div class="notice" style="margin-top: 14px;">
        <strong>Why HttpOnly matters:</strong> Cookies marked <code>HttpOnly</code> cannot be read via <code>document.cookie</code>, mitigating session theft if an XSS bug occurs. This inspector can only observe non-HttpOnly cookies on the active origin.
      </div>
    </div>
  `;
  document.getElementById('ci-refresh').addEventListener('click', () => renderCookieInspector(container));
}

async function renderStorageInspector(container) {
  let quotaText = 'Estimate unavailable';
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const usedKb = ((est.usage || 0) / 1024).toFixed(1);
      const quotaMb = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
      quotaText = `${usedKb} KB used of ~${quotaMb} MB origin quota`;
    } catch {
      quotaText = 'Restricted';
    }
  }

  let idbNames = 'Not enumerable in this browser';
  if (indexedDB?.databases) {
    try {
      const dbs = await indexedDB.databases();
      idbNames = dbs.length ? dbs.map((d) => d.name || '(unnamed)').join(', ') : 'None';
    } catch {
      idbNames = 'Unavailable';
    }
  }

  const lsItems = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    lsItems.push([k, localStorage.getItem(k) || '']);
  }

  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Origin Storage Summary</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="si-refresh">Refresh</button>
      </div>
      <div class="table-wrap" style="margin-bottom: 16px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 220px;">Storage Quota</th><td class="mono">${escapeHtml(quotaText)}</td></tr>
            <tr><th>localStorage Keys</th><td class="mono">${localStorage.length}</td></tr>
            <tr><th>sessionStorage Keys</th><td class="mono">${sessionStorage.length}</td></tr>
            <tr><th>IndexedDB Databases</th><td class="mono">${escapeHtml(idbNames)}</td></tr>
          </tbody>
        </table>
      </div>
      <h4 style="margin: 0 0 8px; font-size: 14px;">localStorage Entries</h4>
      ${lsItems.length === 0
        ? '<div class="notice">localStorage is empty for this origin.</div>'
        : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Key</th><th>Size</th><th>Action</th></tr></thead><tbody>${lsItems.map(([k, v]) => `
            <tr>
              <td class="mono">${escapeHtml(k)}</td>
              <td class="mono">${v.length} chars</td>
              <td><button type="button" class="btn btn-danger btn-sm si-del" data-key="${escapeHtml(k)}">Delete</button></td>
            </tr>
          `).join('')}</tbody></table></div>`}
    </div>
  `;

  document.getElementById('si-refresh').addEventListener('click', () => renderStorageInspector(container));
  container.querySelectorAll('.si-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.removeItem(btn.dataset.key);
      showToast(`Removed ${btn.dataset.key}`);
      renderStorageInspector(container);
    });
  });
}

async function renderPermissionsAudit(container) {
  const names = [
    ['geolocation', 'Precise or coarse device location'],
    ['notifications', 'Web push and desktop notifications'],
    ['camera', 'Video capture devices'],
    ['microphone', 'Audio capture devices'],
    ['clipboard-read', 'Reading clipboard contents'],
    ['clipboard-write', 'Writing to clipboard'],
    ['persistent-storage', 'Preventing automatic storage eviction'],
    ['midi', 'Connected MIDI instruments'],
    ['background-sync', 'Deferred background network sync']
  ];

  const rows = [];
  for (const [name, desc] of names) {
    let state = 'Unsupported / Restricted';
    if (navigator.permissions?.query) {
      try {
        const res = await navigator.permissions.query({ name });
        state = res.state;
      } catch {
        state = 'Not queryable';
      }
    }
    rows.push({ name, desc, state });
  }

  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 12px;">Permissions API Matrix</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Descriptor</th><th>Purpose</th><th>State</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td class="mono">${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.desc)}</td>
                <td class="mono ${r.state === 'granted' ? 'state-text-warn' : r.state === 'denied' ? 'state-text-ok' : ''}">${escapeHtml(r.state)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderWebrtcSurface(container) {
  let mediaCount = 'Unavailable';
  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const kinds = devices.reduce((acc, d) => {
        acc[d.kind] = (acc[d.kind] || 0) + 1;
        return acc;
      }, {});
      mediaCount = Object.entries(kinds).map(([k, v]) => `${k}: ${v}`).join(' · ') || '0 devices enumerated';
    } catch {
      mediaCount = 'Restricted';
    }
  }
  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 12px;">WebRTC &amp; Media Surface</h3>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 240px;">RTCPeerConnection</th><td class="mono">${typeof window.RTCPeerConnection === 'function' ? 'Available' : 'Disabled'}</td></tr>
            <tr><th>RTCDataChannel</th><td class="mono">${typeof window.RTCDataChannel === 'function' ? 'Available' : 'Disabled'}</td></tr>
            <tr><th>mediaDevices.enumerateDevices()</th><td class="mono">${escapeHtml(mediaCount)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="notice" style="margin-top: 12px;">Browsers do not expose device labels until camera/microphone permission is explicitly granted, and modern browsers obfuscate local LAN IPs in ICE candidates via mDNS (.local).</div>
    </div>
  `;
}

async function renderCanvasLab(container) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15171e';
  ctx.fillRect(0, 0, 360, 72);
  ctx.fillStyle = '#8b5cf6';
  ctx.fillRect(14, 14, 44, 44);
  ctx.font = '600 16px sans-serif';
  ctx.fillStyle = '#f3f4f8';
  ctx.fillText('PRIVACORE Canvas Test 012345', 70, 36);
  ctx.strokeStyle = '#a78bfa';
  ctx.beginPath();
  ctx.arc(36, 36, 16, 0, Math.PI * 1.5);
  ctx.stroke();

  const dataUrl = canvas.toDataURL();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 10px;">Ephemeral Canvas Rendering</h3>
      <div id="cl-holder" style="margin-bottom: 12px;"></div>
      <div class="field-group">
        <label class="field-label">Transient Ephemeral SHA-256 Digest</label>
        <div class="output-box">${escapeHtml(hex)}</div>
      </div>
      <div class="field-hint">Font rasterization, sub-pixel anti-aliasing, and GPU drivers produce subtle pixel variations across OS/hardware combinations. Anti-fingerprinting browsers add noise or return blank pixels.</div>
    </div>
  `;
  document.getElementById('cl-holder').appendChild(canvas);
}

function renderWebglInspector(container) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) {
    container.innerHTML = '<div class="notice">WebGL is disabled or unavailable in this browser.</div>';
    return;
  }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const rows = [
    ['Context Type', gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0'],
    ['Vendor', gl.getParameter(gl.VENDOR)],
    ['Renderer', gl.getParameter(gl.RENDERER)],
    ['Unmasked Vendor', dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'Masked / Unavailable'],
    ['Unmasked Renderer', dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'Masked / Unavailable'],
    ['Max Texture Size', String(gl.getParameter(gl.MAX_TEXTURE_SIZE))],
    ['Supported Extensions', String((gl.getSupportedExtensions() || []).length)]
  ];
  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 12px;">WebGL Exposed Parameters</h3>
      <div class="table-wrap">
        <table class="data-table">
          <tbody>${rows.map(([k, v]) => `<tr><th style="width: 220px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(String(v))}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTimezoneLocale(container) {
  const opts = Intl.DateTimeFormat().resolvedOptions();
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offsetMin) % 60).padStart(2, '0');

  const rows = [
    ['IANA Timezone', opts.timeZone || 'Unknown'],
    ['UTC Offset', `UTC${sign}${hh}:${mm}`],
    ['Resolved Locale', opts.locale],
    ['Calendar / Numbering', `${opts.calendar} / ${opts.numberingSystem}`],
    ['navigator.language', navigator.language],
    ['navigator.languages', (navigator.languages || []).join(', ')]
  ];

  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 12px;">Timezone &amp; Locale Signals</h3>
      <div class="table-wrap" style="margin-bottom: 12px;">
        <table class="data-table">
          <tbody>${rows.map(([k, v]) => `<tr><th style="width: 220px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="notice">When using a VPN in another region, a mismatch between your browser's Intl timezone and the VPN exit IP's timezone is an observable signal.</div>
    </div>
  `;
}

function renderReferrerLab(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="rl-source">Source Page URL</label>
          <input id="rl-source" class="input mono" value="https://app.example.org/account/profile?token=secret" />
        </div>
        <div class="field-group">
          <label class="field-label" for="rl-dest">Destination Link URL</label>
          <input id="rl-dest" class="input mono" value="https://external-partner.com/landing" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="rl-policy">Referrer-Policy Directive</label>
        <select id="rl-policy" class="select">
          <option value="no-referrer">no-referrer (Recommended for privacy)</option>
          <option value="same-origin">same-origin</option>
          <option value="strict-origin">strict-origin</option>
          <option value="strict-origin-when-cross-origin" selected>strict-origin-when-cross-origin (Modern Browser Default)</option>
          <option value="origin">origin</option>
          <option value="unsafe-url">unsafe-url (Leaks full path &amp; query!)</option>
        </select>
      </div>
      <div id="rl-result" class="output-box"></div>
    </div>
  `;

  function simulate() {
    const out = document.getElementById('rl-result');
    try {
      const src = new URL(document.getElementById('rl-source').value);
      const dst = new URL(document.getElementById('rl-dest').value);
      const policy = document.getElementById('rl-policy').value;
      const sameOrigin = src.origin === dst.origin;
      const downgrade = src.protocol === 'https:' && dst.protocol === 'http:';
      let sent = '(none — Referer omitted)';

      if (policy === 'no-referrer') sent = '(none — Referer omitted)';
      else if (policy === 'same-origin') sent = sameOrigin ? src.href : '(none — stripped cross-origin)';
      else if (policy === 'origin') sent = src.origin + '/';
      else if (policy === 'strict-origin') sent = downgrade ? '(none — omitted on HTTPS->HTTP downgrade)' : src.origin + '/';
      else if (policy === 'strict-origin-when-cross-origin') {
        if (sameOrigin) sent = src.href;
        else sent = downgrade ? '(none — omitted on HTTPS->HTTP downgrade)' : src.origin + '/';
      } else if (policy === 'unsafe-url') sent = src.href;

      out.textContent = `Same-Origin: ${sameOrigin}\nHTTPS->HTTP Downgrade: ${downgrade}\nSimulated Referer Header:\n${sent}`;
    } catch {
      out.textContent = 'Enter valid source and destination URLs.';
    }
  }

  ['rl-source', 'rl-dest', 'rl-policy'].forEach((id) => {
    document.getElementById(id).addEventListener('input', simulate);
  });
  simulate();
}

function renderGpcDnt(container) {
  const gpc = navigator.globalPrivacyControl;
  const dnt = navigator.doNotTrack;
  container.innerHTML = `
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 12px;">Privacy Opt-Out Signals</h3>
      <div class="table-wrap" style="margin-bottom: 12px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 260px;">navigator.globalPrivacyControl</th><td class="mono">${escapeHtml(String(gpc))}</td></tr>
            <tr><th>navigator.doNotTrack</th><td class="mono">${escapeHtml(String(dnt))}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="notice">Global Privacy Control (GPC) communicates a legal "Do Not Sell or Share" preference under frameworks like CCPA/CPRA, whereas legacy Do Not Track (DNT) was largely ignored by ad networks.</div>
    </div>
  `;
}

function renderUserAgentParser(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="uap-input">User-Agent String</label>
        <textarea id="uap-input" class="textarea" rows="3">${escapeHtml(navigator.userAgent)}</textarea>
      </div>
      <div id="uap-out" class="table-wrap"></div>
    </div>
  `;

  function parseUa() {
    const ua = document.getElementById('uap-input').value;
    let browser = 'Unknown';
    if (/Firefox\/([\d.]+)/.test(ua)) browser = `Firefox ${RegExp.$1}`;
    else if (/Edg\/([\d.]+)/.test(ua)) browser = `Edge ${RegExp.$1}`;
    else if (/Chrome\/([\d.]+)/.test(ua)) browser = `Chromium / Chrome ${RegExp.$1}`;
    else if (/Version\/([\d.]+).*Safari/.test(ua)) browser = `Safari ${RegExp.$1}`;

    let os = 'Unknown';
    if (/Windows NT 10\.0/.test(ua)) os = 'Windows 10/11';
    else if (/Mac OS X ([\d_]+)/.test(ua)) os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
    else if (/Android ([\d.]+)/.test(ua)) os = `Android ${RegExp.$1}`;
    else if (/iPhone OS ([\d_]+)/.test(ua)) os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
    else if (/Linux/.test(ua)) os = 'Linux';

    const hints = navigator.userAgentData
      ? `${(navigator.userAgentData.brands || []).map((b) => `${b.brand} ${b.version}`).join(', ')} (Mobile: ${navigator.userAgentData.mobile})`
      : 'Not exposed by this browser';

    document.getElementById('uap-out').innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><th style="width: 220px;">Parsed Browser</th><td class="mono">${escapeHtml(browser)}</td></tr>
          <tr><th>Parsed OS</th><td class="mono">${escapeHtml(os)}</td></tr>
          <tr><th>Mobile Token</th><td class="mono">${/Mobile|Android|iPhone/.test(ua) ? 'Yes' : 'No'}</td></tr>
          <tr><th>Live Client Hints (current browser)</th><td class="mono">${escapeHtml(hints)}</td></tr>
        </tbody>
      </table>
    `;
  }

  document.getElementById('uap-input').addEventListener('input', parseUa);
  parseUa();
}

async function renderClipboardPrivacy(container) {
  let readPerm = 'Not queryable';
  let writePerm = 'Not queryable';
  if (navigator.permissions?.query) {
    try { readPerm = (await navigator.permissions.query({ name: 'clipboard-read' })).state; } catch {}
    try { writePerm = (await navigator.permissions.query({ name: 'clipboard-write' })).state; } catch {}
  }
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap" style="margin-bottom: 14px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 240px;">clipboard-read permission</th><td class="mono">${escapeHtml(readPerm)}</td></tr>
            <tr><th>clipboard-write permission</th><td class="mono">${escapeHtml(writePerm)}</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-primary" id="cp-clear-btn">Overwrite Clipboard with Blank Space</button>
      <div class="field-hint" style="margin-top: 10px;">Overwrites the active system clipboard slot after copying passwords or keys. Does not erase OS-level clipboard history managers.</div>
    </div>
  `;
  document.getElementById('cp-clear-btn').addEventListener('click', () => copyText(' ', 'Active clipboard slot overwritten'));
}

function renderScreenSurface(container) {
  const rows = [
    ['Screen Resolution', `${screen.width} × ${screen.height} px`],
    ['Available Work Area', `${screen.availWidth} × ${screen.availHeight} px`],
    ['Viewport Inner Size', `${window.innerWidth} × ${window.innerHeight} px`],
    ['Device Pixel Ratio', String(window.devicePixelRatio)],
    ['Color Depth', `${screen.colorDepth}-bit`],
    ['Hardware Concurrency', navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} logical cores` : 'Hidden'],
    ['Device Memory', navigator.deviceMemory ? `~${navigator.deviceMemory} GB (clamped)` : 'Hidden']
  ];
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <tbody>${rows.map(([k, v]) => `<tr><th style="width: 240px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTrackerCleaner(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="tc-in">Paste one or more URLs (one per line)</label>
        <textarea id="tc-in" class="textarea" placeholder="https://example.com/article?utm_source=x&fbclid=123&id=42"></textarea>
      </div>
      <div class="input-row" style="margin-bottom: 14px;">
        <button type="button" class="btn btn-primary" id="tc-clean-btn">Strip Tracking Parameters</button>
        <button type="button" class="btn btn-secondary" id="tc-copy-btn">Copy Cleaned URLs</button>
      </div>
      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label" for="tc-out">Cleaned Output</label>
        <textarea id="tc-out" class="textarea" readonly></textarea>
      </div>
    </div>
  `;

  document.getElementById('tc-clean-btn').addEventListener('click', () => {
    const lines = document.getElementById('tc-in').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cleaned = lines.map((line) => {
      try {
        const u = new URL(line);
        for (const k of Array.from(u.searchParams.keys())) {
          if (TRACKERS.includes(k.toLowerCase()) || k.toLowerCase().startsWith('utm_')) {
            u.searchParams.delete(k);
          }
        }
        return u.toString();
      } catch {
        return `[Invalid URL] ${line}`;
      }
    });
    document.getElementById('tc-out').value = cleaned.join('\n');
  });

  document.getElementById('tc-copy-btn').addEventListener('click', () => {
    const v = document.getElementById('tc-out').value;
    if (v) copyText(v, 'Cleaned URLs copied');
  });
}
