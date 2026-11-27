import { copyText, escapeHtml, showToast } from '../icons.js';
import { detectMagicSignature, stripImageMetadata } from '../lib/exif.js';
import { parseSimpleYaml, stringifySimpleYaml } from '../lib/yaml.js';
import { diffJsonObjects, diffLines } from '../lib/diff.js';
import { getNotesData, saveNotesData } from '../state.js';

export async function renderDataTool(kind, container) {
  switch (kind) {
    case 'exif-stripper': return renderExifStripper(container);
    case 'file-integrity': return renderFileIntegrity(container);
    case 'file-magic': return renderFileMagic(container);
    case 'json-formatter': return renderJsonFormatter(container);
    case 'json-diff': return renderJsonDiff(container);
    case 'xml-formatter': return renderXmlFormatter(container);
    case 'yaml-converter': return renderYamlConverter(container);
    case 'csv-inspector': return renderCsvInspector(container);
    case 'text-diff': return renderTextDiff(container);
    case 'pii-redactor': return renderPiiRedactor(container);
    case 'secure-notes': return renderSecureNotes(container);
    default:
      container.innerHTML = '<div class="notice">Data tool module not found.</div>';
  }
}

function renderExifStripper(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="es-file">Select Image (JPEG, PNG, WebP) to Strip Metadata Locally</label>
        <div class="input-row">
          <input id="es-file" class="input" type="file" accept="image/jpeg,image/png,image/webp" />
          <button type="button" class="btn btn-danger btn-sm" id="es-clear">Clear</button>
        </div>
      </div>
      <div id="es-out"></div>
    </div>
  `;

  document.getElementById('es-clear').addEventListener('click', () => {
    document.getElementById('es-file').value = '';
    document.getElementById('es-out').innerHTML = '';
  });

  document.getElementById('es-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const out = document.getElementById('es-out');
    if (!file) return;
    try {
      const res = await stripImageMetadata(file);
      const url = URL.createObjectURL(res.blob);
      out.innerHTML = `
        <div class="notice notice-ok" style="margin-bottom: 12px;">
          Re-encoded locally (${res.width}×${res.height} px · ${(res.blob.size / 1024).toFixed(1)} KB). All EXIF/GPS/XMP segments removed.
        </div>
        <button type="button" class="btn btn-primary" id="es-dl">Download Clean Image</button>
      `;
      document.getElementById('es-dl').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `stripped_${file.name}`;
        a.click();
        showToast('Clean image downloaded');
      });
    } catch (err) {
      out.innerHTML = `<div class="notice notice-danger">${escapeHtml(err.message)}</div>`;
    }
  });
}

function renderFileIntegrity(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="fi-file">Select Local File</label>
        <input id="fi-file" class="input" type="file" />
      </div>
      <div class="field-group">
        <label class="field-label" for="fi-expected">Expected SHA-256 or SHA-512 Hex (optional)</label>
        <input id="fi-expected" class="input mono" placeholder="Paste official checksum to compare..." />
      </div>
      <div id="fi-out"></div>
    </div>
  `;

  let lastHashes = null;

  function renderResult() {
    const out = document.getElementById('fi-out');
    if (!lastHashes) return;
    const expected = document.getElementById('fi-expected').value.trim().toLowerCase();
    const match256 = expected && expected === lastHashes.sha256;
    const match512 = expected && expected === lastHashes.sha512;
    const mismatch = expected && !match256 && !match512;

    out.innerHTML = `
      ${match256 || match512 ? '<div class="notice notice-ok" style="margin-bottom: 12px;">Checksum matches expected value.</div>' : ''}
      ${mismatch ? '<div class="notice notice-danger" style="margin-bottom: 12px;">Checksum does NOT match the expected value provided.</div>' : ''}
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 140px;">File</th><td class="mono">${escapeHtml(lastHashes.name)} (${lastHashes.size.toLocaleString()} bytes)</td></tr>
            <tr><th>SHA-256</th><td class="mono" style="word-break: break-all;">${lastHashes.sha256}</td></tr>
            <tr><th>SHA-512</th><td class="mono" style="word-break: break-all;">${lastHashes.sha512}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('fi-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    document.getElementById('fi-out').innerHTML = '<div class="notice">Computing SHA-256 and SHA-512 locally...</div>';
    const buf = await file.arrayBuffer();
    const toHex = (b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
    const [d256, d512] = await Promise.all([
      crypto.subtle.digest('SHA-256', buf),
      crypto.subtle.digest('SHA-512', buf)
    ]);
    lastHashes = { name: file.name, size: file.size, sha256: toHex(d256), sha512: toHex(d512) };
    renderResult();
  });

  document.getElementById('fi-expected').addEventListener('input', renderResult);
}

function renderFileMagic(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="fm-file">Select Any File (Only First 64 Bytes Read Locally)</label>
        <input id="fm-file" class="input" type="file" />
      </div>
      <div id="fm-out"></div>
    </div>
  `;

  document.getElementById('fm-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const slice = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(slice);
    const sig = detectMagicSignature(bytes);
    document.getElementById('fm-out').innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th style="width: 220px;">File Name</th><td class="mono">${escapeHtml(file.name)}</td></tr>
            <tr><th>Browser-Reported MIME</th><td class="mono">${escapeHtml(file.type || '(none)')}</td></tr>
            <tr><th>Magic Signature Classification</th><td class="mono">${escapeHtml(sig.type)}</td></tr>
            <tr><th>Leading Bytes (Hex)</th><td class="mono">${escapeHtml(sig.hex)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  });
}

function renderJsonFormatter(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="jf-in">JSON Input</label>
        <textarea id="jf-in" class="textarea" rows="7">{"service":"privacore","localOnly":true,"tools":["dns","aes-gcm"]}</textarea>
      </div>
      <div class="input-row" style="margin-bottom: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="jf-pretty">Format (2 spaces)</button>
        <button type="button" class="btn btn-secondary btn-sm" id="jf-min">Minify</button>
        <button type="button" class="btn btn-secondary btn-sm" id="jf-sort">Sort Keys</button>
        <button type="button" class="btn btn-secondary btn-sm" id="jf-copy">Copy</button>
      </div>
      <div id="jf-status" class="field-hint"></div>
    </div>
  `;

  const sortDeep = (val) => {
    if (Array.isArray(val)) return val.map(sortDeep);
    if (val && typeof val === 'object') {
      return Object.keys(val).sort().reduce((acc, k) => {
        acc[k] = sortDeep(val[k]);
        return acc;
      }, {});
    }
    return val;
  };

  function run(mode) {
    const area = document.getElementById('jf-in');
    const st = document.getElementById('jf-status');
    try {
      const parsed = JSON.parse(area.value);
      if (mode === 'pretty') area.value = JSON.stringify(parsed, null, 2);
      else if (mode === 'min') area.value = JSON.stringify(parsed);
      else if (mode === 'sort') area.value = JSON.stringify(sortDeep(parsed), null, 2);
      st.textContent = 'Valid JSON.';
      st.className = 'field-hint state-text-ok';
    } catch (err) {
      st.textContent = `Invalid JSON: ${err.message}`;
      st.className = 'field-hint state-text-danger';
    }
  }

  document.getElementById('jf-pretty').addEventListener('click', () => run('pretty'));
  document.getElementById('jf-min').addEventListener('click', () => run('min'));
  document.getElementById('jf-sort').addEventListener('click', () => run('sort'));
  document.getElementById('jf-copy').addEventListener('click', () => copyText(document.getElementById('jf-in').value, 'JSON copied'));
}

function renderJsonDiff(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="jd-a">JSON A (Original)</label><textarea id="jd-a" class="textarea" rows="6">{"host":"example.org","tls":"1.2","hsts":false}</textarea></div>
        <div class="field-group"><label class="field-label" for="jd-b">JSON B (Updated)</label><textarea id="jd-b" class="textarea" rows="6">{"host":"example.org","tls":"1.3","hsts":true,"csp":"default-src 'self'"}</textarea></div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="jd-run">Compare JSON</button>
      <div id="jd-out" style="margin-top: 14px;"></div>
    </div>
  `;

  function run() {
    const out = document.getElementById('jd-out');
    try {
      const a = JSON.parse(document.getElementById('jd-a').value);
      const b = JSON.parse(document.getElementById('jd-b').value);
      const diffs = diffJsonObjects(a, b);
      if (diffs.length === 0) {
        out.innerHTML = '<div class="notice notice-ok">JSON documents are structurally identical.</div>';
        return;
      }
      out.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>JSON Path</th><th>Change</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              ${diffs.map((d) => `
                <tr>
                  <td class="mono">${escapeHtml(d.path)}</td>
                  <td class="mono ${d.kind === 'added' ? 'state-text-ok' : d.kind === 'removed' ? 'state-text-danger' : 'state-text-warn'}">${d.kind}</td>
                  <td class="mono">${d.before !== undefined ? escapeHtml(JSON.stringify(d.before)) : '—'}</td>
                  <td class="mono">${d.after !== undefined ? escapeHtml(JSON.stringify(d.after)) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      out.innerHTML = `<div class="notice notice-danger">JSON parse error: ${escapeHtml(err.message)}</div>`;
    }
  }

  document.getElementById('jd-run').addEventListener('click', run);
  run();
}

function renderXmlFormatter(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="xf-in">XML Input</label>
        <textarea id="xf-in" class="textarea" rows="6"><config><tls>1.3</tls><logging>disabled</logging></config></textarea>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="xf-btn">Validate &amp; Format XML</button>
      <div id="xf-status" class="field-hint" style="margin-top: 8px;"></div>
    </div>
  `;

  document.getElementById('xf-btn').addEventListener('click', () => {
    const area = document.getElementById('xf-in');
    const st = document.getElementById('xf-status');
    const doc = new DOMParser().parseFromString(area.value, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) {
      st.textContent = 'Invalid XML: ' + err.textContent.slice(0, 140);
      st.className = 'field-hint state-text-danger';
      return;
    }
    const serialized = new XMLSerializer().serializeToString(doc);
    let indent = 0;
    const formatted = serialized
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .split('\n')
      .map((node) => {
        if (/^<\/\w/.test(node)) indent = Math.max(0, indent - 1);
        const line = '  '.repeat(indent) + node;
        if (/^<\w[^>]*[^\/]>$/.test(node) && !node.includes('</')) indent += 1;
        return line;
      })
      .join('\n');
    area.value = formatted;
    st.textContent = 'Well-formed XML formatted locally.';
    st.className = 'field-hint state-text-ok';
  });
}

function renderYamlConverter(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="yc-yaml">YAML</label><textarea id="yc-yaml" class="textarea" rows="8">app: privacore\nlocalOnly: true\ncategories:\n  - privacy\n  - network</textarea></div>
        <div class="field-group"><label class="field-label" for="yc-json">JSON</label><textarea id="yc-json" class="textarea" rows="8"></textarea></div>
      </div>
      <div class="input-row">
        <button type="button" class="btn btn-primary btn-sm" id="yc-to-json">YAML to JSON</button>
        <button type="button" class="btn btn-secondary btn-sm" id="yc-to-yaml">JSON to YAML</button>
      </div>
      <div id="yc-err" class="field-hint" style="margin-top: 8px;"></div>
    </div>
  `;

  const yamlEl = document.getElementById('yc-yaml');
  const jsonEl = document.getElementById('yc-json');
  const errEl = document.getElementById('yc-err');

  function toJson() {
    try {
      jsonEl.value = JSON.stringify(parseSimpleYaml(yamlEl.value), null, 2);
      errEl.textContent = 'Converted YAML to JSON locally.';
      errEl.className = 'field-hint state-text-ok';
    } catch (e) {
      errEl.textContent = e.message;
      errEl.className = 'field-hint state-text-danger';
    }
  }

  function toYaml() {
    try {
      yamlEl.value = stringifySimpleYaml(JSON.parse(jsonEl.value));
      errEl.textContent = 'Converted JSON to YAML locally.';
      errEl.className = 'field-hint state-text-ok';
    } catch (e) {
      errEl.textContent = e.message;
      errEl.className = 'field-hint state-text-danger';
    }
  }

  document.getElementById('yc-to-json').addEventListener('click', toJson);
  document.getElementById('yc-to-yaml').addEventListener('click', toYaml);
  toJson();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      if (ch === '\r') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function renderCsvInspector(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="csv-in">CSV Data (Parsed Locally)</label>
        <textarea id="csv-in" class="textarea" rows="5">name,email,role\nAda Lovelace,ada@example.org,Engineer\nGrace Hopper,grace@example.org,Architect</textarea>
      </div>
      <div class="input-row" style="margin-bottom: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="csv-parse">Inspect &amp; Convert to JSON</button>
        <button type="button" class="btn btn-secondary btn-sm" id="csv-copy-json">Copy JSON</button>
      </div>
      <div id="csv-table" class="table-wrap" style="margin-bottom: 12px;"></div>
      <div id="csv-json" class="output-box"></div>
    </div>
  `;

  let latestJson = '[]';
  function run() {
    const rows = parseCsv(document.getElementById('csv-in').value.trim());
    if (rows.length === 0) return;
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const objects = dataRows.map((r) => headers.reduce((acc, h, idx) => {
      acc[h || `col_${idx}`] = r[idx] ?? '';
      return acc;
    }, {}));
    latestJson = JSON.stringify(objects, null, 2);
    document.getElementById('csv-table').innerHTML = `
      <table class="data-table">
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${dataRows.map((r) => `<tr>${headers.map((_, i) => `<td class="mono">${escapeHtml(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
    document.getElementById('csv-json').textContent = latestJson;
  }

  document.getElementById('csv-parse').addEventListener('click', run);
  document.getElementById('csv-copy-json').addEventListener('click', () => copyText(latestJson, 'CSV JSON copied'));
  run();
}

function renderTextDiff(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group"><label class="field-label" for="td-a">Original Text</label><textarea id="td-a" class="textarea" rows="6">line one\nold setting = false\nline three</textarea></div>
        <div class="field-group"><label class="field-label" for="td-b">Modified Text</label><textarea id="td-b" class="textarea" rows="6">line one\nnew setting = true\nline three\nline four</textarea></div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="td-run">Compare Lines</button>
      <div id="td-out" class="output-box" style="margin-top: 14px; padding: 8px 0;"></div>
    </div>
  `;

  function run() {
    const diff = diffLines(document.getElementById('td-a').value, document.getElementById('td-b').value);
    document.getElementById('td-out').innerHTML = diff
      .map((d) => {
        const prefix = d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  ';
        return `<div class="diff-line diff-${d.type}">${escapeHtml(prefix + d.line)}</div>`;
      })
      .join('');
  }

  document.getElementById('td-run').addEventListener('click', run);
  run();
}

function renderPiiRedactor(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="pr-in">Paste Log or Text Containing Sensitive Patterns</label>
        <textarea id="pr-in" class="textarea" rows="5">User alice@example.org logged in from 203.0.113.42, phone +1-555-234-5678.</textarea>
      </div>
      <div class="input-row" style="margin-bottom: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="pr-run">Redact PII Patterns</button>
        <button type="button" class="btn btn-secondary btn-sm" id="pr-copy">Copy Redacted Text</button>
      </div>
      <textarea id="pr-out" class="textarea" rows="5" readonly></textarea>
    </div>
  `;

  function run() {
    let text = document.getElementById('pr-in').value;
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]');
    text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD_OR_ID]');
    text = text.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]');
    document.getElementById('pr-out').value = text;
  }

  document.getElementById('pr-run').addEventListener('click', run);
  document.getElementById('pr-copy').addEventListener('click', () => copyText(document.getElementById('pr-out').value, 'Redacted text copied'));
  run();
}

function renderSecureNotes(container) {
  const saved = getNotesData();
  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Local-Only Scratchpad</h3>
        <span class="field-hint">${saved.updatedAt ? `Last saved: ${new Date(saved.updatedAt).toLocaleString()}` : 'Not saved yet'}</span>
      </div>
      <div class="field-group">
        <label class="field-label" for="sn-text">Note Content (Stored in browser localStorage only)</label>
        <textarea id="sn-text" class="textarea" rows="8" placeholder="Write private local notes...">${escapeHtml(saved.content || '')}</textarea>
      </div>
      <div class="input-row">
        <button type="button" class="btn btn-primary btn-sm" id="sn-save">Save Locally</button>
        <button type="button" class="btn btn-danger btn-sm" id="sn-wipe">Wipe Note</button>
      </div>
    </div>
  `;

  document.getElementById('sn-save').addEventListener('click', () => {
    saveNotesData({ mode: 'plain', content: document.getElementById('sn-text').value, updatedAt: new Date().toISOString() });
    showToast('Note saved locally');
  });

  document.getElementById('sn-wipe').addEventListener('click', () => {
    document.getElementById('sn-text').value = '';
    saveNotesData({ mode: 'plain', content: '', updatedAt: null });
    showToast('Local note wiped');
  });
}
