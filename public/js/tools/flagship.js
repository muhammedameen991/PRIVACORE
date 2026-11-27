import { copyText, escapeHtml, showToast } from '../icons.js';
import { generateQrMatrix, qrToPngDataUrl, qrToSvg } from '../lib/qrcode.js';
import { detectMagicSignature, parseJpegMetadata, parsePngMetadata, stripImageMetadata } from '../lib/exif.js';
import { getTimerSettings, saveTimerSettings } from '../state.js';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'yclid', 'mc_eid', 'mc_cid',
  'igshid', 'si', '_hsenc', '_hsmi', 'mkt_tok', 'ref_src', 'ref_url'
]);

const WORDLIST = [
  'amber', 'anchor', 'atlas', 'aurora', 'badger', 'beacon', 'breeze', 'canyon',
  'cedar', 'cipher', 'cobalt', 'compass', 'coral', 'crater', 'cypress', 'delta',
  'drift', 'dune', 'echo', 'ember', 'falcon', 'fathom', 'flint', 'forest',
  'frost', 'glacier', 'granite', 'harbor', 'horizon', 'indigo', 'island', 'jasper',
  'kestrel', 'lagoon', 'lantern', 'larch', 'lichen', 'lumen', 'meadow', 'meridian',
  'mosaic', 'nebula', 'north', 'obsidian', 'olive', 'onyx', 'orbit', 'osprey',
  'pebble', 'phoenix', 'pine', 'plume', 'prism', 'quartz', 'raven', 'ridge',
  'river', 'saffron', 'sequoia', 'shale', 'signal', 'silver', 'solstice', 'spruce',
  'summit', 'timber', 'topaz', 'tundra', 'umbra', 'valley', 'velvet', 'verge',
  'vertex', 'violet', 'walnut', 'warden', 'willow', 'winter', 'zenith', 'zephyr'
];

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function renderFlagshipTool(kind, container) {
  switch (kind) {
    case 'privacy-check': return renderPrivacyCheck(container);
    case 'password-lab': return renderPasswordLab(container);
    case 'text-encryptor': return renderTextEncryptor(container);
    case 'dns-explorer': return renderDnsExplorer(container);
    case 'ip-explorer': return renderIpExplorer(container);
    case 'url-analyzer': return renderUrlAnalyzer(container);
    case 'metadata-inspector': return renderMetadataInspector(container);
    case 'secure-qr': return renderSecureQr(container);
    case 'fingerprint-awareness': return renderFingerprintAwareness(container);
    case 'leak-awareness': return renderLeakAwareness(container);
    case 'session-timer': return renderSessionTimer(container);
    case 'security-headers': return renderSecurityHeaders(container);
    default:
      container.innerHTML = '<div class="notice">Tool module not found.</div>';
  }
}

// 1. PRIVACY CHECK
async function renderPrivacyCheck(container) {
  container.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Browser Privacy Signals</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="pc-refresh-btn">Re-check</button>
        </div>
        <div id="pc-signals" class="table-wrap"></div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Supported Permission States</h3>
        </div>
        <div id="pc-perms" class="table-wrap"></div>
      </div>
    </div>
    <div class="panel">
      <h3 class="panel-title" style="margin-bottom: 10px;">Actionable Recommendations &amp; Honest Limits</h3>
      <div id="pc-recs" class="checklist-list"></div>
      <div class="notice" style="margin-top: 14px;">
        <strong>What a browser cannot verify:</strong> JavaScript inside a webpage cannot inspect your router DNS settings, OS firewall state, VPN tunnel status, installed privacy extensions, or whether Incognito/Private mode is active.
      </div>
    </div>
  `;

  async function runCheck() {
    const gpc = navigator.globalPrivacyControl;
    const dnt = navigator.doNotTrack;
    const secureCtx = window.isSecureContext;
    const cookies = navigator.cookieEnabled;
    const webdriver = navigator.webdriver;
    let idbAvail = 'Unknown';
    try {
      idbAvail = 'indexedDB' in window && window.indexedDB ? 'Available' : 'Disabled';
    } catch {
      idbAvail = 'Restricted';
    }
    let storageAvail = 'Unknown';
    try {
      localStorage.setItem('privacore:probe', '1');
      localStorage.removeItem('privacore:probe');
      storageAvail = 'Available';
    } catch {
      storageAvail = 'Blocked';
    }

    const signals = [
      ['Secure Context (HTTPS / localhost)', secureCtx ? 'Yes (Protected transport)' : 'No (Insecure context)', secureCtx ? 'ok' : 'danger'],
      ['Global Privacy Control (GPC)', gpc === true ? 'Enabled (true)' : gpc === false ? 'Explicitly false' : 'Not advertised (undefined)', gpc === true ? 'ok' : 'warn'],
      ['Do Not Track (DNT)', dnt === '1' ? 'Enabled (1)' : dnt || 'Unset', dnt === '1' ? 'ok' : 'neutral'],
      ['Cookies Enabled', cookies ? 'Enabled' : 'Disabled', 'neutral'],
      ['LocalStorage Access', storageAvail, 'neutral'],
      ['IndexedDB Access', idbAvail, 'neutral'],
      ['Automation Flag (webdriver)', webdriver ? 'True (automated browser)' : 'False', 'neutral']
    ];

    document.getElementById('pc-signals').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Capability</th><th>Observed State</th></tr></thead>
        <tbody>
          ${signals.map(([label, val, tone]) => `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td class="mono ${tone === 'ok' ? 'state-text-ok' : tone === 'warn' ? 'state-text-warn' : tone === 'danger' ? 'state-text-danger' : ''}">${escapeHtml(val)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const permNames = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read', 'clipboard-write', 'persistent-storage'];
    const permRows = [];
    for (const name of permNames) {
      if (!navigator.permissions || !navigator.permissions.query) {
        permRows.push([name, 'Permissions API unsupported']);
        continue;
      }
      try {
        const status = await navigator.permissions.query({ name });
        permRows.push([name, status.state]);
      } catch {
        permRows.push([name, 'Not queryable in this browser']);
      }
    }

    document.getElementById('pc-perms').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Permission</th><th>Current State</th></tr></thead>
        <tbody>
          ${permRows.map(([name, state]) => `
            <tr>
              <td class="mono">${escapeHtml(name)}</td>
              <td class="mono ${state === 'granted' ? 'state-text-warn' : state === 'denied' ? 'state-text-ok' : ''}">${escapeHtml(state)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const recs = [];
    if (gpc !== true) {
      recs.push('Enable Global Privacy Control (GPC) via a privacy-first browser (Firefox, Brave, DuckDuckGo) or extension to signal opt-out preferences.');
    }
    if (permRows.some(([, s]) => s === 'granted')) {
      recs.push('One or more sensitive permissions are currently granted on this origin. Review site permissions in your address bar lock/settings menu periodically.');
    }
    if (!secureCtx) {
      recs.push('You are viewing this page outside a secure context. Web Crypto and clipboard APIs require HTTPS or localhost.');
    }
    recs.push('Pair browser controls with a tracker blocker, HTTPS-Only mode, and encrypted DNS (DoH/DoT) at your browser or OS level.');

    document.getElementById('pc-recs').innerHTML = recs
      .map((r) => `<div class="notice">${escapeHtml(r)}</div>`)
      .join('');
  }

  document.getElementById('pc-refresh-btn').addEventListener('click', runCheck);
  await runCheck();
}

// 2. PASSWORD LAB
function renderPasswordLab(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="pw-output">Generated Output (CSPRNG Local)</label>
        <div class="input-row">
          <input id="pw-output" class="input mono" type="text" readonly aria-label="Generated password" />
          <button type="button" class="btn btn-primary" id="pw-gen-btn">Generate</button>
          <button type="button" class="btn btn-secondary" id="pw-copy-btn">Copy</button>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="field-group">
            <label class="field-label" for="pw-length">Length: <span id="pw-length-val" class="mono">20</span> characters</label>
            <input id="pw-length" type="range" min="8" max="128" value="20" style="width: 100%; accent-color: var(--accent);" />
          </div>
          <div class="field-group">
            <label class="checkbox-row"><input type="checkbox" id="pw-upper" checked /> Uppercase (A-Z)</label>
            <label class="checkbox-row"><input type="checkbox" id="pw-lower" checked /> Lowercase (a-z)</label>
            <label class="checkbox-row"><input type="checkbox" id="pw-digits" checked /> Numbers (0-9)</label>
            <label class="checkbox-row"><input type="checkbox" id="pw-symbols" checked /> Symbols (!@#$%^&amp;*...)</label>
            <label class="checkbox-row"><input type="checkbox" id="pw-no-ambig" /> Exclude ambiguous (0, O, 1, l, I)</label>
          </div>
        </div>
        <div class="panel" style="background: var(--bg-canvas);">
          <h3 class="panel-title" style="margin-bottom: 10px;">Strength Estimation</h3>
          <div id="pw-strength-metrics" style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px;"></div>
          <div style="margin-top: 14px;">
            <button type="button" class="btn btn-secondary btn-sm" id="pw-passphrase-btn">Generate 5-Word Passphrase Instead</button>
          </div>
        </div>
      </div>
    </div>
  `;

  function randomInt(max) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let val;
    do {
      crypto.getRandomValues(arr);
      val = arr[0];
    } while (val >= limit);
    return val % max;
  }

  function updateStrength(text, poolSize) {
    const len = text.length;
    const entropy = poolSize > 1 ? len * Math.log2(poolSize) : len * Math.log2(WORDLIST.length);
    let label = 'Weak';
    let cls = 'state-text-danger';
    if (entropy >= 100) { label = 'Very Strong'; cls = 'state-text-ok'; }
    else if (entropy >= 70) { label = 'Strong'; cls = 'state-text-ok'; }
    else if (entropy >= 50) { label = 'Moderate'; cls = 'state-text-warn'; }

    document.getElementById('pw-strength-metrics').innerHTML = `
      <div>Rating: <span class="${cls}">${escapeHtml(label)}</span></div>
      <div>Estimated Entropy: <span class="mono">${entropy.toFixed(1)} bits</span></div>
      <div>Character Pool: <span class="mono">${poolSize > 1 ? `${poolSize} symbols` : `${WORDLIST.length} words`}</span></div>
      <div class="field-hint">Generated using <code>window.crypto.getRandomValues()</code> with rejection sampling to eliminate modulo bias. Zero network calls.</div>
    `;
  }

  function generatePassword() {
    const len = Number(document.getElementById('pw-length').value);
    document.getElementById('pw-length-val').textContent = String(len);

    const noAmbig = document.getElementById('pw-no-ambig').checked;
    let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lower = 'abcdefghijklmnopqrstuvwxyz';
    let digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{};:,.?/';
    if (noAmbig) {
      upper = upper.replace(/[OI]/g, '');
      lower = lower.replace(/[ol]/g, '');
      digits = digits.replace(/[01]/g, '');
    }

    const activeSets = [];
    if (document.getElementById('pw-upper').checked) activeSets.push(upper);
    if (document.getElementById('pw-lower').checked) activeSets.push(lower);
    if (document.getElementById('pw-digits').checked) activeSets.push(digits);
    if (document.getElementById('pw-symbols').checked) activeSets.push(symbols);

    if (activeSets.length === 0) {
      showToast('Select at least one character category.');
      return;
    }

    const fullPool = activeSets.join('');
    const chars = [];
    // Guarantee at least one character from each selected category
    for (const set of activeSets) {
      chars.push(set[randomInt(set.length)]);
    }
    while (chars.length < len) {
      chars.push(fullPool[randomInt(fullPool.length)]);
    }
    // Fisher-Yates shuffle using CSPRNG
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    const pw = chars.slice(0, len).join('');
    document.getElementById('pw-output').value = pw;
    updateStrength(pw, fullPool.length);
  }

  function generatePassphrase() {
    const words = Array.from({ length: 5 }, () => WORDLIST[randomInt(WORDLIST.length)]);
    const phrase = words.join('-');
    document.getElementById('pw-output').value = phrase;
    const entropy = 5 * Math.log2(WORDLIST.length);
    document.getElementById('pw-strength-metrics').innerHTML = `
      <div>Rating: <span class="state-text-warn">Moderate-Strong Passphrase (~${entropy.toFixed(1)} bits)</span></div>
      <div>Words: <span class="mono">5 words from ${WORDLIST.length}-word list</span></div>
      <div class="field-hint">Increase to 6–7 words or add a random digit/symbol for high-value master passwords.</div>
    `;
  }

  document.getElementById('pw-length').addEventListener('input', generatePassword);
  ['pw-upper', 'pw-lower', 'pw-digits', 'pw-symbols', 'pw-no-ambig'].forEach((id) => {
    document.getElementById(id).addEventListener('change', generatePassword);
  });
  document.getElementById('pw-gen-btn').addEventListener('click', generatePassword);
  document.getElementById('pw-passphrase-btn').addEventListener('click', generatePassphrase);
  document.getElementById('pw-copy-btn').addEventListener('click', () => {
    copyText(document.getElementById('pw-output').value, 'Password copied locally');
  });

  generatePassword();
}

// 3. TEXT ENCRYPTOR (AES-256-GCM)
function renderTextEncryptor(container) {
  container.innerHTML = `
    <div class="notice notice-warn">
      <strong>Key Security Notice:</strong> Encryption protects content only when keys or passphrases are strong, kept confidential, and delivered separately from the ciphertext. Nothing leaves your browser.
    </div>

    <div class="panel">
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="enc-mode">Key Mode</label>
          <select id="enc-mode" class="select">
            <option value="passphrase">Passphrase (PBKDF2-SHA256, 310,000 iterations)</option>
            <option value="rawkey">256-bit Random Key (Base64)</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="enc-secret">Passphrase or Base64 256-bit Key</label>
          <div class="input-row">
            <input id="enc-secret" class="input mono" type="password" placeholder="Enter passphrase or generate random key" autocomplete="off" />
            <button type="button" class="btn btn-secondary btn-sm" id="enc-toggle-vis">Show</button>
            <button type="button" class="btn btn-secondary btn-sm" id="enc-gen-key">Generate Key</button>
          </div>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="enc-input">Input (Plaintext to Encrypt OR JSON Ciphertext Payload to Decrypt)</label>
        <textarea id="enc-input" class="textarea" placeholder="Enter plaintext message or paste PRIVACORE AES-GCM JSON payload..."></textarea>
      </div>

      <div class="input-row" style="margin-bottom: 14px;">
        <button type="button" class="btn btn-primary" id="enc-encrypt-btn">Encrypt (AES-256-GCM)</button>
        <button type="button" class="btn btn-secondary" id="enc-decrypt-btn">Decrypt</button>
        <button type="button" class="btn btn-secondary" id="enc-copy-btn">Copy Output</button>
        <button type="button" class="btn btn-danger" id="enc-clear-btn">Clear Sensitive Fields</button>
      </div>

      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label" for="enc-output">Output</label>
        <textarea id="enc-output" class="textarea" readonly placeholder="Encrypted payload or decrypted plaintext appears here..."></textarea>
      </div>
      <div id="enc-status" class="field-hint" style="margin-top: 8px;"></div>
    </div>
  `;

  async function deriveAesKeyFromPassphrase(passphrase, saltBytes) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: 310000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function importRawAesKey(b64Key) {
    const raw = base64ToBytes(b64Key);
    if (raw.length !== 32) {
      throw new Error('Raw key must decode to exactly 32 bytes (256 bits).');
    }
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  document.getElementById('enc-toggle-vis').addEventListener('click', (e) => {
    const inp = document.getElementById('enc-secret');
    const isPw = inp.type === 'password';
    inp.type = isPw ? 'text' : 'password';
    e.currentTarget.textContent = isPw ? 'Hide' : 'Show';
  });

  document.getElementById('enc-gen-key').addEventListener('click', () => {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    document.getElementById('enc-mode').value = 'rawkey';
    const inp = document.getElementById('enc-secret');
    inp.type = 'text';
    inp.value = bytesToBase64(keyBytes);
    document.getElementById('enc-toggle-vis').textContent = 'Hide';
    showToast('Generated 256-bit AES-GCM key locally.');
  });

  document.getElementById('enc-encrypt-btn').addEventListener('click', async () => {
    const status = document.getElementById('enc-status');
    try {
      const mode = document.getElementById('enc-mode').value;
      const secret = document.getElementById('enc-secret').value;
      const plaintext = document.getElementById('enc-input').value;
      if (!secret) throw new Error('Enter a passphrase or generate a 256-bit key.');
      if (!plaintext) throw new Error('Enter plaintext to encrypt.');

      const iv = crypto.getRandomValues(new Uint8Array(12));
      let key;
      let saltB64 = null;
      if (mode === 'passphrase') {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        saltB64 = bytesToBase64(salt);
        key = await deriveAesKeyFromPassphrase(secret, salt);
      } else {
        key = await importRawAesKey(secret);
      }

      const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );

      const payload = {
        alg: 'AES-256-GCM',
        kdf: mode === 'passphrase' ? 'PBKDF2-SHA256-310000' : 'RAW-256',
        salt: saltB64,
        iv: bytesToBase64(iv),
        ct: bytesToBase64(new Uint8Array(cipherBuf))
      };

      document.getElementById('enc-output').value = JSON.stringify(payload, null, 2);
      status.textContent = 'Encrypted locally using Web Crypto AES-256-GCM with fresh random 96-bit IV.';
      status.className = 'field-hint state-text-ok';
    } catch (err) {
      status.textContent = err.message || 'Encryption failed.';
      status.className = 'field-hint state-text-danger';
    }
  });

  document.getElementById('enc-decrypt-btn').addEventListener('click', async () => {
    const status = document.getElementById('enc-status');
    try {
      const secret = document.getElementById('enc-secret').value;
      const rawInput = document.getElementById('enc-input').value.trim();
      if (!secret) throw new Error('Provide the passphrase or 256-bit key used to encrypt.');
      if (!rawInput) throw new Error('Paste the JSON ciphertext payload into the Input box.');

      const payload = JSON.parse(rawInput);
      if (!payload || payload.alg !== 'AES-256-GCM' || !payload.iv || !payload.ct) {
        throw new Error('Unrecognized ciphertext payload format.');
      }

      const iv = base64ToBytes(payload.iv);
      const ct = base64ToBytes(payload.ct);
      let key;
      if (payload.kdf && payload.kdf.startsWith('PBKDF2')) {
        if (!payload.salt) throw new Error('Missing KDF salt in payload.');
        key = await deriveAesKeyFromPassphrase(secret, base64ToBytes(payload.salt));
      } else {
        key = await importRawAesKey(secret);
      }

      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      document.getElementById('enc-output').value = new TextDecoder().decode(plainBuf);
      status.textContent = 'Decrypted and authenticated successfully (GCM tag verified).';
      status.className = 'field-hint state-text-ok';
    } catch {
      status.textContent = 'Decryption failed: wrong key/passphrase or modified ciphertext.';
      status.className = 'field-hint state-text-danger';
    }
  });

  document.getElementById('enc-copy-btn').addEventListener('click', () => {
    const val = document.getElementById('enc-output').value;
    if (val) copyText(val, 'Output copied');
  });

  document.getElementById('enc-clear-btn').addEventListener('click', () => {
    document.getElementById('enc-secret').value = '';
    document.getElementById('enc-input').value = '';
    document.getElementById('enc-output').value = '';
    document.getElementById('enc-status').textContent = 'Sensitive fields cleared from view.';
    document.getElementById('enc-status').className = 'field-hint';
  });
}

// 4. DNS EXPLORER
function renderDnsExplorer(container) {
  container.innerHTML = `
    <div class="panel">
      <form id="dns-form" class="input-row">
        <input id="dns-domain" class="input mono" type="text" placeholder="example.org" value="example.org" aria-label="Domain name" required />
        <select id="dns-type" class="select" style="max-width: 150px;" aria-label="DNS record type">
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="MX">MX</option>
          <option value="TXT">TXT</option>
          <option value="NS">NS</option>
          <option value="CNAME">CNAME</option>
          <option value="SOA">SOA</option>
          <option value="CAA">CAA</option>
        </select>
        <button type="submit" class="btn btn-primary">Lookup Records</button>
      </form>
      <div class="field-hint" style="margin-top: 8px;">Queries validated public domains via Cloudflare/Google DNS-over-HTTPS. Private/local names are blocked.</div>
    </div>
    <div id="dns-results"></div>
  `;

  async function lookup(e) {
    if (e) e.preventDefault();
    const domain = document.getElementById('dns-domain').value.trim();
    const type = document.getElementById('dns-type').value;
    const out = document.getElementById('dns-results');
    out.innerHTML = '<div class="panel">Querying public DoH resolver...</div>';

    try {
      const resp = await fetch(`/api/dns?domain=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`);
      const data = await resp.json();
      if (!resp.ok) {
        out.innerHTML = `<div class="notice notice-danger">${escapeHtml(data.error || 'DNS lookup failed.')}</div>`;
        return;
      }

      if (!data.records || data.records.length === 0) {
        out.innerHTML = `
          <div class="panel">
            <div class="notice">No <strong>${escapeHtml(data.recordType)}</strong> records returned for <span class="mono">${escapeHtml(data.domain)}</span> (DNS Status ${escapeHtml(String(data.status))}).</div>
            <div class="field-hint" style="margin-top: 10px;">Provider: ${escapeHtml(data.provider)} · DNSSEC AD flag: ${data.ad ? 'Authenticated (true)' : 'Not set (false)'}</div>
          </div>
        `;
        return;
      }

      out.innerHTML = `
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title"><span class="mono">${escapeHtml(data.domain)}</span> (${escapeHtml(data.recordType)})</h3>
            <span class="field-hint">Provider: ${escapeHtml(data.provider)} · DNSSEC AD: ${data.ad ? 'true' : 'false'}</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Type</th><th class="num">TTL</th><th>Value</th></tr></thead>
              <tbody>
                ${data.records.map((r) => `
                  <tr>
                    <td class="mono">${escapeHtml(r.name)}</td>
                    <td class="mono">${escapeHtml(r.type)}</td>
                    <td class="num">${escapeHtml(String(r.ttl))}s</td>
                    <td class="mono" style="word-break: break-all;">${escapeHtml(r.data)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="field-hint" style="margin-top: 10px;">${escapeHtml(data.note)}</div>
        </div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Network error while reaching /api/dns.</div>';
    }
  }

  document.getElementById('dns-form').addEventListener('submit', lookup);
}

// 5. IP EXPLORER
function renderIpExplorer(container) {
  container.innerHTML = `
    <div class="panel">
      <form id="ip-form" class="input-row">
        <input id="ip-input" class="input mono" type="text" placeholder="Leave blank for your request IP, or enter public IPv4/IPv6 (e.g., 1.1.1.1)" aria-label="Public IP address" />
        <button type="submit" class="btn btn-primary">Inspect IP</button>
        <button type="button" class="btn btn-secondary" id="ip-self-btn">Check Current Request IP</button>
      </form>
    </div>
    <div id="ip-results"></div>
    <div class="notice">
      <strong>IP Geolocation Limitations:</strong> Public IP databases map network allocation blocks registered to ISPs, mobile carriers, or VPN providers. City/region coordinates are approximate routing hubs—not physical street addresses—and can shift with CGNAT or carrier routing.
    </div>
  `;

  async function inspect(ipVal = '') {
    const out = document.getElementById('ip-results');
    out.innerHTML = '<div class="panel">Fetching public IP metadata...</div>';
    try {
      const qs = ipVal ? `?ip=${encodeURIComponent(ipVal)}` : '';
      const resp = await fetch(`/api/ip${qs}`);
      const data = await resp.json();
      if (!resp.ok) {
        out.innerHTML = `<div class="notice notice-danger">${escapeHtml(data.error || 'IP lookup failed.')}</div>`;
        return;
      }

      const rows = [
        ['IP Address', data.ip || 'Unavailable'],
        ['IP Version', data.version || 'Unknown'],
        ['ASN', data.asn || 'Unavailable'],
        ['Organization / ISP', data.org || 'Unavailable'],
        ['Approximate Country', data.country ? `${data.country}${data.countryCode ? ` (${data.countryCode})` : ''}` : 'Unavailable'],
        ['Approximate Region / City', [data.region, data.city].filter(Boolean).join(', ') || 'Unavailable'],
        ['Provider Timezone', data.timezone || 'Unavailable'],
        ['Data Source', data.provider || 'External provider']
      ];

      out.innerHTML = `
        <div class="panel">
          ${data.note ? `<div class="notice" style="margin-bottom: 12px;">${escapeHtml(data.note)}</div>` : ''}
          <div class="table-wrap">
            <table class="data-table">
              <tbody>
                ${rows.map(([k, v]) => `<tr><th style="width: 240px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="field-hint" style="margin-top: 10px;">${escapeHtml(data.disclaimer)}</div>
        </div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Unable to reach /api/ip endpoint.</div>';
    }
  }

  document.getElementById('ip-form').addEventListener('submit', (e) => {
    e.preventDefault();
    inspect(document.getElementById('ip-input').value.trim());
  });
  document.getElementById('ip-self-btn').addEventListener('click', () => {
    document.getElementById('ip-input').value = '';
    inspect('');
  });

  inspect('');
}

// 6. URL ANALYZER
function renderUrlAnalyzer(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="ua-input">Paste a URL to inspect locally (PRIVACORE will NOT visit or fetch this link)</label>
        <div class="input-row">
          <input id="ua-input" class="input mono" type="text" placeholder="https://example.com/login?utm_source=newsletter" />
          <button type="button" class="btn btn-primary" id="ua-analyze-btn">Analyze URL</button>
        </div>
      </div>
    </div>
    <div id="ua-output"></div>
  `;

  function analyze() {
    const raw = document.getElementById('ua-input').value.trim();
    const out = document.getElementById('ua-output');
    if (!raw) {
      out.innerHTML = '<div class="notice">Paste a URL above to inspect its structure locally.</div>';
      return;
    }

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Invalid URL syntax. Include scheme such as https:// or http://.</div>';
      return;
    }

    const findings = [];
    if (parsed.protocol === 'https:') {
      findings.push({ level: 'ok', text: 'Uses HTTPS scheme (encrypted transport when certificate is valid).' });
    } else if (parsed.protocol === 'http:') {
      findings.push({ level: 'warn', text: 'Uses unencrypted HTTP scheme; traffic can be observed or altered on transit networks.' });
    } else {
      findings.push({ level: 'danger', text: `Non-web scheme detected (${parsed.protocol}); executable or data schemes can pose script-injection risks.` });
    }

    if (parsed.username || parsed.password) {
      findings.push({ level: 'danger', text: 'Contains embedded @ credentials (userinfo), a common phishing technique to disguise the true host.' });
    }
    if (parsed.hostname.includes('xn--')) {
      findings.push({ level: 'warn', text: 'Contains Punycode (xn--) internationalized domain label; verify the rendered domain carefully for lookalike characters.' });
    }
    if (/[^\x00-\x7F]/.test(parsed.hostname)) {
      findings.push({ level: 'warn', text: 'Hostname contains non-ASCII characters; inspect for potential homoglyphs.' });
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) || parsed.hostname.startsWith('[')) {
      findings.push({ level: 'warn', text: 'Uses a raw IP address instead of a domain name.' });
    }
    const labels = parsed.hostname.split('.');
    if (labels.length >= 4) {
      findings.push({ level: 'warn', text: `Deep subdomain nesting (${labels.length} labels); attackers sometimes place brand names in subdomains.` });
    }
    if (parsed.port && parsed.port !== '443' && parsed.port !== '80') {
      findings.push({ level: 'warn', text: `Non-standard port specified (:${parsed.port}).` });
    }

    const cleanedUrl = new URL(parsed.toString());
    const removedTrackers = [];
    for (const key of Array.from(cleanedUrl.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        removedTrackers.push(key);
        cleanedUrl.searchParams.delete(key);
      }
    }

    out.innerHTML = `
      <div class="panel">
        <h3 class="panel-title" style="margin-bottom: 12px;">Structural Breakdown</h3>
        <div class="table-wrap" style="margin-bottom: 16px;">
          <table class="data-table">
            <tbody>
              <tr><th style="width: 190px;">Scheme</th><td class="mono">${escapeHtml(parsed.protocol)}</td></tr>
              <tr><th>Hostname</th><td class="mono">${escapeHtml(parsed.hostname || '(none)')}</td></tr>
              <tr><th>Port</th><td class="mono">${escapeHtml(parsed.port || '(default)')}</td></tr>
              <tr><th>Path</th><td class="mono">${escapeHtml(parsed.pathname)}</td></tr>
              <tr><th>Query Parameters</th><td class="mono">${parsed.searchParams.size} total (${removedTrackers.length} known tracking params)</td></tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin: 0 0 8px; font-size: 14px;">Observed Characteristics</h4>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          ${findings.map((f) => `<div class="notice ${f.level === 'ok' ? 'notice-ok' : f.level === 'warn' ? 'notice-warn' : 'notice-danger'}">${escapeHtml(f.text)}</div>`).join('')}
        </div>

        ${removedTrackers.length > 0 ? `
          <div class="field-group">
            <label class="field-label">Cleaned URL (Tracking Parameters Removed)</label>
            <div class="input-row">
              <input class="input mono" type="text" readonly value="${escapeHtml(cleanedUrl.toString())}" id="ua-cleaned" />
              <button type="button" class="btn btn-secondary btn-sm" id="ua-copy-clean">Copy Clean URL</button>
            </div>
          </div>
        ` : ''}

        <div class="field-hint">Structural analysis only. A clean structure does not guarantee a site is safe or free of phishing/malware.</div>
      </div>
    `;

    const copyClean = document.getElementById('ua-copy-clean');
    if (copyClean) {
      copyClean.addEventListener('click', () => copyText(cleanedUrl.toString(), 'Clean URL copied'));
    }
  }

  document.getElementById('ua-analyze-btn').addEventListener('click', analyze);
}

// 7. METADATA INSPECTOR
function renderMetadataInspector(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="meta-file-input">Select a local image file (JPEG, PNG, WebP, GIF) — never uploaded</label>
        <div class="input-row">
          <input id="meta-file-input" class="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          <button type="button" class="btn btn-danger btn-sm" id="meta-clear-btn">Clear File</button>
        </div>
      </div>
    </div>
    <div id="meta-output"></div>
  `;

  const fileInput = document.getElementById('meta-file-input');
  const clearBtn = document.getElementById('meta-clear-btn');
  const out = document.getElementById('meta-output');

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    out.innerHTML = '<div class="notice">Selected file cleared from memory.</div>';
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magic = detectMagicSignature(bytes);

    let parsedHtml = '';
    if (magic.mime === 'image/jpeg') {
      const jpeg = parseJpegMetadata(buffer);
      const exifEntries = Object.entries(jpeg.exif);
      parsedHtml += `
        <h4 style="margin: 16px 0 8px; font-size: 14px;">JPEG EXIF Tags (${exifEntries.length} found)</h4>
        ${exifEntries.length > 0 ? `
          <div class="table-wrap">
            <table class="data-table">
              <tbody>
                ${exifEntries.map(([k, v]) => `<tr><th style="width: 220px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(String(v))}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="notice notice-ok">No standard EXIF tags detected in APP1 segment.</div>'}
        ${jpeg.gps ? `<div class="notice notice-danger" style="margin-top: 10px;"><strong>GPS Coordinates Found:</strong> Latitude <span class="mono">${jpeg.gps.latitude}</span>, Longitude <span class="mono">${jpeg.gps.longitude}</span></div>` : ''}
      `;
    } else if (magic.mime === 'image/png') {
      const png = parsePngMetadata(buffer);
      const textEntries = Object.entries(png.textChunks);
      parsedHtml += `
        <h4 style="margin: 16px 0 8px; font-size: 14px;">PNG Chunks (${png.chunks.join(', ')})</h4>
        ${png.width ? `<div class="field-hint">Dimensions: ${png.width} × ${png.height} px</div>` : ''}
        ${textEntries.length > 0 ? `
          <div class="table-wrap" style="margin-top: 8px;">
            <table class="data-table">
              <tbody>
                ${textEntries.map(([k, v]) => `<tr><th style="width: 220px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="notice notice-ok" style="margin-top: 8px;">No PNG tEXt metadata chunks found.</div>'}
      `;
    } else {
      parsedHtml += '<div class="notice" style="margin-top: 12px;">Basic container info displayed. Deep EXIF parsing applies to JPEG and PNG files.</div>';
    }

    out.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">${escapeHtml(file.name)}</h3>
          <button type="button" class="btn btn-primary btn-sm" id="meta-strip-btn">Strip Metadata &amp; Download Clean Copy</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <tbody>
              <tr><th style="width: 220px;">File Size</th><td class="mono">${(file.size / 1024).toFixed(2)} KB (${file.size} bytes)</td></tr>
              <tr><th>Declared Type</th><td class="mono">${escapeHtml(file.type || 'Unknown')}</td></tr>
              <tr><th>Detected Magic Signature</th><td class="mono">${escapeHtml(magic.type)} (${escapeHtml(magic.hex.slice(0, 23))})</td></tr>
              <tr><th>Last Modified (Local OS)</th><td class="mono">${new Date(file.lastModified).toISOString()}</td></tr>
            </tbody>
          </table>
        </div>
        ${parsedHtml}
      </div>
    `;

    document.getElementById('meta-strip-btn').addEventListener('click', async () => {
      try {
        const clean = await stripImageMetadata(file);
        const url = URL.createObjectURL(clean.blob);
        const a = document.createElement('a');
        const ext = clean.mime.split('/')[1] || 'png';
        a.href = url;
        a.download = `clean_${file.name.replace(/\.[^.]+$/, '')}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Clean metadata-free image downloaded.');
      } catch (err) {
        showToast(err.message || 'Unable to strip metadata from this file.');
      }
    });
  });
}

// 8. SECURE QR
function renderSecureQr(container) {
  container.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="field-group">
          <label class="field-label" for="qr-mode">Payload Type</label>
          <select id="qr-mode" class="select">
            <option value="text">Plain Text / Note</option>
            <option value="url">Website URL</option>
            <option value="wifi">Wi-Fi Network Configuration</option>
          </select>
        </div>

        <div id="qr-fields-text">
          <div class="field-group">
            <label class="field-label" for="qr-text-val">Text or URL</label>
            <textarea id="qr-text-val" class="textarea" placeholder="https://example.org">https://github.com/muhammedameen991/PRIVACORE</textarea>
          </div>
        </div>

        <div id="qr-fields-wifi" hidden>
          <div class="field-group">
            <label class="field-label" for="qr-ssid">Network Name (SSID)</label>
            <input id="qr-ssid" class="input" type="text" placeholder="GuestNetwork" />
          </div>
          <div class="field-group">
            <label class="field-label" for="qr-wifi-pass">Password</label>
            <input id="qr-wifi-pass" class="input mono" type="text" placeholder="Passphrase" />
          </div>
          <div class="grid-2">
            <div class="field-group">
              <label class="field-label" for="qr-wifi-enc">Encryption</label>
              <select id="qr-wifi-enc" class="select">
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP (Legacy)</option>
                <option value="nopass">Open (No Password)</option>
              </select>
            </div>
            <div class="field-group" style="justify-content: flex-end;">
              <label class="checkbox-row"><input type="checkbox" id="qr-wifi-hidden" /> Hidden SSID</label>
            </div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="qr-ec">Error Correction</label>
          <select id="qr-ec" class="select">
            <option value="M" selected>M (15% recovery — balanced)</option>
            <option value="L">L (7% recovery — compact)</option>
            <option value="Q">Q (25% recovery)</option>
            <option value="H">H (30% recovery — resilient)</option>
          </select>
        </div>

        <div class="input-row">
          <button type="button" class="btn btn-primary" id="qr-gen-btn">Generate QR</button>
          <button type="button" class="btn btn-secondary" id="qr-dl-png">Download PNG</button>
          <button type="button" class="btn btn-secondary" id="qr-dl-svg">Download SVG</button>
        </div>
      </div>

      <div class="panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;">
        <div id="qr-preview" class="qr-preview-box" aria-label="QR Code Preview"></div>
        <div id="qr-meta" class="field-hint mono"></div>
      </div>
    </div>
  `;

  let lastQr = null;
  let lastSvg = '';

  function escapeWifi(val) {
    return val.replace(/([\\;,:"])/g, '\\$1');
  }

  function getPayload() {
    const mode = document.getElementById('qr-mode').value;
    if (mode === 'wifi') {
      const ssid = document.getElementById('qr-ssid').value;
      const pass = document.getElementById('qr-wifi-pass').value;
      const enc = document.getElementById('qr-wifi-enc').value;
      const hidden = document.getElementById('qr-wifi-hidden').checked;
      return `WIFI:T:${enc};S:${escapeWifi(ssid)};P:${enc === 'nopass' ? '' : escapeWifi(pass)};H:${hidden ? 'true' : 'false'};;`;
    }
    return document.getElementById('qr-text-val').value;
  }

  function render() {
    const preview = document.getElementById('qr-preview');
    const meta = document.getElementById('qr-meta');
    try {
      const payload = getPayload();
      if (!payload) {
        preview.innerHTML = '<div style="color:#111;padding:24px;">Enter content to generate QR.</div>';
        return;
      }
      const ec = document.getElementById('qr-ec').value;
      lastQr = generateQrMatrix(payload, ec);
      lastSvg = qrToSvg(lastQr);
      preview.innerHTML = lastSvg;
      meta.textContent = `Version ${lastQr.version} (${lastQr.size}×${lastQr.size} modules) · EC ${ec} · Local SVG`;
    } catch (err) {
      lastQr = null;
      preview.innerHTML = `<div style="color:#b91c1c;padding:16px;max-width:240px;">${escapeHtml(err.message)}</div>`;
      meta.textContent = '';
    }
  }

  document.getElementById('qr-mode').addEventListener('change', (e) => {
    const isWifi = e.target.value === 'wifi';
    document.getElementById('qr-fields-text').hidden = isWifi;
    document.getElementById('qr-fields-wifi').hidden = !isWifi;
    render();
  });

  ['qr-text-val', 'qr-ssid', 'qr-wifi-pass', 'qr-wifi-enc', 'qr-wifi-hidden', 'qr-ec'].forEach((id) => {
    document.getElementById(id).addEventListener('input', render);
  });
  document.getElementById('qr-gen-btn').addEventListener('click', render);

  document.getElementById('qr-dl-png').addEventListener('click', () => {
    if (!lastQr) return;
    const a = document.createElement('a');
    a.href = qrToPngDataUrl(lastQr);
    a.download = 'privacore-qr.png';
    a.click();
    showToast('QR PNG downloaded.');
  });

  document.getElementById('qr-dl-svg').addEventListener('click', () => {
    if (!lastSvg) return;
    const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacore-qr.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('QR SVG downloaded.');
  });

  render();
}

// 9. FINGERPRINT AWARENESS
async function renderFingerprintAwareness(container) {
  container.innerHTML = `
    <div class="notice">
      <strong>Zero-Tracking Guarantee:</strong> PRIVACORE computes these observable signals strictly in memory to educate you about browser fingerprinting surfaces. No persistent identifier is stored or transmitted, and this report cannot measure global uniqueness or guarantee anonymity.
    </div>
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Observable Browser Surface</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="fp-refresh">Refresh Signals</button>
      </div>
      <div id="fp-table" class="table-wrap"></div>
    </div>
  `;

  async function inspect() {
    // Ephemeral canvas digest
    let canvasHash = 'Blocked / Unavailable';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#15171e';
      ctx.fillRect(0, 0, 220, 40);
      ctx.fillStyle = '#8b5cf6';
      ctx.font = '14px sans-serif';
      ctx.fillText('PRIVACORE-Surface-Test', 10, 25);
      const dataUrl = canvas.toDataURL();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl));
      canvasHash = Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('') + '...';
    } catch {
      canvasHash = 'Restricted';
    }

    let webglInfo = 'Unavailable';
    try {
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        webglInfo = dbg
          ? `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)} · ${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}`
          : `${gl.getParameter(gl.VENDOR)} · ${gl.getParameter(gl.RENDERER)}`;
      }
    } catch {
      webglInfo = 'Restricted';
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    const rows = [
      ['User-Agent', navigator.userAgent],
      ['Platform', navigator.platform || 'Not exposed'],
      ['Languages', (navigator.languages || [navigator.language]).join(', ')],
      ['Timezone', `${tz} (UTC offset ${-new Date().getTimezoneOffset() / 60}h)`],
      ['Screen & Color Depth', `${screen.width}×${screen.height} · ${screen.colorDepth}-bit · DPR ${window.devicePixelRatio}`],
      ['Viewport Size', `${window.innerWidth}×${window.innerHeight}`],
      ['Hardware Concurrency / Memory', `${navigator.hardwareConcurrency ?? 'N/A'} threads · ${navigator.deviceMemory ?? 'N/A'} GB`],
      ['Touch Points', String(navigator.maxTouchPoints ?? 0)],
      ['Ephemeral Canvas Hash Prefix', canvasHash],
      ['WebGL Surface', webglInfo]
    ];

    document.getElementById('fp-table').innerHTML = `
      <table class="data-table">
        <tbody>
          ${rows.map(([k, v]) => `<tr><th style="width: 240px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('fp-refresh').addEventListener('click', inspect);
  await inspect();
}

// 10. LEAK AWARENESS
function renderLeakAwareness(container) {
  container.innerHTML = `
    <div class="notice notice-warn">
      <strong>Important Limitation:</strong> Browser JavaScript cannot verify whether a VPN kill switch, OS DNS routing table, or split-tunnel configuration is leak-free. Never conclude a VPN is completely secure from browser checks alone.
    </div>

    <div class="grid-2">
      <div class="panel">
        <h3 class="panel-title" style="margin-bottom: 10px;">Browser-Observable Network State</h3>
        <div id="la-state" class="table-wrap"></div>
        <div style="margin-top: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" id="la-rtc-btn">Inspect Local WebRTC ICE Availability (No External STUN)</button>
        </div>
        <div id="la-rtc-out" style="margin-top: 12px;"></div>
      </div>

      <div class="panel">
        <h3 class="panel-title" style="margin-bottom: 10px;">Types of Network Leaks &amp; Where to Verify</h3>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13.5px; color: var(--text-secondary);">
          <div><strong>DNS Leaks:</strong> Occur when OS sends DNS lookups to an ISP resolver outside the encrypted tunnel. Verify at your OS network adapter settings (<code>scutil --dns</code>, <code>resolvectl status</code>) rather than trusting a webpage alone.</div>
          <div><strong>IPv6 Leaks:</strong> Occur when a VPN tunnels only IPv4 while dual-stack IPv6 traffic routes directly over your ISP.</div>
          <div><strong>WebRTC Exposure:</strong> Modern browsers replace local LAN IPs with mDNS <code>.local</code> hostnames unless explicitly configured otherwise.</div>
        </div>
      </div>
    </div>
  `;

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const rows = [
    ['navigator.onLine', navigator.onLine ? 'Online' : 'Offline'],
    ['RTCPeerConnection API', typeof window.RTCPeerConnection === 'function' ? 'Exposed by browser' : 'Disabled / Blocked'],
    ['Connection Effective Type', conn?.effectiveType || 'Not exposed'],
    ['Estimated Downlink', conn?.downlink !== undefined ? `${conn.downlink} Mbps` : 'Not exposed']
  ];
  document.getElementById('la-state').innerHTML = `
    <table class="data-table">
      <tbody>
        ${rows.map(([k, v]) => `<tr><th style="width: 220px;">${escapeHtml(k)}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('la-rtc-btn').addEventListener('click', async () => {
    const out = document.getElementById('la-rtc-out');
    if (typeof window.RTCPeerConnection !== 'function') {
      out.innerHTML = '<div class="notice notice-ok">RTCPeerConnection is disabled or unavailable in this browser.</div>';
      return;
    }
    out.innerHTML = '<div class="field-hint">Gathering local-only ICE candidates (iceServers: [])...</div>';
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const candidates = [];
      pc.createDataChannel('probe');
      pc.onicecandidate = (ev) => {
        if (ev.candidate) candidates.push(ev.candidate.candidate);
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((r) => setTimeout(r, 900));
      pc.close();
      if (candidates.length === 0) {
        out.innerHTML = '<div class="notice">No local ICE candidates emitted without STUN servers (common in hardened browsers or mDNS masking).</div>';
      } else {
        out.innerHTML = `<div class="output-box">${escapeHtml(candidates.join('\n'))}</div>`;
      }
    } catch (err) {
      out.innerHTML = `<div class="notice">${escapeHtml(err.message || 'WebRTC inspection restricted by browser.')}</div>`;
    }
  });
}

// 11. SESSION TIMER
function renderSessionTimer(container) {
  const saved = getTimerSettings();
  let durationSec = (saved.minutes || 25) * 60;
  let remainingSec = durationSec;
  let intervalId = null;

  container.innerHTML = `
    <div class="panel" style="max-width: 640px;">
      <div class="panel-header">
        <h3 class="panel-title">Local Browsing Session Timer</h3>
        <span class="field-hint">Settings saved locally only</span>
      </div>
      <div id="st-display" class="mono" style="font-size: 48px; font-weight: 700; letter-spacing: 0.04em; margin: 12px 0 18px;">25:00</div>
      <div class="input-row" style="margin-bottom: 16px;">
        <button type="button" class="btn btn-primary" id="st-start-btn">Start</button>
        <button type="button" class="btn btn-secondary" id="st-pause-btn">Pause</button>
        <button type="button" class="btn btn-secondary" id="st-reset-btn">Reset</button>
      </div>
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="st-mins">Interval (minutes)</label>
          <select id="st-mins" class="select">
            ${[5, 15, 25, 45, 60].map((m) => `<option value="${m}" ${m === (saved.minutes || 25) ? 'selected' : ''}>${m} minutes</option>`).join('')}
          </select>
        </div>
        <div class="field-group" style="justify-content: flex-end;">
          <label class="checkbox-row"><input type="checkbox" id="st-sound" ${saved.soundEnabled ? 'checked' : ''} /> Play gentle Web Audio chime on completion</label>
        </div>
      </div>
      <div id="st-status" class="field-hint">Use session timers as a reminder to clear temporary tabs, lock devices, or take a screen break.</div>
    </div>
  `;

  function formatTime(s) {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 528;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // ignore audio restrictions
    }
  }

  function updateDisplay() {
    const el = document.getElementById('st-display');
    if (el) el.textContent = formatTime(remainingSec);
  }

  document.getElementById('st-mins').addEventListener('change', (e) => {
    const mins = Number(e.target.value);
    saveTimerSettings({ minutes: mins, soundEnabled: document.getElementById('st-sound').checked });
    clearInterval(intervalId);
    intervalId = null;
    durationSec = mins * 60;
    remainingSec = durationSec;
    updateDisplay();
  });

  document.getElementById('st-sound').addEventListener('change', (e) => {
    saveTimerSettings({ minutes: Number(document.getElementById('st-mins').value), soundEnabled: e.target.checked });
  });

  document.getElementById('st-start-btn').addEventListener('click', () => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      if (remainingSec > 0) {
        remainingSec -= 1;
        updateDisplay();
      } else {
        clearInterval(intervalId);
        intervalId = null;
        if (document.getElementById('st-sound')?.checked) playChime();
        showToast('Session timer complete — consider closing sensitive tabs.');
      }
    }, 1000);
  });

  document.getElementById('st-pause-btn').addEventListener('click', () => {
    clearInterval(intervalId);
    intervalId = null;
  });

  document.getElementById('st-reset-btn').addEventListener('click', () => {
    clearInterval(intervalId);
    intervalId = null;
    remainingSec = durationSec;
    updateDisplay();
  });

  updateDisplay();
}

// 12. SECURITY HEADERS
function renderSecurityHeaders(container) {
  container.innerHTML = `
    <div class="panel">
      <form id="sh-form">
        <div class="field-group">
          <label class="field-label" for="sh-url">Public Domain or URL</label>
          <div class="input-row">
            <input id="sh-url" class="input mono" type="text" placeholder="https://example.org" required />
            <button type="submit" class="btn btn-primary">Inspect Headers</button>
          </div>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" id="sh-confirm" required />
          I confirm that I own this domain or have permission to inspect its public HTTP security headers.
        </label>
      </form>
      <div class="field-hint" style="margin-top: 8px;">SSRF-hardened server check: blocks private/loopback/metadata IPs, non-standard ports, and automatic redirects.</div>
    </div>
    <div id="sh-output"></div>
  `;

  document.getElementById('sh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('sh-url').value.trim();
    const confirmed = document.getElementById('sh-confirm').checked;
    const out = document.getElementById('sh-output');
    out.innerHTML = '<div class="panel">Inspecting initial HTTP response headers...</div>';

    try {
      const resp = await fetch('/api/headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, confirmed })
      });
      const data = await resp.json();
      if (!resp.ok) {
        out.innerHTML = `<div class="notice notice-danger">${escapeHtml(data.error || 'Header inspection failed.')}</div>`;
        return;
      }

      const entries = Object.values(data.headers);
      out.innerHTML = `
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title"><span class="mono">${escapeHtml(data.target)}</span> (HTTP ${escapeHtml(String(data.status))})</h3>
            <span class="mono field-hint">${data.presentCount} of ${data.totalChecked} headers observed</span>
          </div>
          ${data.redirectedNotice ? `<div class="notice notice-warn" style="margin-bottom: 12px;">${escapeHtml(data.redirectedNotice)}</div>` : ''}
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Security Header</th><th>Status</th><th>Observed Value / Purpose</th></tr></thead>
              <tbody>
                ${entries.map((h) => `
                  <tr>
                    <td><strong>${escapeHtml(h.label)}</strong><div class="field-hint">${escapeHtml(h.purpose)}</div></td>
                    <td class="mono ${h.present ? 'state-text-ok' : 'state-text-warn'}">${h.present ? 'Present' : 'Missing'}</td>
                    <td class="mono" style="word-break: break-all;">${h.value ? escapeHtml(h.value) : '<span style="color:var(--text-muted)">Not sent on initial response</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="notice" style="margin-top: 14px;">
            <strong>Limitations:</strong>
            <ul style="margin: 6px 0 0 18px; padding: 0;">
              ${data.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Network error while contacting /api/headers.</div>';
    }
  });
}
