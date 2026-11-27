import { copyText, escapeHtml, showToast } from '../icons.js';

const DICE_WORDS = [
  'acorn', 'amber', 'anchor', 'anvil', 'apricot', 'atlas', 'aurora', 'badge',
  'bamboo', 'beacon', 'bison', 'blossom', 'breeze', 'canyon', 'cedar', 'chalice',
  'cipher', 'cobalt', 'compass', 'coral', 'crater', 'crystal', 'cypress', 'delta',
  'dolphin', 'drift', 'dune', 'echo', 'ember', 'emerald', 'falcon', 'fathom',
  'feather', 'fjord', 'flint', 'forest', 'fossil', 'frost', 'galaxy', 'glacier',
  'granite', 'harbor', 'harvest', 'hazel', 'horizon', 'indigo', 'island', 'ivory',
  'jasper', 'juniper', 'kestrel', 'lagoon', 'lantern', 'larch', 'laurel', 'lichen',
  'lumen', 'magnet', 'maple', 'meadow', 'meridian', 'mosaic', 'nebula', 'nectar',
  'north', 'obsidian', 'olive', 'onyx', 'orbit', 'osprey', 'pebble', 'phoenix',
  'pine', 'plume', 'prism', 'quartz', 'raven', 'ridge', 'river', 'saffron',
  'sequoia', 'shale', 'signal', 'silver', 'solstice', 'spruce', 'summit', 'timber',
  'topaz', 'tundra', 'umbra', 'valley', 'velvet', 'verge', 'vertex', 'violet'
];

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toB64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function renderCryptoTool(kind, container) {
  switch (kind) {
    case 'sha-hash': return renderShaHash(container);
    case 'hmac-lab': return renderHmacLab(container);
    case 'pbkdf2-lab': return renderPbkdf2Lab(container);
    case 'ecdsa-lab': return renderEcdsaLab(container);
    case 'rsa-lab': return renderRsaLab(container);
    case 'random-gen': return renderRandomGen(container);
    case 'passphrase-gen': return renderPassphraseGen(container);
    case 'password-analyzer': return renderPasswordAnalyzer(container);
    case 'totp-lab': return renderTotpLab(container);
    case 'jwt-inspector': return renderJwtInspector(container);
    case 'csr-builder': return renderCsrBuilder(container);
    case 'rot13-edu': return renderRot13Edu(container);
    case 'salt-edu': return renderSaltEdu(container);
    default:
      container.innerHTML = '<div class="notice">Cryptography tool module not found.</div>';
  }
}

function renderShaHash(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="sha-in">Input Text</label>
        <textarea id="sha-in" class="textarea" placeholder="Enter text to hash locally...">PRIVACORE</textarea>
      </div>
      <div class="field-group">
        <label class="field-label" for="sha-compare">Compare Against Expected Hex Digest (optional)</label>
        <input id="sha-compare" class="input mono" placeholder="Paste expected SHA-256/512 hex..." />
      </div>
      <div id="sha-out" class="table-wrap"></div>
    </div>
  `;

  async function compute() {
    const text = document.getElementById('sha-in').value;
    const expected = document.getElementById('sha-compare').value.trim().toLowerCase();
    const bytes = new TextEncoder().encode(text);
    const algs = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'];
    const rows = await Promise.all(
      algs.map(async (alg) => {
        const digest = await crypto.subtle.digest(alg, bytes);
        const hex = toHex(digest);
        const matched = expected && expected === hex;
        return { alg, hex, b64: toB64(digest), matched };
      })
    );

    document.getElementById('sha-out').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Algorithm</th><th>Hex Digest</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="mono">${r.alg}${r.matched ? '<div class="state-text-ok">Match verified</div>' : ''}</td>
              <td class="mono" style="word-break: break-all;">${r.hex}</td>
              <td><button type="button" class="btn btn-secondary btn-sm sha-copy" data-val="${r.hex}">Copy</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.querySelectorAll('.sha-copy').forEach((btn) => {
      btn.addEventListener('click', () => copyText(btn.dataset.val, 'Digest copied'));
    });
  }

  document.getElementById('sha-in').addEventListener('input', compute);
  document.getElementById('sha-compare').addEventListener('input', compute);
  compute();
}

function renderHmacLab(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="hm-key">Shared Secret Key</label>
          <input id="hm-key" class="input mono" value="example-secret-key" />
        </div>
        <div class="field-group">
          <label class="field-label" for="hm-alg">Hash Function</label>
          <select id="hm-alg" class="select"><option value="SHA-256">HMAC-SHA256</option><option value="SHA-512">HMAC-SHA512</option></select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="hm-msg">Message</label>
        <textarea id="hm-msg" class="textarea" rows="3">Authenticate this payload locally.</textarea>
      </div>
      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label">Computed HMAC (Hex)</label>
        <div id="hm-out" class="output-box"></div>
      </div>
    </div>
  `;

  async function compute() {
    const secret = document.getElementById('hm-key').value;
    const msg = document.getElementById('hm-msg').value;
    const hash = document.getElementById('hm-alg').value;
    if (!secret) {
      document.getElementById('hm-out').textContent = 'Enter a secret key.';
      return;
    }
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    document.getElementById('hm-out').textContent = toHex(sig);
  }

  ['hm-key', 'hm-alg', 'hm-msg'].forEach((id) => document.getElementById(id).addEventListener('input', compute));
  compute();
}

function renderPbkdf2Lab(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-3">
        <div class="field-group">
          <label class="field-label" for="pb-pass">Passphrase</label>
          <input id="pb-pass" class="input" value="correct-horse-battery-staple" />
        </div>
        <div class="field-group">
          <label class="field-label" for="pb-salt">Salt (UTF-8)</label>
          <input id="pb-salt" class="input mono" value="random-salt-16b" />
        </div>
        <div class="field-group">
          <label class="field-label" for="pb-iter">Iterations</label>
          <input id="pb-iter" class="input mono" type="number" min="1000" max="600000" value="100000" />
        </div>
      </div>
      <button type="button" class="btn btn-primary" id="pb-run">Derive 256-bit Key</button>
      <div id="pb-out" class="output-box" style="margin-top: 14px;">Click Derive to run PBKDF2-HMAC-SHA256 locally.</div>
    </div>
  `;

  document.getElementById('pb-run').addEventListener('click', async () => {
    const pass = document.getElementById('pb-pass').value;
    const salt = document.getElementById('pb-salt').value;
    const iter = Math.min(600000, Math.max(1000, Number(document.getElementById('pb-iter').value) || 100000));
    const t0 = performance.now();
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: iter, hash: 'SHA-256' }, base, 256);
    const ms = Math.round(performance.now() - t0);
    document.getElementById('pb-out').textContent = `Derived Key (Hex): ${toHex(bits)}\nTime elapsed: ${ms} ms (${iter.toLocaleString()} iterations)`;
  });
}

function renderEcdsaLab(container) {
  let pair = null;
  let lastSig = '';
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <button type="button" class="btn btn-primary" id="ec-gen">Generate P-256 Keypair</button>
        <button type="button" class="btn btn-secondary" id="ec-sign" disabled>Sign Message</button>
        <button type="button" class="btn btn-secondary" id="ec-verify" disabled>Verify Signature</button>
      </div>
      <div class="field-group">
        <label class="field-label" for="ec-msg">Message</label>
        <textarea id="ec-msg" class="textarea" rows="2">Verify authenticity locally with ECDSA P-256.</textarea>
      </div>
      <div id="ec-out" class="output-box">Generate a keypair to begin.</div>
    </div>
  `;

  document.getElementById('ec-gen').addEventListener('click', async () => {
    pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    document.getElementById('ec-sign').disabled = false;
    document.getElementById('ec-verify').disabled = false;
    document.getElementById('ec-out').textContent = `Public Key (JWK):\n${JSON.stringify(pubJwk, null, 2)}`;
  });

  document.getElementById('ec-sign').addEventListener('click', async () => {
    if (!pair) return;
    const msg = new TextEncoder().encode(document.getElementById('ec-msg').value);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, msg);
    lastSig = toB64(sig);
    document.getElementById('ec-out').textContent = `Signature (Base64):\n${lastSig}`;
  });

  document.getElementById('ec-verify').addEventListener('click', async () => {
    if (!pair || !lastSig) return showToast('Sign a message first.');
    const msg = new TextEncoder().encode(document.getElementById('ec-msg').value);
    const rawSig = Uint8Array.from(atob(lastSig), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, rawSig, msg);
    document.getElementById('ec-out').textContent = `Signature verification result: ${ok ? 'VALID (Message matches public key)' : 'INVALID (Message or signature altered)'}`;
  });
}

function renderRsaLab(container) {
  let pair = null;
  let lastCipher = '';
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <button type="button" class="btn btn-primary" id="rsa-gen">Generate RSA-OAEP 2048 Keypair</button>
        <button type="button" class="btn btn-secondary" id="rsa-enc" disabled>Encrypt with Public Key</button>
        <button type="button" class="btn btn-secondary" id="rsa-dec" disabled>Decrypt with Private Key</button>
      </div>
      <div class="field-group">
        <label class="field-label" for="rsa-msg">Short Plaintext (max ~190 bytes)</label>
        <input id="rsa-msg" class="input" value="Secret session key or short note" />
      </div>
      <div id="rsa-out" class="output-box">Generate an RSA-OAEP 2048-bit keypair to test asymmetric encryption locally.</div>
    </div>
  `;

  document.getElementById('rsa-gen').addEventListener('click', async () => {
    document.getElementById('rsa-out').textContent = 'Generating 2048-bit RSA keypair locally...';
    pair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt']
    );
    document.getElementById('rsa-enc').disabled = false;
    document.getElementById('rsa-dec').disabled = false;
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    document.getElementById('rsa-out').textContent = `RSA-OAEP 2048 Public Key (SPKI Base64):\n${toB64(spki)}`;
  });

  document.getElementById('rsa-enc').addEventListener('click', async () => {
    if (!pair) return;
    try {
      const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pair.publicKey, new TextEncoder().encode(document.getElementById('rsa-msg').value));
      lastCipher = toB64(ct);
      document.getElementById('rsa-out').textContent = `Encrypted Ciphertext (Base64):\n${lastCipher}`;
    } catch {
      document.getElementById('rsa-out').textContent = 'Encryption failed (message may exceed 190-byte RSA-OAEP limit).';
    }
  });

  document.getElementById('rsa-dec').addEventListener('click', async () => {
    if (!pair || !lastCipher) return;
    const raw = Uint8Array.from(atob(lastCipher), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pair.privateKey, raw);
    document.getElementById('rsa-out').textContent = `Decrypted Plaintext:\n${new TextDecoder().decode(pt)}`;
  });
}

function renderRandomGen(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <select id="rg-bytes" class="select" style="max-width: 180px;">
          <option value="16">16 bytes (128-bit)</option>
          <option value="32" selected>32 bytes (256-bit)</option>
          <option value="64">64 bytes (512-bit)</option>
        </select>
        <button type="button" class="btn btn-primary" id="rg-gen">Generate CSPRNG Tokens</button>
      </div>
      <div id="rg-out" class="table-wrap"></div>
    </div>
  `;

  function gen() {
    const n = Number(document.getElementById('rg-bytes').value);
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    const hex = toHex(bytes);
    const b64 = toB64(bytes);
    const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const rows = [
      ['Hexadecimal', hex],
      ['Base64', b64],
      ['Base64URL (URL-safe)', b64url]
    ];
    document.getElementById('rg-out').innerHTML = `
      <table class="data-table">
        <tbody>${rows.map(([k, v]) => `<tr><th style="width: 200px;">${k}</th><td class="mono" style="word-break: break-all;">${v}</td><td><button type="button" class="btn btn-secondary btn-sm rg-cp" data-val="${v}">Copy</button></td></tr>`).join('')}</tbody>
      </table>
    `;
    container.querySelectorAll('.rg-cp').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.val, 'Token copied')));
  }

  document.getElementById('rg-gen').addEventListener('click', gen);
  gen();
}

function renderPassphraseGen(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <select id="pp-count" class="select" style="max-width: 160px;">
          <option value="4">4 words</option>
          <option value="5">5 words</option>
          <option value="6" selected>6 words</option>
          <option value="8">8 words</option>
        </select>
        <input id="pp-sep" class="input mono" style="max-width: 100px;" value="-" aria-label="Separator" />
        <button type="button" class="btn btn-primary" id="pp-gen">Generate Passphrase</button>
        <button type="button" class="btn btn-secondary" id="pp-copy">Copy</button>
      </div>
      <input id="pp-out" class="input mono" readonly />
      <div id="pp-meta" class="field-hint" style="margin-top: 8px;"></div>
    </div>
  `;

  function gen() {
    const count = Number(document.getElementById('pp-count').value);
    const sep = document.getElementById('pp-sep').value;
    const words = [];
    const arr = new Uint32Array(1);
    for (let i = 0; i < count; i += 1) {
      crypto.getRandomValues(arr);
      words.push(DICE_WORDS[arr[0] % DICE_WORDS.length]);
    }
    document.getElementById('pp-out').value = words.join(sep);
    const bits = (count * Math.log2(DICE_WORDS.length)).toFixed(1);
    document.getElementById('pp-meta').textContent = `Entropy from ${DICE_WORDS.length}-word list: ~${bits} bits (${count} random words).`;
  }

  document.getElementById('pp-gen').addEventListener('click', gen);
  document.getElementById('pp-copy').addEventListener('click', () => copyText(document.getElementById('pp-out').value, 'Passphrase copied'));
  gen();
}

function renderPasswordAnalyzer(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="pa-in">Test a Password Pattern Locally (Never Sent Anywhere)</label>
        <div class="input-row">
          <input id="pa-in" class="input mono" type="password" placeholder="Type sample password..." autocomplete="off" />
          <button type="button" class="btn btn-secondary btn-sm" id="pa-vis">Show</button>
          <button type="button" class="btn btn-danger btn-sm" id="pa-clear">Clear</button>
        </div>
      </div>
      <div id="pa-out"></div>
    </div>
  `;

  function analyze() {
    const pw = document.getElementById('pa-in').value;
    const out = document.getElementById('pa-out');
    if (!pw) {
      out.innerHTML = '<div class="notice">Enter a sample password to inspect character diversity and pattern warnings locally.</div>';
      return;
    }
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;

    const bits = pw.length * Math.log2(Math.max(1, pool));
    const warnings = [];
    if (pw.length < 12) warnings.push('Shorter than 12 characters.');
    if (/(.)\1{2,}/.test(pw)) warnings.push('Contains 3+ repeated identical characters.');
    if (/1234|abcd|qwerty|password|admin/i.test(pw)) warnings.push('Contains a common predictable sequence or dictionary word.');

    out.innerHTML = `
      <div class="table-wrap" style="margin-bottom: 10px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 220px;">Length</th><td class="mono">${pw.length} chars</td></tr>
            <tr><th>Alphabet Pool</th><td class="mono">${pool} characters</td></tr>
            <tr><th>Upper-bound Entropy</th><td class="mono">${bits.toFixed(1)} bits</td></tr>
          </tbody>
        </table>
      </div>
      ${warnings.length ? `<div class="notice notice-warn">${warnings.map(escapeHtml).join(' ')}</div>` : '<div class="notice notice-ok">No obvious sequential or repetition patterns detected locally.</div>'}
    `;
  }

  document.getElementById('pa-in').addEventListener('input', analyze);
  document.getElementById('pa-vis').addEventListener('click', (e) => {
    const inp = document.getElementById('pa-in');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    e.currentTarget.textContent = inp.type === 'password' ? 'Show' : 'Hide';
  });
  document.getElementById('pa-clear').addEventListener('click', () => {
    document.getElementById('pa-in').value = '';
    analyze();
  });
  analyze();
}

function decodeBase32(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function renderTotpLab(container) {
  container.innerHTML = `
    <div class="panel" style="max-width: 620px;">
      <div class="field-group">
        <label class="field-label" for="totp-sec">Base32 Shared Secret (Example Test Secret)</label>
        <input id="totp-sec" class="input mono" value="JBSWY3DPEHPK3PXP" autocomplete="off" />
      </div>
      <div id="totp-code" class="mono" style="font-size: 40px; font-weight: 700; letter-spacing: 0.14em; margin: 12px 0;">------</div>
      <div id="totp-meta" class="field-hint">Computed locally with HMAC-SHA1 (RFC 6238, 30-second window).</div>
    </div>
  `;

  async function updateTotp() {
    const secEl = document.getElementById('totp-sec');
    if (!secEl) return;
    const keyBytes = decodeBase32(secEl.value);
    if (keyBytes.length === 0) {
      document.getElementById('totp-code').textContent = '------';
      return;
    }
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const remaining = 30 - (epoch % 30);

    const counterBuf = new ArrayBuffer(8);
    new DataView(counterBuf).setUint32(4, counter, false);

    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuf));
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const otp = String(binary % 1_000_000).padStart(6, '0');
    document.getElementById('totp-code').textContent = `${otp.slice(0, 3)} ${otp.slice(3)}`;
    document.getElementById('totp-meta').textContent = `RFC 6238 TOTP · Refreshes in ${remaining}s (depends on device clock accuracy)`;
  }

  document.getElementById('totp-sec').addEventListener('input', updateTotp);
  updateTotp();
  const timer = setInterval(() => {
    if (!document.getElementById('totp-sec')) {
      clearInterval(timer);
      return;
    }
    updateTotp();
  }, 1000);
}

function renderJwtInspector(container) {
  const sample = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.signature_placeholder';
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="jwt-in">Paste JWT Token (Decoded Locally Only)</label>
        <textarea id="jwt-in" class="textarea" rows="3">${sample}</textarea>
      </div>
      <div id="jwt-out"></div>
    </div>
  `;

  function decodePart(part) {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function inspect() {
    const raw = document.getElementById('jwt-in').value.trim();
    const out = document.getElementById('jwt-out');
    const parts = raw.split('.');
    if (parts.length !== 3) {
      out.innerHTML = '<div class="notice notice-danger">A standard JWT requires 3 Base64URL segments separated by dots.</div>';
      return;
    }
    try {
      const header = decodePart(parts[0]);
      const payload = decodePart(parts[1]);
      const algWarn = String(header.alg || '').toLowerCase() === 'none';
      const expNote = typeof payload.exp === 'number'
        ? `exp: ${new Date(payload.exp * 1000).toISOString()} (${payload.exp * 1000 < Date.now() ? 'EXPIRED' : 'Not expired'})`
        : 'No exp claim present';

      out.innerHTML = `
        ${algWarn ? '<div class="notice notice-danger" style="margin-bottom: 12px;">Warning: JWT specifies alg=none (unsigned token).</div>' : ''}
        <div class="grid-2">
          <div><div class="field-label" style="margin-bottom: 6px;">Header</div><div class="output-box">${escapeHtml(JSON.stringify(header, null, 2))}</div></div>
          <div><div class="field-label" style="margin-bottom: 6px;">Payload</div><div class="output-box">${escapeHtml(JSON.stringify(payload, null, 2))}</div></div>
        </div>
        <div class="field-hint mono" style="margin-top: 10px;">${escapeHtml(expNote)}</div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Unable to decode JWT header or payload JSON.</div>';
    }
  }

  document.getElementById('jwt-in').addEventListener('input', inspect);
  inspect();
}

function renderCsrBuilder(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="csr-cn">Common Name (Domain)</label><input id="csr-cn" class="input mono" value="example.org" /></div>
        <div class="field-group"><label class="field-label" for="csr-o">Organization</label><input id="csr-o" class="input" value="Example Org" /></div>
        <div class="field-group"><label class="field-label" for="csr-c">Country (2-letter)</label><input id="csr-c" class="input mono" maxlength="2" value="US" /></div>
        <div class="field-group"><label class="field-label" for="csr-san">SubjectAltName (DNS)</label><input id="csr-san" class="input mono" value="DNS:example.org,DNS:www.example.org" /></div>
      </div>
      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label">Generated OpenSSL Command (Run locally on your host)</label>
        <div class="output-box" id="csr-out"></div>
      </div>
    </div>
  `;

  function build() {
    const clean = (s) => s.replace(/["'\\`$;&|<>]/g, '');
    const cn = clean(document.getElementById('csr-cn').value);
    const o = clean(document.getElementById('csr-o').value);
    const c = clean(document.getElementById('csr-c').value.toUpperCase());
    const san = clean(document.getElementById('csr-san').value);
    document.getElementById('csr-out').textContent =
      `openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout private.key -out request.csr -subj "/C=${c}/O=${o}/CN=${cn}" -addext "subjectAltName=${san}"`;
  }

  ['csr-cn', 'csr-o', 'csr-c', 'csr-san'].forEach((id) => document.getElementById(id).addEventListener('input', build));
  build();
}

function renderRot13Edu(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="notice notice-warn" style="margin-bottom: 14px;">Educational demonstration only: Caesar/ROT13 ciphers offer zero confidentiality and are trivially reversible.</div>
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="rot-in">Input</label><textarea id="rot-in" class="textarea">Privacy Control Clarity</textarea></div>
        <div class="field-group"><label class="field-label" for="rot-shift">Shift (1–25, ROT13 = 13)</label><input id="rot-shift" class="input mono" type="number" min="1" max="25" value="13" /></div>
      </div>
      <div class="output-box" id="rot-out"></div>
    </div>
  `;

  function run() {
    const txt = document.getElementById('rot-in').value;
    const shift = Number(document.getElementById('rot-shift').value) || 13;
    document.getElementById('rot-out').textContent = txt.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
  }
  document.getElementById('rot-in').addEventListener('input', run);
  document.getElementById('rot-shift').addEventListener('input', run);
  run();
}

function renderSaltEdu(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="salt-pw">Sample Password</label>
        <input id="salt-pw" class="input" value="same-password" />
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="salt-gen">Generate Two Random Salts &amp; Compare</button>
      <div id="salt-out" class="output-box" style="margin-top: 12px;"></div>
    </div>
  `;

  async function run() {
    const pw = document.getElementById('salt-pw').value;
    const s1 = toHex(crypto.getRandomValues(new Uint8Array(8)));
    const s2 = toHex(crypto.getRandomValues(new Uint8Array(8)));
    const d1 = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${s1}:${pw}`)));
    const d2 = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${s2}:${pw}`)));
    document.getElementById('salt-out').textContent =
      `Salt A (${s1}) -> ${d1}\nSalt B (${s2}) -> ${d2}\n\nIdentical passwords produce completely different digests, defeating precomputed rainbow tables. Production systems must also use slow memory-hard KDFs like Argon2id.`;
  }

  document.getElementById('salt-gen').addEventListener('click', run);
  run();
}
