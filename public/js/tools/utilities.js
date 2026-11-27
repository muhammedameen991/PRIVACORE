import { copyText, escapeHtml, showToast } from '../icons.js';
import { generateQrMatrix, qrToPngDataUrl, qrToSvg } from '../lib/qrcode.js';
import { clearAllLocalData, exportAllLocalData, getFavorites, getRecentTools, getSettings } from '../state.js';

export async function renderUtilityTool(kind, container) {
  switch (kind) {
    case 'qr-decoder': return renderQrDecoder(container);
    case 'wifi-qr': return renderWifiQr(container);
    case 'base64-codec': return renderBase64Codec(container);
    case 'hex-binary': return renderHexBinary(container);
    case 'url-codec': return renderUrlCodec(container);
    case 'uuid-ulid': return renderUuidUlid(container);
    case 'focus-timer': return renderFocusTimer(container);
    case 'datetime-converter': return renderDatetimeConverter(container);
    case 'text-suite': return renderTextSuite(container);
    case 'local-data-manager': return renderLocalDataManager(container);
    default:
      container.innerHTML = '<div class="notice">Utility tool module not found.</div>';
  }
}

function renderQrDecoder(container) {
  const supported = 'BarcodeDetector' in window;
  container.innerHTML = `
    <div class="panel">
      ${supported
        ? '<div class="notice notice-ok" style="margin-bottom: 12px;">Native BarcodeDetector API is supported in this browser.</div>'
        : '<div class="notice notice-warn" style="margin-bottom: 12px;">Your current browser does not expose the native BarcodeDetector API (supported in Chrome/Edge/Android). To avoid heavy external decoders, PRIVACORE does not fake decoding when unsupported.</div>'}
      <div class="field-group">
        <label class="field-label" for="qd-file">Select QR Code Image</label>
        <input id="qd-file" class="input" type="file" accept="image/*" ${supported ? '' : 'disabled'} />
      </div>
      <div id="qd-out"></div>
    </div>
  `;

  if (!supported) return;
  document.getElementById('qd-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const out = document.getElementById('qd-out');
    if (!file) return;
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      if (codes.length === 0) {
        out.innerHTML = '<div class="notice">No QR code detected in this image.</div>';
      } else {
        out.innerHTML = `<div class="output-box">${escapeHtml(codes.map((c) => c.rawValue).join('\n'))}</div>`;
      }
    } catch (err) {
      out.innerHTML = `<div class="notice notice-danger">${escapeHtml(err.message || 'Unable to decode image.')}</div>`;
    }
  });
}

function renderWifiQr(container) {
  container.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="field-group"><label class="field-label" for="wq-ssid">Wi-Fi Network Name (SSID)</label><input id="wq-ssid" class="input" value="Guest-WiFi" /></div>
        <div class="field-group"><label class="field-label" for="wq-pass">Password</label><input id="wq-pass" class="input mono" value="example-passphrase" /></div>
        <div class="field-group"><label class="field-label" for="wq-sec">Security</label><select id="wq-sec" class="select"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">Open</option></select></div>
        <label class="checkbox-row"><input type="checkbox" id="wq-hid" /> Hidden network</label>
        <div style="margin-top: 12px;"><button type="button" class="btn btn-primary btn-sm" id="wq-dl">Download PNG</button></div>
      </div>
      <div class="panel" style="display:flex;align-items:center;justify-content:center;">
        <div id="wq-prev" class="qr-preview-box"></div>
      </div>
    </div>
  `;

  let lastQr = null;
  function update() {
    const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');
    const ssid = esc(document.getElementById('wq-ssid').value);
    const pass = esc(document.getElementById('wq-pass').value);
    const sec = document.getElementById('wq-sec').value;
    const hid = document.getElementById('wq-hid').checked;
    const payload = `WIFI:T:${sec};S:${ssid};P:${sec === 'nopass' ? '' : pass};H:${hid ? 'true' : 'false'};;`;
    lastQr = generateQrMatrix(payload, 'M');
    document.getElementById('wq-prev').innerHTML = qrToSvg(lastQr);
  }

  ['wq-ssid', 'wq-pass', 'wq-sec', 'wq-hid'].forEach((id) => document.getElementById(id).addEventListener('input', update));
  document.getElementById('wq-dl').addEventListener('click', () => {
    if (!lastQr) return;
    const a = document.createElement('a');
    a.href = qrToPngDataUrl(lastQr);
    a.download = 'wifi-qr.png';
    a.click();
  });
  update();
}

function renderBase64Codec(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group"><label class="field-label" for="b64-in">Input</label><textarea id="b64-in" class="textarea" rows="4">PRIVACORE local encoding</textarea></div>
      <div class="input-row" style="margin-bottom: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="b64-enc">Encode Base64</button>
        <button type="button" class="btn btn-secondary btn-sm" id="b64-enc-url">Encode Base64URL</button>
        <button type="button" class="btn btn-secondary btn-sm" id="b64-dec">Decode</button>
      </div>
      <textarea id="b64-out" class="textarea" rows="4" readonly></textarea>
    </div>
  `;

  const out = document.getElementById('b64-out');
  document.getElementById('b64-enc').addEventListener('click', () => {
    const bytes = new TextEncoder().encode(document.getElementById('b64-in').value);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    out.value = btoa(bin);
  });
  document.getElementById('b64-enc-url').addEventListener('click', () => {
    const bytes = new TextEncoder().encode(document.getElementById('b64-in').value);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    out.value = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
  document.getElementById('b64-dec').addEventListener('click', () => {
    try {
      let s = document.getElementById('b64-in').value.trim().replace(/-/g, '+').replace(/_/g, '/');
      s += '='.repeat((4 - (s.length % 4)) % 4);
      const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
      out.value = new TextDecoder().decode(bytes);
    } catch {
      out.value = 'Error: Invalid Base64 / Base64URL input.';
    }
  });
}

function renderHexBinary(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group"><label class="field-label" for="hb-in">UTF-8 Text</label><input id="hb-in" class="input" value="PRIVACORE" /></div>
      <div class="field-group"><label class="field-label">Hexadecimal</label><div id="hb-hex" class="output-box"></div></div>
      <div class="field-group" style="margin-bottom:0;"><label class="field-label">Binary (8-bit)</label><div id="hb-bin" class="output-box"></div></div>
    </div>
  `;

  function run() {
    const bytes = new TextEncoder().encode(document.getElementById('hb-in').value);
    document.getElementById('hb-hex').textContent = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    document.getElementById('hb-bin').textContent = Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join(' ');
  }
  document.getElementById('hb-in').addEventListener('input', run);
  run();
}

function renderUrlCodec(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group"><label class="field-label" for="uc-in">Input String / URL Component</label><textarea id="uc-in" class="textarea" rows="3">https://example.org/search?q=privacy & security</textarea></div>
      <div class="input-row" style="margin-bottom: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="uc-enc">encodeURIComponent</button>
        <button type="button" class="btn btn-secondary btn-sm" id="uc-dec">decodeURIComponent</button>
      </div>
      <textarea id="uc-out" class="textarea" rows="3" readonly></textarea>
    </div>
  `;

  document.getElementById('uc-enc').addEventListener('click', () => {
    document.getElementById('uc-out').value = encodeURIComponent(document.getElementById('uc-in').value);
  });
  document.getElementById('uc-dec').addEventListener('click', () => {
    try {
      document.getElementById('uc-out').value = decodeURIComponent(document.getElementById('uc-in').value);
    } catch {
      document.getElementById('uc-out').value = 'Invalid percent-encoded input.';
    }
  });
}

function generateUlid() {
  const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now();
  let timePart = '';
  for (let i = 0; i < 10; i += 1) {
    timePart = CROCK[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let randPart = '';
  for (let i = 0; i < 16; i += 1) randPart += CROCK[rnd[i] % 32];
  return timePart + randPart;
}

function renderUuidUlid(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 12px;">
        <select id="uu-type" class="select" style="max-width: 180px;"><option value="uuid">UUID v4 (Random)</option><option value="ulid">ULID (Time-sorted)</option></select>
        <input id="uu-count" class="input mono" type="number" min="1" max="50" value="5" style="max-width: 100px;" />
        <button type="button" class="btn btn-primary btn-sm" id="uu-gen">Generate</button>
        <button type="button" class="btn btn-secondary btn-sm" id="uu-copy">Copy All</button>
      </div>
      <textarea id="uu-out" class="textarea" rows="7" readonly></textarea>
    </div>
  `;

  function run() {
    const type = document.getElementById('uu-type').value;
    const count = Math.min(50, Math.max(1, Number(document.getElementById('uu-count').value) || 5));
    const list = Array.from({ length: count }, () => (type === 'uuid' ? crypto.randomUUID() : generateUlid()));
    document.getElementById('uu-out').value = list.join('\n');
  }

  document.getElementById('uu-gen').addEventListener('click', run);
  document.getElementById('uu-copy').addEventListener('click', () => copyText(document.getElementById('uu-out').value, 'IDs copied'));
  run();
}

function renderFocusTimer(container) {
  let seconds = 25 * 60;
  let timerId = null;
  container.innerHTML = `
    <div class="panel" style="max-width: 520px;">
      <div id="ft-mode" class="field-hint">Focus Interval (25 min)</div>
      <div id="ft-disp" class="mono" style="font-size: 44px; font-weight: 700; margin: 10px 0 16px;">25:00</div>
      <div class="input-row">
        <button type="button" class="btn btn-primary btn-sm" id="ft-start">Start</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ft-pause">Pause</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ft-25">25m Focus</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ft-5">5m Break</button>
      </div>
    </div>
  `;

  const paint = () => {
    const el = document.getElementById('ft-disp');
    if (!el) return clearInterval(timerId);
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  };

  document.getElementById('ft-start').addEventListener('click', () => {
    if (timerId) return;
    timerId = setInterval(() => {
      if (seconds > 0) { seconds -= 1; paint(); }
      else { clearInterval(timerId); timerId = null; showToast('Interval complete'); }
    }, 1000);
  });
  document.getElementById('ft-pause').addEventListener('click', () => { clearInterval(timerId); timerId = null; });
  document.getElementById('ft-25').addEventListener('click', () => { clearInterval(timerId); timerId = null; seconds = 25 * 60; document.getElementById('ft-mode').textContent = 'Focus Interval (25 min)'; paint(); });
  document.getElementById('ft-5').addEventListener('click', () => { clearInterval(timerId); timerId = null; seconds = 5 * 60; document.getElementById('ft-mode').textContent = 'Short Break (5 min)'; paint(); });
}

function renderDatetimeConverter(container) {
  const nowSec = Math.floor(Date.now() / 1000);
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <input id="dt-in" class="input mono" value="${nowSec}" aria-label="Unix timestamp or ISO date" />
        <button type="button" class="btn btn-primary btn-sm" id="dt-now">Now</button>
      </div>
      <div id="dt-out" class="table-wrap"></div>
    </div>
  `;

  function convert() {
    const raw = document.getElementById('dt-in').value.trim();
    let date;
    if (/^-?\d+$/.test(raw)) {
      const n = Number(raw);
      date = new Date(Math.abs(n) < 1e12 ? n * 1000 : n);
    } else {
      date = new Date(raw);
    }
    const out = document.getElementById('dt-out');
    if (Number.isNaN(date.getTime())) {
      out.innerHTML = '<div class="notice notice-danger">Unrecognized timestamp or ISO date format.</div>';
      return;
    }
    out.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><th style="width: 200px;">Unix Seconds</th><td class="mono">${Math.floor(date.getTime() / 1000)}</td></tr>
          <tr><th>Unix Milliseconds</th><td class="mono">${date.getTime()}</td></tr>
          <tr><th>ISO 8601 (UTC)</th><td class="mono">${date.toISOString()}</td></tr>
          <tr><th>Local Time</th><td class="mono">${escapeHtml(date.toString())}</td></tr>
        </tbody>
      </table>
    `;
  }

  document.getElementById('dt-in').addEventListener('input', convert);
  document.getElementById('dt-now').addEventListener('click', () => {
    document.getElementById('dt-in').value = String(Math.floor(Date.now() / 1000));
    convert();
  });
  convert();
}

function renderTextSuite(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group"><label class="field-label" for="ts-in">Text Workspace</label><textarea id="ts-in" class="textarea" rows="6">zeta\nalpha\nbeta\nalpha</textarea></div>
      <div class="input-row" style="margin-bottom: 10px;">
        <button type="button" class="btn btn-secondary btn-sm" id="ts-dedupe">Deduplicate Lines</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ts-sort">Sort Lines</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ts-trim">Trim &amp; Collapse Spaces</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ts-slug">Slugify</button>
      </div>
      <div id="ts-stats" class="field-hint mono"></div>
    </div>
  `;

  const area = document.getElementById('ts-in');
  const updateStats = () => {
    const v = area.value;
    const bytes = new TextEncoder().encode(v).length;
    const words = v.trim() ? v.trim().split(/\s+/).length : 0;
    const lines = v ? v.split(/\r?\n/).length : 0;
    document.getElementById('ts-stats').textContent = `${v.length} chars · ${bytes} UTF-8 bytes · ${words} words · ${lines} lines`;
  };

  document.getElementById('ts-dedupe').addEventListener('click', () => {
    area.value = Array.from(new Set(area.value.split(/\r?\n/))).join('\n');
    updateStats();
  });
  document.getElementById('ts-sort').addEventListener('click', () => {
    area.value = area.value.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join('\n');
    updateStats();
  });
  document.getElementById('ts-trim').addEventListener('click', () => {
    area.value = area.value.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).join('\n');
    updateStats();
  });
  document.getElementById('ts-slug').addEventListener('click', () => {
    area.value = area.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    updateStats();
  });
  area.addEventListener('input', updateStats);
  updateStats();
}

function renderLocalDataManager(container) {
  const favs = getFavorites();
  const recent = getRecentTools();
  const settings = getSettings();
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap" style="margin-bottom: 14px;">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 240px;">Theme Preference</th><td class="mono">${escapeHtml(settings.theme)}</td></tr>
            <tr><th>Reduced Motion</th><td class="mono">${String(settings.reducedMotion)}</td></tr>
            <tr><th>Favorited Tools</th><td class="mono">${favs.length}</td></tr>
            <tr><th>Recently Used History</th><td class="mono">${recent.length} entries</td></tr>
          </tbody>
        </table>
      </div>
      <div class="input-row">
        <button type="button" class="btn btn-primary btn-sm" id="ldm-export">Export Local State (JSON)</button>
        <button type="button" class="btn btn-danger btn-sm" id="ldm-wipe">Clear All PRIVACORE Local Data</button>
      </div>
    </div>
  `;

  document.getElementById('ldm-export').addEventListener('click', () => {
    const data = JSON.stringify(exportAllLocalData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacore-local-state.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Local state exported');
  });

  document.getElementById('ldm-wipe').addEventListener('click', () => {
    clearAllLocalData();
    showToast('All PRIVACORE local data cleared');
    renderLocalDataManager(container);
  });
}
