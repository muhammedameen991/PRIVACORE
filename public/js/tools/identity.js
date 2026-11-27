import { copyText, escapeHtml, showToast } from '../icons.js';

const ADJECTIVES = ['quiet', 'cobalt', 'amber', 'northern', 'lunar', 'crimson', 'granite', 'velvet', 'solar', 'moss', 'arctic', 'silver', 'slate', 'timber', 'vivid', 'alpine'];
const NOUNS = ['kestrel', 'harbor', 'canyon', 'beacon', 'glacier', 'cypress', 'lantern', 'summit', 'compass', 'osprey', 'meadow', 'obsidian', 'prism', 'falcon', 'delta', 'ridge'];

function csprngIndex(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

export async function renderIdentityTool(kind, container) {
  switch (kind) {
    case 'alias-gen': return renderAliasGen(container);
    case 'username-gen': return renderUsernameGen(container);
    case 'threat-modeler': return renderThreatModeler(container);
    case 'data-rights-gen': return renderDataRightsGen(container);
    default:
      container.innerHTML = '<div class="notice">Identity tool module not found.</div>';
  }
}

function renderAliasGen(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-2">
        <div class="field-group">
          <label class="field-label" for="ag-base">Base Email or Custom Domain</label>
          <input id="ag-base" class="input mono" value="you@example.org" />
        </div>
        <div class="field-group">
          <label class="field-label" for="ag-service">Service Label (optional)</label>
          <input id="ag-service" class="input mono" value="shop" />
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="ag-gen">Generate Compartmentalized Aliases</button>
      <div id="ag-out" style="margin-top: 14px;" class="table-wrap"></div>
    </div>
  `;

  function run() {
    const raw = document.getElementById('ag-base').value.trim();
    const svc = document.getElementById('ag-service').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'service';
    const [local, domain] = raw.includes('@') ? raw.split('@') : ['user', raw || 'example.org'];
    const token = Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('');
    const word = NOUNS[csprngIndex(NOUNS.length)];

    const suggestions = [
      ['Sub-address (+tag)', `${local}+${svc}@${domain}`, 'Simple sorting; reveals base email to recipients.'],
      ['Sub-address (+service+random)', `${local}+${svc}.${token}@${domain}`, 'Harder to guess across services; still shares base local-part.'],
      ['Randomized Catch-All Alias', `${svc}.${word}.${token}@${domain}`, 'Requires custom domain catch-all or alias forwarding service.'],
      ['Opaque Random Alias', `${word}-${token}@${domain}`, 'Hides both service name and identity when used with forwarding.']
    ];

    document.getElementById('ag-out').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Pattern</th><th>Generated Alias</th><th>Trade-off</th><th>Copy</th></tr></thead>
        <tbody>
          ${suggestions.map(([type, addr, note]) => `
            <tr>
              <td>${escapeHtml(type)}</td>
              <td class="mono">${escapeHtml(addr)}</td>
              <td class="field-hint">${escapeHtml(note)}</td>
              <td><button type="button" class="btn btn-secondary btn-sm ag-cp" data-val="${escapeHtml(addr)}">Copy</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.querySelectorAll('.ag-cp').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.val, 'Alias copied')));
  }

  document.getElementById('ag-gen').addEventListener('click', run);
  run();
}

function renderUsernameGen(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="input-row" style="margin-bottom: 14px;">
        <button type="button" class="btn btn-primary" id="ug-gen">Generate 6 Unlinkable Handles</button>
      </div>
      <div id="ug-out" class="table-wrap"></div>
    </div>
  `;

  function run() {
    const rows = Array.from({ length: 6 }, () => {
      const a = ADJECTIVES[csprngIndex(ADJECTIVES.length)];
      const n = NOUNS[csprngIndex(NOUNS.length)];
      const num = 10 + csprngIndex(89);
      return `${a}_${n}${num}`;
    });
    document.getElementById('ug-out').innerHTML = `
      <table class="data-table">
        <tbody>
          ${rows.map((u) => `<tr><td class="mono">${u}</td><td style="text-align:right;"><button type="button" class="btn btn-secondary btn-sm ug-cp" data-val="${u}">Copy</button></td></tr>`).join('')}
        </tbody>
      </table>
    `;
    container.querySelectorAll('.ug-cp').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.val, 'Username copied')));
  }

  document.getElementById('ug-gen').addEventListener('click', run);
  run();
}

function renderThreatModeler(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group"><label class="field-label" for="tm-1">1. What assets am I protecting?</label><input id="tm-1" class="input" value="Primary email, banking credentials, personal photos" /></div>
      <div class="field-group"><label class="field-label" for="tm-2">2. Who am I protecting them from?</label><input id="tm-2" class="input" value="Opportunistic credential stuffers, data brokers, public Wi-Fi eavesdroppers" /></div>
      <div class="field-group"><label class="field-label" for="tm-3">3. What happens if protection fails?</label><input id="tm-3" class="input" value="Account takeover, identity correlation, financial loss" /></div>
      <div class="field-group"><label class="field-label" for="tm-4">4. Concrete mitigations to adopt</label><textarea id="tm-4" class="textarea" rows="3">- Unique password manager credentials + hardware/TOTP MFA\n- Compartmentalized email aliases\n- Full-disk encryption and encrypted backups</textarea></div>
      <button type="button" class="btn btn-primary btn-sm" id="tm-export">Download Threat Model (.md)</button>
    </div>
  `;

  document.getElementById('tm-export').addEventListener('click', () => {
    const md = `# Personal Privacy Threat Model\n\n## 1. Assets\n${document.getElementById('tm-1').value}\n\n## 2. Adversaries / Risks\n${document.getElementById('tm-2').value}\n\n## 3. Impact\n${document.getElementById('tm-3').value}\n\n## 4. Mitigations\n${document.getElementById('tm-4').value}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'threat-model.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Threat model downloaded');
  });
}

function renderDataRightsGen(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="grid-3">
        <div class="field-group"><label class="field-label" for="dr-reg">Framework</label><select id="dr-reg" class="select"><option value="GDPR">GDPR Art. 17 (Erasure)</option><option value="CCPA">CCPA / CPRA (Delete)</option></select></div>
        <div class="field-group"><label class="field-label" for="dr-org">Company / Controller Name</label><input id="dr-org" class="input" value="Example Services Inc." /></div>
        <div class="field-group"><label class="field-label" for="dr-email">Account Email</label><input id="dr-email" class="input mono" value="user@example.org" /></div>
      </div>
      <div class="field-group"><label class="field-label">Generated Request Letter</label><textarea id="dr-out" class="textarea" rows="10" readonly></textarea></div>
      <button type="button" class="btn btn-secondary btn-sm" id="dr-copy">Copy Letter</button>
    </div>
  `;

  function build() {
    const reg = document.getElementById('dr-reg').value;
    const org = document.getElementById('dr-org').value.trim();
    const email = document.getElementById('dr-email').value.trim();
    const law = reg === 'GDPR'
      ? 'Article 17 of the General Data Protection Regulation (GDPR)'
      : 'the California Consumer Privacy Act / CPRA';

    document.getElementById('dr-out').value =
`Subject: Formal Data Erasure Request (${reg})

Dear ${org} Privacy Team,

Under ${law}, I am requesting the complete erasure of all personal data associated with my account (${email}) that is no longer strictly necessary for legal compliance.

Please confirm within the statutory timeframe once deletion is completed across active systems and backups, and notify any third parties with whom this data was shared.

Regards,
Account Holder (${email})`;
  }

  ['dr-reg', 'dr-org', 'dr-email'].forEach((id) => document.getElementById(id).addEventListener('input', build));
  document.getElementById('dr-copy').addEventListener('click', () => copyText(document.getElementById('dr-out').value, 'Template copied'));
  build();
}
