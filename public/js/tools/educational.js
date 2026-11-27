import { escapeHtml } from '../icons.js';
import { getChecklistState, setChecklistState } from '../state.js';

const CHECKLISTS = {
  'browser-hardening': [
    { id: 'bh-1', title: 'Enable HTTPS-Only Mode', detail: 'Prevent silent fallback to unencrypted HTTP connections.' },
    { id: 'bh-2', title: 'Enable Global Privacy Control (GPC)', detail: 'Advertise automated opt-out preference where supported.' },
    { id: 'bh-3', title: 'Configure Encrypted DNS (DoH/DoT)', detail: 'Encrypt DNS queries in browser or OS network settings.' },
    { id: 'bh-4', title: 'Audit Installed Extensions', detail: 'Remove unused extensions; minimize broad host-read permissions.' },
    { id: 'bh-5', title: 'Isolate Third-Party Cookies', detail: 'Use strict tracking protection or total cookie partitioning.' }
  ],
  'account-security': [
    { id: 'as-1', title: 'Use Unique Passwords Everywhere', detail: 'Never reuse credentials across independent services.' },
    { id: 'as-2', title: 'Enable Phishing-Resistant MFA / Passkeys', detail: 'Prefer FIDO2 security keys or TOTP apps over SMS OTP.' },
    { id: 'as-3', title: 'Store Recovery Codes Offline', detail: 'Keep backup 2FA recovery codes in an encrypted vault or secure print.' },
    { id: 'as-4', title: 'Review Active Sessions & OAuth Grants', detail: 'Revoke old connected apps and unrecognized login sessions.' }
  ],
  'device-hardening': [
    { id: 'dh-1', title: 'Verify Full-Disk Encryption', detail: 'Ensure FileVault, BitLocker, or LUKS is active on all drives.' },
    { id: 'dh-2', title: 'Enable Automatic Security Updates', detail: 'Apply OS, browser, and firmware patches promptly.' },
    { id: 'dh-3', title: 'Short Screen-Lock Timeout', detail: 'Require passphrase/PIN immediately upon sleep or lid close.' },
    { id: 'dh-4', title: 'Disable Unneeded Network Sharing', detail: 'Turn off AirDrop/Bluetooth/SMB sharing on untrusted networks.' }
  ],
  'travel-opsec': [
    { id: 'to-1', title: 'Back Up & Minimize Carried Data', detail: 'Carry only accounts and documents needed for the trip.' },
    { id: 'to-2', title: 'Use Passphrase Unlock Over Biometrics', detail: 'Disable quick-unlock where appropriate and power down before transit.' },
    { id: 'to-3', title: 'Carry Hardware MFA Key Backup', detail: 'Avoid relying solely on roaming SMS for critical logins.' }
  ],
  'incident-response': [
    { id: 'ir-1', title: 'Rotate Compromised Credentials Immediately', detail: 'Change passwords from a known-clean device starting with primary email.' },
    { id: 'ir-2', title: 'Revoke All Active Sessions & API Tokens', detail: 'Use "Sign out of all devices" and regenerate OAuth/API tokens.' },
    { id: 'ir-3', title: 'Check Mail Forwarding & Filter Rules', detail: 'Attackers often add silent inbox forwarding rules after compromise.' },
    { id: 'ir-4', title: 'Review Login Audit Logs', detail: 'Record timestamps and IPs before reporting to IT or security teams.' }
  ],
  'backup-321': [
    { id: 'bk-1', title: '3 Copies of Critical Data', detail: 'Primary working copy plus two independent backups.' },
    { id: 'bk-2', title: '2 Different Storage Media', detail: 'Avoid single points of failure (e.g., local NAS + external SSD).' },
    { id: 'bk-3', title: '1 Offsite / Encrypted Cloud Copy', detail: 'Encrypt backups client-side before uploading to offsite storage.' },
    { id: 'bk-4', title: 'Test Restore Quarterly', detail: 'An untested backup cannot be assumed recoverable.' }
  ],
  'data-minimization': [
    { id: 'dm-1', title: 'Delete Dormant Accounts', detail: 'Each unused account increases breach exposure surface.' },
    { id: 'dm-2', title: 'Purge Old Tax/ID Scans from Cloud Mail', detail: 'Move archival identity scans to encrypted local storage.' },
    { id: 'dm-3', title: 'Disable Unnecessary Telemetry & Ad IDs', detail: 'Opt out of cross-app diagnostic and personalization profiles.' }
  ],
  'digital-footprint': [
    { id: 'df-1', title: 'Search Your Name, Phone, and Handles', detail: 'Identify public profiles, leaked directories, and old forum posts.' },
    { id: 'df-2', title: 'Separate Public vs Private Usernames', detail: 'Stop reusing the same handle across sensitive and public platforms.' },
    { id: 'df-3', title: 'Submit Data-Broker Opt-Outs', detail: 'Remove home address and phone listings where legally supported.' }
  ],
  'social-privacy': [
    { id: 'sp-1', title: 'Disable Phone & Email Lookup', detail: 'Prevent strangers from finding your profile via contact upload.' },
    { id: 'sp-2', title: 'Turn Off Contact Book Syncing', detail: 'Keep your contacts graph off third-party marketing servers.' },
    { id: 'sp-3', title: 'Restrict Past Posts & Tag Approvals', detail: 'Require manual approval before tagged photos appear publicly.' }
  ],
  'breach-response': [
    { id: 'br-1', title: 'Change Reused Passwords Immediately', detail: 'Assume credential stuffing bots already test leaked combos.' },
    { id: 'br-2', title: 'Enable MFA on Affected & Linked Accounts', detail: 'Prioritize email, banking, and cloud storage first.' },
    { id: 'br-3', title: 'Freeze Credit Files If SSN/Gov ID Exposed', detail: 'Contact national credit bureaus to place security freezes.' }
  ],
  'iot-privacy': [
    { id: 'io-1', title: 'Place IoT Devices on Guest/Isolated VLAN', detail: 'Prevent smart TVs and plugs from reaching laptops or NAS.' },
    { id: 'io-2', title: 'Disable ACR & Voice History Retention', detail: 'Turn off automatic content recognition on smart TVs.' },
    { id: 'io-3', title: 'Change Default Router & Camera Passwords', detail: 'Disable UPnP and remote WAN admin interfaces.' }
  ]
};

const ARTICLES = {
  'doh-dot': {
    title: 'Encrypted DNS: DoH, DoT, and DNSSEC',
    sections: [
      ['DNS-over-HTTPS (DoH · TCP/443)', 'Encapsulates DNS queries inside standard HTTPS traffic, blending with web browsing and preventing local ISP or coffee-shop snooping.'],
      ['DNS-over-TLS (DoT · TCP/853)', 'Dedicated TLS tunnel for DNS, common at the OS or router level (Android Private DNS, systemd-resolved).'],
      ['DNSSEC', 'Cryptographically signs DNS records to prevent tampering/spoofing, but does NOT encrypt query contents.'],
      ['Key Limitation', 'Encrypted DNS shifts visibility from your ISP to your chosen DNS resolver; it does not hide which IP addresses or SNI hostnames you subsequently connect to.']
    ]
  },
  'vpn-limits': {
    title: 'VPN Threat Model: What It Solves and What It Does Not',
    sections: [
      ['What a VPN Protects', 'Encrypts traffic between your device and the VPN exit server, shielding browsing from local Wi-Fi eavesdroppers and your transit ISP.'],
      ['What a VPN Does NOT Protect', 'Logged-in accounts, browser cookies, device fingerprinting, location permissions, malware, and malicious phishing links remain fully effective over a VPN.'],
      ['Trust Shift', 'Using a VPN shifts network visibility from your local ISP to the VPN provider.']
    ]
  },
  'ipv6-privacy': {
    title: 'IPv4 / IPv6 Dual-Stack Privacy',
    sections: [
      ['Why IPv6 Matters', 'If your ISP provides IPv6 while a tunnel handles only IPv4, browsers may connect directly over IPv6 using Happy Eyeballs.'],
      ['RFC 8981 Temporary Addresses', 'Modern operating systems rotate temporary IPv6 interface identifiers instead of embedding your MAC address (EUI-64).']
    ]
  },
  'scam-awareness': {
    title: 'Modern Social Engineering & Scam Patterns',
    sections: [
      ['MFA Prompt Bombing (Fatigue)', 'Attackers with a stolen password repeatedly trigger push approvals hoping you tap Approve out of annoyance. Never approve uninitiated prompts.'],
      ['SIM Swapping', 'Social engineering a mobile carrier to port your number. Mitigate by moving critical accounts off SMS 2FA onto TOTP or hardware keys.'],
      ['Malicious OAuth Consent', 'Phishing links that ask you to grant an external app permission to read your cloud email or drive without stealing your password.']
    ]
  },
  'https-tls': {
    title: 'HTTPS & TLS 1.3 Guarantees and Metadata',
    sections: [
      ['Protected by TLS', 'URL paths, query strings, cookies, form bodies, and page HTML are encrypted end-to-end between browser and web server.'],
      ['Still Observable on the Wire', 'Destination IP address, port, packet timing/size, and unencrypted Server Name Indication (SNI) unless Encrypted Client Hello (ECH) is supported by both client and server.']
    ]
  },
  'permission-risks': {
    title: 'Browser & Device Permission Risk Tiers',
    sections: [
      ['High Sensitivity', 'Camera, Microphone, Precise Geolocation, USB/Serial/HID devices, Clipboard Read. Grant only temporarily and revoke when done.'],
      ['Moderate Sensitivity', 'Notifications (often abused for spam/scam alerts), Persistent Storage, Motion Sensors.']
    ]
  },
  'secure-deletion': {
    title: 'Why Cryptographic Erasure Beats File Shredding on SSDs',
    sections: [
      ['SSD Wear-Leveling & TRIM', 'Flash controllers remap logical blocks dynamically, meaning overwriting a single file may leave old copies in spare flash blocks.'],
      ['Best Practice', 'Enable full-disk encryption from day one. Destroying the encryption key renders all residual flash blocks unreadable.']
    ]
  },
  'location-privacy': {
    title: 'How Devices Infer Location Beyond GPS',
    sections: [
      ['Wi-Fi BSSID & Bluetooth Scanning', 'Nearby router MAC addresses mapped by location databases can pinpoint indoor position even when GPS is off.'],
      ['Photo EXIF Metadata', 'Smartphone cameras frequently embed latitude, longitude, altitude, and timestamp into JPEG headers. Strip EXIF before sharing publicly.']
    ]
  },
  'email-privacy': {
    title: 'Email Privacy: Pixels, Headers, and Metadata',
    sections: [
      ['Remote Tracking Pixels', '1×1 external images notify senders of your IP address, mail client, and exact open timestamp. Disable automatic remote image loading.'],
      ['Unencrypted Envelope Metadata', 'Even with PGP/S-MIME body encryption, From, To, Subject, and timestamps remain visible to mail relays.']
    ]
  },
  'messaging-privacy': {
    title: 'Encrypted Messaging vs Metadata',
    sections: [
      ['End-to-End Encryption (E2EE)', 'Protects message payloads so relay servers cannot read text or media.'],
      ['Cloud Backup Caveat', 'Unencrypted cloud backups of chat histories bypass E2EE guarantees; verify end-to-end encrypted backup settings and compare safety numbers.']
    ]
  },
  'ad-tracking': {
    title: 'Cross-Site Tracking & CNAME Cloaking',
    sections: [
      ['Real-Time Bidding (RTB)', 'Ad auctions broadcast page context, device signals, and pseudonymous identifiers across dozens of bidders in milliseconds.'],
      ['CNAME Cloaking', 'Subdomains like metrics.site.com pointing via DNS CNAME to third-party trackers disguise third-party cookies as first-party.']
    ]
  },
  'biometrics': {
    title: 'Biometrics vs Strong Passphrases',
    sections: [
      ['Convenience vs Revocability', 'A leaked password can be rotated; fingerprints and facial geometry cannot be changed if compromised.'],
      ['Best Role', 'Biometrics work well for local hardware unlock convenience paired with a strong underlying passphrase for cold boot and sensitive vaults.']
    ]
  },
  'compartmentalization': {
    title: 'Digital Compartmentalization Strategy',
    sections: [
      ['Browser Profile Separation', 'Use separate browser profiles for Banking/Identity, Work, and General Browsing so cookies and extensions stay isolated.'],
      ['Email Alias Isolation', 'Unique aliases reveal immediately which service leaked or sold your address.']
    ]
  }
};

const PORTS = [
  ['22 / TCP', 'SSH', 'Encrypted remote shell; disable password auth in favor of Ed25519 keys.'],
  ['53 / UDP,TCP', 'DNS', 'Plaintext domain lookups; prefer DoH (443) or DoT (853) on untrusted networks.'],
  ['80 / TCP', 'HTTP', 'Unencrypted web traffic; redirect immediately to HTTPS (443) with HSTS.'],
  ['443 / TCP,UDP', 'HTTPS / QUIC / DoH', 'TLS-encrypted web and DNS-over-HTTPS traffic.'],
  ['853 / TCP', 'DNS-over-TLS (DoT)', 'Dedicated TLS channel for encrypted DNS queries.'],
  ['993 / TCP', 'IMAPS', 'TLS-encrypted mail retrieval (avoid legacy unencrypted 143).'],
  ['1194 / UDP', 'OpenVPN', 'Common VPN tunnel port (configurable).'],
  ['51820 / UDP', 'WireGuard', 'Modern minimal-surface kernel/userspace VPN protocol.']
];

const CIPHERS = [
  ['AES-256-GCM / ChaCha20-Poly1305', 'AEAD Symmetric Encryption', 'Recommended', 'Provides both confidentiality and integrity authentication when used with unique nonces.'],
  ['Argon2id / scrypt', 'Password Hashing / KDF', 'Recommended', 'Memory-hard functions resistant to GPU/ASIC brute-force cracking.'],
  ['Ed25519 / ECDSA P-256', 'Digital Signatures', 'Recommended', 'Compact keys and fast signature verification.'],
  ['SHA-256 / SHA-3 / BLAKE3', 'Cryptographic Hashing', 'Recommended', 'Collision-resistant digests for integrity verification.'],
  ['MD5 / SHA-1 / RC4 / DES / AES-ECB', 'Legacy Algorithms', 'Deprecated', 'Broken collision resistance, biased keystreams, or deterministic block leakage. Avoid for security.']
];

const GLOSSARY = [
  ['AEAD', 'Authenticated Encryption with Associated Data (e.g., AES-GCM) — guarantees both secrecy and tamper detection.'],
  ['ASN', 'Autonomous System Number — identifies a network operator routing IP prefixes via BGP.'],
  ['CGNAT', 'Carrier-Grade NAT — multiple subscribers share one public IPv4 address, reducing IP geolocation accuracy.'],
  ['CSP', 'Content-Security-Policy — HTTP header restricting allowed script/style/connect origins to mitigate XSS.'],
  ['CSPRNG', 'Cryptographically Secure Pseudorandom Number Generator (window.crypto.getRandomValues).'],
  ['DoH / DoT', 'DNS-over-HTTPS / DNS-over-TLS — encrypts DNS queries in transit to a resolver.'],
  ['E2EE', 'End-to-End Encryption — only communicating endpoints hold decryption keys.'],
  ['EXIF', 'Exchangeable Image File Format — metadata embedded in photos (camera model, timestamps, GPS).'],
  ['GPC', 'Global Privacy Control — browser header/JS signal communicating Do Not Sell/Share opt-out.'],
  ['HSTS', 'HTTP Strict Transport Security — forces browsers to connect strictly via HTTPS.'],
  ['Homoglyph', 'Visually similar characters from different Unicode scripts (e.g., Cyrillic а vs Latin a).'],
  ['KDF', 'Key Derivation Function (PBKDF2, Argon2id) — stretches passphrases into cryptographic keys.'],
  ['PFS', 'Perfect Forward Secrecy — ephemeral session keys prevent past traffic decryption if long-term keys leak.'],
  ['SRI', 'Subresource Integrity — cryptographic hash verification for external scripts/stylesheets.'],
  ['SSRF', 'Server-Side Request Forgery — tricking a server into fetching internal/metadata network targets.']
];

const PHISHING_SCENARIOS = [
  {
    sender: 'security-alerts@paypa1-support-verify.com',
    subject: 'URGENT: Account suspended — verify within 2 hours',
    link: 'https://paypa1-support-verify.com/login',
    clues: ['Lookalike "1" replacing "l" in domain name', 'Artificial urgency threatening immediate suspension', 'Unrelated non-official domain']
  },
  {
    sender: 'it-helpdesk@corp-example.org',
    subject: 'Microsoft 365 MFA Reset Required',
    link: 'https://login.corp-example.org.session-reset-auth.net/oauth',
    clues: ['Subdomain deception: true registered domain is session-reset-auth.net', 'Requests credential entry on unverified external OAuth path']
  },
  {
    sender: 'notifications@github.com',
    subject: 'New SSH key added to your account',
    link: 'https://github.com/settings/keys',
    clues: ['Official domain matches sender and destination', 'No pressure to click blind links — still safest to navigate manually via bookmark']
  }
];

export async function renderEducationalTool(workbench, container) {
  switch (workbench.kind) {
    case 'checklist': return renderChecklist(workbench.checklistId, container);
    case 'article': return renderArticle(workbench.articleId, container);
    case 'ports-ref': return renderPortsRef(container);
    case 'cipher-ref': return renderCipherRef(container);
    case 'glossary': return renderGlossary(container);
    case 'faq': return renderFaq(container);
    case 'resources': return renderResources(container);
    case 'phishing-trainer': return renderPhishingTrainer(container);
    default:
      container.innerHTML = '<div class="notice">Educational module not found.</div>';
  }
}

function renderChecklist(id, container) {
  const items = CHECKLISTS[id] || [];
  let checked = new Set(getChecklistState(id));

  function draw() {
    const done = items.filter((i) => checked.has(i.id)).length;
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Interactive Self-Audit Checklist</h3>
          <span class="mono field-hint">${done} of ${items.length} completed (saved locally)</span>
        </div>
        <div class="checklist-list">
          ${items.map((item) => {
            const isChecked = checked.has(item.id);
            return `
              <label class="checklist-item ${isChecked ? 'checked' : ''}">
                <input type="checkbox" data-cid="${item.id}" ${isChecked ? 'checked' : ''} />
                <div>
                  <div class="checklist-title">${escapeHtml(item.title)}</div>
                  <div class="checklist-detail">${escapeHtml(item.detail)}</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
        <div style="margin-top: 14px;">
          <button type="button" class="btn btn-secondary btn-sm" id="cl-reset">Reset Checklist</button>
        </div>
      </div>
    `;
    container.querySelectorAll('input[data-cid]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) checked.add(cb.dataset.cid);
        else checked.delete(cb.dataset.cid);
        setChecklistState(id, Array.from(checked));
        draw();
      });
    });
    document.getElementById('cl-reset').addEventListener('click', () => {
      checked = new Set();
      setChecklistState(id, []);
      draw();
    });
  }
  draw();
}

function renderArticle(id, container) {
  const art = ARTICLES[id];
  if (!art) {
    container.innerHTML = '<div class="notice">Guide not found.</div>';
    return;
  }
  container.innerHTML = `
    <div class="panel" style="display: flex; flex-direction: column; gap: 16px;">
      <h3 class="panel-title">${escapeHtml(art.title)}</h3>
      ${art.sections.map(([heading, body]) => `
        <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(heading)}</div>
          <div style="color: var(--text-secondary); font-size: 14px;">${escapeHtml(body)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPortsRef(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="pr-search">Filter Ports or Protocols</label>
        <input id="pr-search" class="input" placeholder="Filter by port number, DNS, TLS, SSH..." />
      </div>
      <div id="pr-table" class="table-wrap"></div>
    </div>
  `;
  const paint = () => {
    const q = document.getElementById('pr-search').value.toLowerCase();
    const rows = PORTS.filter((r) => r.join(' ').toLowerCase().includes(q));
    document.getElementById('pr-table').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Port / Proto</th><th>Service</th><th>Privacy &amp; Security Note</th></tr></thead>
        <tbody>${rows.map(([p, s, n]) => `<tr><td class="mono">${escapeHtml(p)}</td><td><strong>${escapeHtml(s)}</strong></td><td>${escapeHtml(n)}</td></tr>`).join('')}</tbody>
      </table>
    `;
  };
  document.getElementById('pr-search').addEventListener('input', paint);
  paint();
}

function renderCipherRef(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Algorithm / Suite</th><th>Category</th><th>Guidance</th><th>Details</th></tr></thead>
          <tbody>
            ${CIPHERS.map(([alg, cat, status, desc]) => `
              <tr>
                <td class="mono">${escapeHtml(alg)}</td>
                <td>${escapeHtml(cat)}</td>
                <td class="mono ${status === 'Recommended' ? 'state-text-ok' : 'state-text-danger'}">${escapeHtml(status)}</td>
                <td>${escapeHtml(desc)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderGlossary(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="field-group">
        <label class="field-label" for="gl-filter">Search Glossary Terms</label>
        <input id="gl-filter" class="input" placeholder="Search AEAD, CGNAT, DoH, SRI..." />
      </div>
      <div id="gl-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
    </div>
  `;
  const paint = () => {
    const q = document.getElementById('gl-filter').value.toLowerCase();
    const hits = GLOSSARY.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(q));
    document.getElementById('gl-list').innerHTML = hits.length
      ? hits.map(([t, d]) => `<div style="border-top: 1px solid var(--border-hairline); padding-top: 10px;"><strong class="mono">${escapeHtml(t)}</strong><div style="color: var(--text-secondary); font-size: 13.5px; margin-top: 2px;">${escapeHtml(d)}</div></div>`).join('')
      : '<div class="notice">No glossary terms match your query.</div>';
  };
  document.getElementById('gl-filter').addEventListener('input', paint);
  paint();
}

function renderFaq(container) {
  const items = [
    ['Does PRIVACORE send my passwords, files, or encrypted text to a server?', 'No. Password Lab, Text Encryptor (AES-GCM), Metadata Inspector, QR Generator, Hashing, Diff, and Data formatters execute strictly in your browser memory using Web Crypto and Canvas/File APIs.'],
    ['Which tools use network APIs?', 'Only tools explicitly labeled API (DNS Explorer, IP Explorer, Security Headers Analyzer, HTTP Status Probe, Public Service Reachability). All server endpoints enforce validation, rate limits, and SSRF protections.'],
    ['Can PRIVACORE verify if my VPN is 100% leak-free?', 'No. Browser JavaScript cannot inspect OS routing tables, firewall rules, or local DNS resolvers reliably. Leak Awareness explains what browsers can and cannot observe honestly.'],
    ['Where are my favorites, history, and settings stored?', 'Strictly in your browser localStorage on this origin. You can inspect, export, or wipe everything anytime in Preferences & Data.']
  ];
  container.innerHTML = `
    <div class="panel" style="display: flex; flex-direction: column; gap: 14px;">
      ${items.map(([q, a]) => `
        <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(q)}</div>
          <div style="color: var(--text-secondary); font-size: 14px;">${escapeHtml(a)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResources(container) {
  const links = [
    ['Electronic Frontier Foundation (EFF)', 'https://www.eff.org/', 'Digital privacy advocacy, Cover Your Tracks, and HTTPS guides.'],
    ['Privacy Guides', 'https://www.privacyguides.org/', 'Independent threat-model-driven privacy tool recommendations.'],
    ['OWASP Foundation', 'https://owasp.org/', 'Open web application security standards, cheat sheets, and CSP guidance.'],
    ['NIST Cybersecurity & Crypto Standards', 'https://csrc.nist.gov/', 'Cryptographic algorithm specifications (AES, SHA, PBKDF2).'],
    ["Let's Encrypt", 'https://letsencrypt.org/', 'Free automated TLS certificate authority powering ubiquitous HTTPS.']
  ];
  container.innerHTML = `
    <div class="panel">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Organization</th><th>Description</th><th>Link</th></tr></thead>
          <tbody>
            ${links.map(([name, url, desc]) => `
              <tr>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${escapeHtml(desc)}</td>
                <td><a class="section-link" href="${url}" target="_blank" rel="noopener noreferrer">Visit</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPhishingTrainer(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      ${PHISHING_SCENARIOS.map((sc, idx) => `
        <div class="panel">
          <div class="field-hint mono">Scenario ${idx + 1}</div>
          <div style="margin: 6px 0;"><strong>From:</strong> <span class="mono">${escapeHtml(sc.sender)}</span></div>
          <div style="margin-bottom: 6px;"><strong>Subject:</strong> ${escapeHtml(sc.subject)}</div>
          <div style="margin-bottom: 12px;"><strong>Target Link Preview:</strong> <span class="mono">${escapeHtml(sc.link)}</span></div>
          <button type="button" class="btn btn-secondary btn-sm pt-reveal" data-idx="${idx}">Reveal Analysis</button>
          <div id="pt-ans-${idx}" hidden style="margin-top: 10px;" class="notice">
            <ul style="margin: 0 0 0 18px; padding: 0;">${sc.clues.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.pt-reveal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const box = document.getElementById(`pt-ans-${btn.dataset.idx}`);
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? 'Reveal Analysis' : 'Hide Analysis';
    });
  });
}
