import { copyText, escapeHtml } from '../icons.js';

export async function renderSecurityTool(kind, container) {
  switch (kind) {
    case 'homograph-detector': return renderHomographDetector(container);
    case 'csp-builder': return renderCspBuilder(container);
    case 'sri-generator': return renderSriGenerator(container);
    case 'email-headers': return renderEmailHeaders(container);
    case 'xss-lab': return renderXssLab(container);
    case 'cors-explainer': return renderCorsExplainer(container);
    default:
      container.innerHTML = '<div class="notice">Security tool module not found.</div>';
  }
}

function renderHomographDetector(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="hd-in">Paste Domain Name to Inspect Characters</label>
        <input id="hd-in" class="input mono" value="аррӏе.com" />
      </div>
      <div id="hd-out"></div>
    </div>
  `;

  function analyze() {
    const val = document.getElementById('hd-in').value.trim();
    const out = document.getElementById('hd-out');
    if (!val) {
      out.innerHTML = '<div class="notice">Enter a domain to inspect Unicode codepoints.</div>';
      return;
    }
    const chars = Array.from(val);
    const nonAscii = chars.filter((c) => c.charCodeAt(0) > 127);
    const hasPuny = val.toLowerCase().includes('xn--');

    out.innerHTML = `
      <div class="notice ${nonAscii.length || hasPuny ? 'notice-warn' : 'notice-ok'}" style="margin-bottom: 12px;">
        ${nonAscii.length > 0
          ? `Detected ${nonAscii.length} non-ASCII Unicode character(s). Verify whether lookalike Cyrillic/Greek characters are imitating ASCII letters.`
          : hasPuny
            ? 'Contains Punycode xn-- label (internationalized domain encoding).'
            : 'Pure ASCII domain characters detected.'}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Character</th><th>Codepoint</th><th>Range</th></tr></thead>
          <tbody>
            ${chars.slice(0, 64).map((c) => {
              const cp = c.codePointAt(0);
              const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
              const range = cp <= 127 ? 'Basic ASCII' : cp >= 0x0400 && cp <= 0x04ff ? 'Cyrillic (Lookalike risk)' : cp >= 0x0370 && cp <= 0x03ff ? 'Greek (Lookalike risk)' : 'Other Unicode';
              return `<tr><td class="mono">${escapeHtml(c)}</td><td class="mono">${hex}</td><td class="${cp > 127 ? 'state-text-warn' : ''}">${range}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('hd-in').addEventListener('input', analyze);
  analyze();
}

function renderCspBuilder(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="csp-def">default-src</label><input id="csp-def" class="input mono" value="'self'" /></div>
        <div class="field-group"><label class="field-label" for="csp-scr">script-src</label><input id="csp-scr" class="input mono" value="'self'" /></div>
        <div class="field-group"><label class="field-label" for="csp-sty">style-src</label><input id="csp-sty" class="input mono" value="'self'" /></div>
        <div class="field-group"><label class="field-label" for="csp-img">img-src</label><input id="csp-img" class="input mono" value="'self' data:" /></div>
        <div class="field-group"><label class="field-label" for="csp-obj">object-src</label><input id="csp-obj" class="input mono" value="'none'" /></div>
        <div class="field-group"><label class="field-label" for="csp-frm">frame-ancestors</label><input id="csp-frm" class="input mono" value="'none'" /></div>
      </div>
      <div id="csp-warn"></div>
      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label">Generated Header Value</label>
        <div class="input-row">
          <input id="csp-out" class="input mono" readonly />
          <button type="button" class="btn btn-secondary btn-sm" id="csp-copy">Copy</button>
        </div>
      </div>
    </div>
  `;

  function build() {
    const parts = [
      `default-src ${document.getElementById('csp-def').value.trim()}`,
      `script-src ${document.getElementById('csp-scr').value.trim()}`,
      `style-src ${document.getElementById('csp-sty').value.trim()}`,
      `img-src ${document.getElementById('csp-img').value.trim()}`,
      `object-src ${document.getElementById('csp-obj').value.trim()}`,
      `frame-ancestors ${document.getElementById('csp-frm').value.trim()}`,
      `base-uri 'self'`
    ];
    const policy = parts.join('; ');
    document.getElementById('csp-out').value = policy;
    const hasUnsafe = /unsafe-inline|unsafe-eval|\*/.test(policy);
    document.getElementById('csp-warn').innerHTML = hasUnsafe
      ? '<div class="notice notice-warn" style="margin-bottom: 12px;">Policy includes wildcard (*) or unsafe-inline / unsafe-eval, which weakens XSS protection.</div>'
      : '';
  }

  ['csp-def', 'csp-scr', 'csp-sty', 'csp-img', 'csp-obj', 'csp-frm'].forEach((id) => document.getElementById(id).addEventListener('input', build));
  document.getElementById('csp-copy').addEventListener('click', () => copyText(document.getElementById('csp-out').value, 'CSP header copied'));
  build();
}

function renderSriGenerator(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="sri-text">Paste Asset Content OR Choose Local File</label>
        <textarea id="sri-text" class="textarea" rows="4" placeholder="console.log('example');"></textarea>
      </div>
      <div class="field-group">
        <input id="sri-file" class="input" type="file" />
      </div>
      <div id="sri-out" class="output-box">Enter text or select a local file to compute SHA-384 SRI integrity attribute.</div>
    </div>
  `;

  async function hashBuffer(buf) {
    const digest = await crypto.subtle.digest('SHA-384', buf);
    const bytes = new Uint8Array(digest);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    document.getElementById('sri-out').textContent = `integrity="sha384-${b64}" crossorigin="anonymous"`;
  }

  document.getElementById('sri-text').addEventListener('input', (e) => {
    hashBuffer(new TextEncoder().encode(e.target.value));
  });
  document.getElementById('sri-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) hashBuffer(await file.arrayBuffer());
  });
}

function renderEmailHeaders(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="eh-in">Paste Raw Email Headers (Parsed Locally Only)</label>
        <textarea id="eh-in" class="textarea" rows="7" placeholder="From: sender@example.org&#10;Return-Path: <bounce@example.org>&#10;Authentication-Results: spf=pass dkim=pass dmarc=pass&#10;Received: from mail.example.org ..."></textarea>
      </div>
      <button type="button" class="btn btn-primary" id="eh-parse">Inspect Headers</button>
      <div id="eh-out" style="margin-top: 14px;"></div>
    </div>
  `;

  document.getElementById('eh-parse').addEventListener('click', () => {
    const raw = document.getElementById('eh-in').value;
    const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ');
    const lines = unfolded.split(/\r?\n/);
    const getHeader = (name) => {
      const re = new RegExp(`^${name}:\\s*(.+)$`, 'i');
      return lines.filter((l) => re.test(l)).map((l) => l.replace(re, '$1'));
    };

    const from = getHeader('From')[0] || 'Not found';
    const replyTo = getHeader('Reply-To')[0] || '(same as From)';
    const returnPath = getHeader('Return-Path')[0] || 'Not found';
    const authRes = getHeader('Authentication-Results');
    const received = getHeader('Received');

    document.getElementById('eh-out').innerHTML = `
      <div class="table-wrap" style="margin-bottom: 12px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 200px;">From</th><td class="mono">${escapeHtml(from)}</td></tr>
            <tr><th>Reply-To</th><td class="mono">${escapeHtml(replyTo)}</td></tr>
            <tr><th>Return-Path</th><td class="mono">${escapeHtml(returnPath)}</td></tr>
            <tr><th>Authentication-Results</th><td class="mono">${authRes.length ? escapeHtml(authRes.join(' | ')) : 'None found'}</td></tr>
            <tr><th>Received Hops</th><td class="mono">${received.length}</td></tr>
          </tbody>
        </table>
      </div>
      ${received.length ? `<div class="output-box">${escapeHtml(received.map((r, i) => `Hop ${i + 1}: ${r}`).join('\n'))}</div>` : ''}
    `;
  });
}

function renderXssLab(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="xss-in">Untrusted Input Sample (Rendered Safely as Escaped Text Only)</label>
        <input id="xss-in" class="input mono" value='<img src=x onerror="alert(1)">' />
      </div>
      <div class="grid-2">
        <div>
          <div class="field-label" style="margin-bottom: 6px;">Escaped HTML Entity Output</div>
          <div id="xss-escaped" class="output-box"></div>
        </div>
        <div>
          <div class="field-label" style="margin-bottom: 6px;">Safe DOM textContent Preview</div>
          <div id="xss-safe" class="output-box"></div>
        </div>
      </div>
    </div>
  `;

  function update() {
    const val = document.getElementById('xss-in').value;
    document.getElementById('xss-escaped').textContent = escapeHtml(val);
    document.getElementById('xss-safe').textContent = val;
  }
  document.getElementById('xss-in').addEventListener('input', update);
  update();
}

function renderCorsExplainer(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="co-page">Page Origin</label><input id="co-page" class="input mono" value="https://app.example.org" /></div>
        <div class="field-group"><label class="field-label" for="co-api">Target API Origin</label><input id="co-api" class="input mono" value="https://api.other-site.com" /></div>
        <div class="field-group"><label class="field-label" for="co-acao">Server Access-Control-Allow-Origin</label><input id="co-acao" class="input mono" value="(not sent)" /></div>
        <div class="field-group" style="justify-content: flex-end;"><label class="checkbox-row"><input type="checkbox" id="co-cred" /> Include credentials (cookies)</label></div>
      </div>
      <div id="co-out" class="output-box"></div>
    </div>
  `;

  function sim() {
    const page = document.getElementById('co-page').value.trim();
    const api = document.getElementById('co-api').value.trim();
    const acao = document.getElementById('co-acao').value.trim();
    const cred = document.getElementById('co-cred').checked;

    if (page === api) {
      document.getElementById('co-out').textContent = 'Same-Origin request: Permitted directly by browser Same-Origin Policy without CORS headers.';
      return;
    }
    if (cred && acao === '*') {
      document.getElementById('co-out').textContent = 'BLOCKED by Browser: Wildcard Access-Control-Allow-Origin (*) cannot be combined with credentials.';
      return;
    }
    if (acao === '*' || acao === page) {
      document.getElementById('co-out').textContent = 'ALLOWED by Browser: Cross-origin response explicitly permits this origin via CORS.';
    } else {
      document.getElementById('co-out').textContent = 'BLOCKED by Browser: Server did not grant this origin read access via Access-Control-Allow-Origin. Note: Simple requests may still reach the server unless protected by CSRF/auth checks; CORS only blocks browser JS from reading the response.';
    }
  }

  ['co-page', 'co-api', 'co-acao', 'co-cred'].forEach((id) => document.getElementById(id).addEventListener('input', sim));
  sim();
}
