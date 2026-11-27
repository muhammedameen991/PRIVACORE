import { copyText, escapeHtml } from '../icons.js';

export async function renderNetworkTool(kind, container) {
  switch (kind) {
    case 'http-status': return renderHttpStatus(container);
    case 'service-monitor': return renderServiceMonitor(container);
    case 'connection-info': return renderConnectionInfo(container);
    case 'cidr-calc': return renderCidrCalc(container);
    case 'ipv6-analyzer': return renderIpv6Analyzer(container);
    case 'ipv4-converter': return renderIpv4Converter(container);
    case 'mac-analyzer': return renderMacAnalyzer(container);
    case 'spf-dmarc': return renderSpfDmarc(container);
    default:
      container.innerHTML = '<div class="notice">Network tool module not found.</div>';
  }
}

function renderHttpStatus(container) {
  container.innerHTML = `
    <div class="panel">
      <form id="hs-form" class="input-row">
        <input id="hs-url" class="input mono" type="text" placeholder="https://example.org" required />
        <button type="submit" class="btn btn-primary">Check HTTP Status</button>
      </form>
      <div class="field-hint" style="margin-top: 8px;">Performs an SSRF-safe HEAD request without following redirects or downloading response content.</div>
    </div>
    <div id="hs-out"></div>
  `;

  document.getElementById('hs-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = document.getElementById('hs-out');
    const url = document.getElementById('hs-url').value.trim();
    out.innerHTML = '<div class="panel">Probing endpoint...</div>';
    try {
      const resp = await fetch(`/api/status?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      if (!resp.ok) {
        out.innerHTML = `<div class="notice notice-danger">${escapeHtml(data.error)}</div>`;
        return;
      }
      out.innerHTML = `
        <div class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <tbody>
                <tr><th style="width: 200px;">Target</th><td class="mono">${escapeHtml(data.target)}</td></tr>
                <tr><th>Reachable</th><td class="mono ${data.reachable ? 'state-text-ok' : 'state-text-danger'}">${data.reachable ? 'Yes' : 'No'}</td></tr>
                <tr><th>HTTP Status</th><td class="mono">${data.status ? `${data.status} ${escapeHtml(data.statusText)}` : escapeHtml(data.statusText)}</td></tr>
                <tr><th>Server-Region Latency</th><td class="mono">${data.latencyMs} ms</td></tr>
              </tbody>
            </table>
          </div>
          <div class="field-hint" style="margin-top: 10px;">${escapeHtml(data.note)}</div>
        </div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Failed to reach /api/status.</div>';
    }
  });
}

function renderServiceMonitor(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Public Internet Infrastructure Reachability</h3>
        <button type="button" class="btn btn-primary btn-sm" id="sm-run-btn">Run Probe</button>
      </div>
      <div class="field-hint" style="margin-bottom: 12px;">Probes a fixed allowlist of major public endpoints from the server region via HEAD requests.</div>
      <div id="sm-out"></div>
    </div>
  `;

  async function runProbe() {
    const out = document.getElementById('sm-out');
    out.innerHTML = '<div class="notice">Checking reachability of allowlisted public endpoints...</div>';
    try {
      const resp = await fetch('/api/status?preset=all');
      const data = await resp.json();
      if (!resp.ok) {
        out.innerHTML = `<div class="notice notice-danger">${escapeHtml(data.error)}</div>`;
        return;
      }
      out.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Service</th><th>Category</th><th>Status</th><th class="num">Latency</th></tr></thead>
            <tbody>
              ${data.services.map((s) => `
                <tr>
                  <td><strong>${escapeHtml(s.name)}</strong><div class="field-hint mono">${escapeHtml(s.url)}</div></td>
                  <td>${escapeHtml(s.category)}</td>
                  <td class="mono ${s.reachable ? 'state-text-ok' : 'state-text-danger'}">${s.reachable ? `HTTP ${s.status}` : escapeHtml(s.statusText)}</td>
                  <td class="num">${s.latencyMs} ms</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="field-hint" style="margin-top: 10px;">${escapeHtml(data.note)} Checked at ${escapeHtml(data.checkedAt)}.</div>
      `;
    } catch {
      out.innerHTML = '<div class="notice notice-danger">Unable to contact /api/status.</div>';
    }
  }

  document.getElementById('sm-run-btn').addEventListener('click', runProbe);
  runProbe();
}

function renderConnectionInfo(container) {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 240px;">navigator.onLine</th><td class="mono">${navigator.onLine ? 'Online' : 'Offline'}</td></tr>
            <tr><th>Effective Connection Type</th><td class="mono">${escapeHtml(conn?.effectiveType || 'Not exposed by browser')}</td></tr>
            <tr><th>Downlink Estimate</th><td class="mono">${conn?.downlink !== undefined ? `${conn.downlink} Mbps` : 'Not exposed'}</td></tr>
            <tr><th>Estimated RTT</th><td class="mono">${conn?.rtt !== undefined ? `${conn.rtt} ms` : 'Not exposed'}</td></tr>
            <tr><th>Save-Data Preference</th><td class="mono">${conn?.saveData !== undefined ? String(conn.saveData) : 'Not exposed'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function ipToInt(ip) {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function renderCidrCalc(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <input id="cidr-ip" class="input mono" value="192.168.10.42" aria-label="IPv4 address" />
        <select id="cidr-prefix" class="select mono" style="max-width: 130px;" aria-label="CIDR prefix">
          ${Array.from({ length: 33 }, (_, i) => `<option value="${i}" ${i === 24 ? 'selected' : ''}>/${i}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary" id="cidr-calc-btn">Calculate</button>
      </div>
      <div id="cidr-out"></div>
    </div>
  `;

  function calc() {
    const ipInt = ipToInt(document.getElementById('cidr-ip').value);
    const prefix = Number(document.getElementById('cidr-prefix').value);
    const out = document.getElementById('cidr-out');
    if (ipInt === null) {
      out.innerHTML = '<div class="notice notice-danger">Enter a valid IPv4 address.</div>';
      return;
    }
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const wildcard = (~mask) >>> 0;
    const network = (ipInt & mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const total = Math.pow(2, 32 - prefix);
    const usable = prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(0, total - 2);
    const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
    const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

    out.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 220px;">CIDR Block</th><td class="mono">${intToIp(network)}/${prefix}</td></tr>
            <tr><th>Subnet Mask</th><td class="mono">${intToIp(mask)}</td></tr>
            <tr><th>Wildcard Mask</th><td class="mono">${intToIp(wildcard)}</td></tr>
            <tr><th>Network Address</th><td class="mono">${intToIp(network)}</td></tr>
            <tr><th>Broadcast Address</th><td class="mono">${intToIp(broadcast)}</td></tr>
            <tr><th>Usable Host Range</th><td class="mono">${intToIp(firstHost)} — ${intToIp(lastHost)}</td></tr>
            <tr><th>Total / Usable Addresses</th><td class="mono">${total.toLocaleString()} / ${usable.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('cidr-calc-btn').addEventListener('click', calc);
  document.getElementById('cidr-prefix').addEventListener('change', calc);
  calc();
}

function expandIpv6(addr) {
  const clean = addr.trim().toLowerCase().split('%')[0];
  const halves = clean.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] !== undefined && halves[1] !== '' ? halves[1].split(':') : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 0) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.padStart(4, '0'));
}

function renderIpv6Analyzer(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <input id="v6-in" class="input mono" value="2001:db8::1" aria-label="IPv6 address" />
        <button type="button" class="btn btn-primary" id="v6-btn">Analyze IPv6</button>
      </div>
      <div id="v6-out"></div>
    </div>
  `;

  function run() {
    const groups = expandIpv6(document.getElementById('v6-in').value);
    const out = document.getElementById('v6-out');
    if (!groups) {
      out.innerHTML = '<div class="notice notice-danger">Invalid IPv6 address syntax.</div>';
      return;
    }
    const expanded = groups.join(':');
    const shortGroups = groups.map((g) => g.replace(/^0+/, '') || '0');
    let scope = 'Reserved / Other';
    if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') scope = 'Loopback (::1)';
    else if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') scope = 'Unspecified (::)';
    else if (/^fe[89ab]/.test(groups[0])) scope = 'Link-Local Unicast (fe80::/10)';
    else if (/^f[cd]/.test(groups[0])) scope = 'Unique Local Address — ULA (fc00::/7)';
    else if (/^ff/.test(groups[0])) scope = 'Multicast (ff00::/8)';
    else if (groups[0] === '2001' && groups[1] === '0db8') scope = 'Documentation Prefix (2001:db8::/32)';
    else if (/^[23]/.test(groups[0])) scope = 'Global Unicast (2000::/3)';

    out.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 220px;">Expanded 128-bit</th><td class="mono">${escapeHtml(expanded)}</td></tr>
            <tr><th>Zero-Trimmed Groups</th><td class="mono">${escapeHtml(shortGroups.join(':'))}</td></tr>
            <tr><th>Address Scope / Type</th><td class="mono">${escapeHtml(scope)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('v6-btn').addEventListener('click', run);
  run();
}

function renderIpv4Converter(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <input id="v4c-in" class="input mono" value="10.0.4.25" />
        <button type="button" class="btn btn-primary" id="v4c-btn">Convert</button>
      </div>
      <div id="v4c-out"></div>
    </div>
  `;

  function run() {
    const val = document.getElementById('v4c-in').value.trim();
    const num = ipToInt(val);
    const out = document.getElementById('v4c-out');
    if (num === null) {
      out.innerHTML = '<div class="notice notice-danger">Enter a valid dotted-decimal IPv4 address.</div>';
      return;
    }
    const octets = val.split('.').map(Number);
    const binary = octets.map((o) => o.toString(2).padStart(8, '0')).join('.');
    const hex = '0x' + octets.map((o) => o.toString(16).padStart(2, '0')).join('');
    let cls = 'Public / Routable';
    if (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168)) cls = 'RFC 1918 Private';
    else if (octets[0] === 127) cls = 'Loopback (127.0.0.0/8)';
    else if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) cls = 'CGNAT Shared Space (100.64.0.0/10)';
    else if (octets[0] === 169 && octets[1] === 254) cls = 'Link-Local (169.254.0.0/16)';

    out.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 200px;">Dotted Decimal</th><td class="mono">${escapeHtml(val)}</td></tr>
            <tr><th>32-bit Binary</th><td class="mono">${binary}</td></tr>
            <tr><th>Hexadecimal</th><td class="mono">${hex}</td></tr>
            <tr><th>Unsigned Integer</th><td class="mono">${num}</td></tr>
            <tr><th>Allocation Class</th><td class="mono">${cls}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('v4c-btn').addEventListener('click', run);
  run();
}

function renderMacAnalyzer(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <input id="mac-in" class="input mono" value="02:4a:9f:12:8b:c4" />
        <button type="button" class="btn btn-primary" id="mac-btn">Inspect MAC</button>
      </div>
      <div id="mac-out"></div>
    </div>
  `;

  function run() {
    const clean = document.getElementById('mac-in').value.trim().replace(/[:-]/g, '').toLowerCase();
    const out = document.getElementById('mac-out');
    if (!/^[0-9a-f]{12}$/.test(clean)) {
      out.innerHTML = '<div class="notice notice-danger">Enter a valid 48-bit MAC address (e.g. 02:4a:9f:12:8b:c4).</div>';
      return;
    }
    const firstByte = parseInt(clean.slice(0, 2), 16);
    const isMulticast = (firstByte & 0x01) === 1;
    const isLocallyAdmin = (firstByte & 0x02) === 2;
    const colon = clean.match(/.{2}/g).join(':').toUpperCase();
    out.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 240px;">Normalized MAC</th><td class="mono">${colon}</td></tr>
            <tr><th>OUI Prefix (First 24 bits)</th><td class="mono">${colon.slice(0, 8)}</td></tr>
            <tr><th>Transmission Bit</th><td class="mono">${isMulticast ? 'Multicast' : 'Unicast'}</td></tr>
            <tr><th>Administration Bit</th><td class="mono">${isLocallyAdmin ? 'Locally Administered (Typical of Randomized/Private Wi-Fi MACs)' : 'Universally Administered (Hardware Burned-in OUI)'}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('mac-btn').addEventListener('click', run);
  run();
}

function renderSpfDmarc(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="sd-spf-inc">SPF Allowed Includes (space-separated)</label>
          <input id="sd-spf-inc" class="input mono" value="_spf.example.org" />
        </div>
        <div class="field-group">
          <label class="field-label" for="sd-spf-all">SPF Failure Policy</label>
          <select id="sd-spf-all" class="select">
            <option value="-all">-all (Hard fail — strict)</option>
            <option value="~all">~all (Soft fail — monitoring)</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="sd-dmarc-p">DMARC Policy (p=)</label>
          <select id="sd-dmarc-p" class="select">
            <option value="none">none (Monitor only)</option>
            <option value="quarantine">quarantine (Spam folder)</option>
            <option value="reject" selected>reject (Block unauthenticated)</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="sd-rua">DMARC Aggregate Report Address (optional)</label>
          <input id="sd-rua" class="input mono" placeholder="dmarc-reports@example.org" />
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Generated SPF TXT Record (Host: @)</label>
        <div class="input-row">
          <input id="sd-spf-out" class="input mono" readonly />
          <button type="button" class="btn btn-secondary btn-sm" id="sd-copy-spf">Copy</button>
        </div>
      </div>
      <div class="field-group" style="margin-bottom: 0;">
        <label class="field-label">Generated DMARC TXT Record (Host: _dmarc)</label>
        <div class="input-row">
          <input id="sd-dmarc-out" class="input mono" readonly />
          <button type="button" class="btn btn-secondary btn-sm" id="sd-copy-dmarc">Copy</button>
        </div>
      </div>
    </div>
  `;

  function update() {
    const inc = document.getElementById('sd-spf-inc').value.trim().split(/\s+/).filter(Boolean).map((d) => `include:${d}`).join(' ');
    const all = document.getElementById('sd-spf-all').value;
    document.getElementById('sd-spf-out').value = `v=spf1 ${inc ? inc + ' ' : ''}${all}`;

    const p = document.getElementById('sd-dmarc-p').value;
    const rua = document.getElementById('sd-rua').value.trim();
    document.getElementById('sd-dmarc-out').value = `v=DMARC1; p=${p}; adkim=s; aspf=s;${rua ? ` rua=mailto:${rua};` : ''}`;
  }

  ['sd-spf-inc', 'sd-spf-all', 'sd-dmarc-p', 'sd-rua'].forEach((id) => {
    document.getElementById(id).addEventListener('input', update);
  });
  document.getElementById('sd-copy-spf').addEventListener('click', () => copyText(document.getElementById('sd-spf-out').value, 'SPF record copied'));
  document.getElementById('sd-copy-dmarc').addEventListener('click', () => copyText(document.getElementById('sd-dmarc-out').value, 'DMARC record copied'));
  update();
}
