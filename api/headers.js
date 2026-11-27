import {
  checkRateLimit,
  readJsonBody,
  sendJson,
  validatePublicTargetUrl
} from './_lib/security.js';

const SECURITY_HEADERS = [
  {
    key: 'strict-transport-security',
    label: 'Strict-Transport-Security (HSTS)',
    purpose: 'Instructs browsers to communicate with the domain exclusively over HTTPS.'
  },
  {
    key: 'content-security-policy',
    label: 'Content-Security-Policy (CSP)',
    purpose: 'Restricts allowed script, style, frame, and network sources to reduce XSS impact.'
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    purpose: 'Prevents browsers from MIME-sniffing responses away from declared content types.'
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    purpose: 'Controls whether the page may be embedded in frames (clickjacking mitigation).'
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    purpose: 'Limits how much origin/path information is sent in the Referer header.'
  },
  {
    key: 'permissions-policy',
    label: 'Permissions-Policy',
    purpose: 'Restricts access to browser hardware and privacy APIs (camera, mic, geolocation).'
  },
  {
    key: 'cross-origin-opener-policy',
    label: 'Cross-Origin-Opener-Policy (COOP)',
    purpose: 'Isolates top-level browsing context from cross-origin popups.'
  },
  {
    key: 'cross-origin-resource-policy',
    label: 'Cross-Origin-Resource-Policy (CORP)',
    purpose: 'Limits which origins are allowed to load resources from this origin.'
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(req, 'headers', 15, 60_000);
  if (!rl.allowed) {
    return sendJson(res, 429, {
      error: `Rate limit exceeded. Try again in ${rl.resetSeconds}s.`
    });
  }

  let body;
  try {
    body = await readJsonBody(req, 4096);
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }

  if (body.confirmed !== true) {
    return sendJson(res, 400, {
      error: 'Please confirm that you own or have authorization to inspect this domain.'
    });
  }

  let parsedUrl;
  try {
    parsedUrl = await validatePublicTargetUrl(body.url);
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }

  try {
    const fetchOpts = {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'PRIVACORE-Security-Headers-Inspector/1.0'
      }
    };

    let response = await fetch(parsedUrl.toString(), fetchOpts);
    if (response.status === 405 || response.status === 501) {
      response = await fetch(parsedUrl.toString(), {
        ...fetchOpts,
        method: 'GET'
      });
      await response.body?.cancel().catch(() => {});
    }

    const headerMap = {};
    for (const def of SECURITY_HEADERS) {
      const value = response.headers.get(def.key);
      headerMap[def.key] = {
        label: def.label,
        purpose: def.purpose,
        present: Boolean(value),
        value: value || null
      };
    }

    const presentCount = Object.values(headerMap).filter((h) => h.present).length;

    return sendJson(res, 200, {
      target: parsedUrl.origin + parsedUrl.pathname,
      status: response.status,
      redirectedNotice:
        response.status >= 300 && response.status < 400
          ? `Target responded with redirect (${response.status}). Redirects are not automatically followed for SSRF safety; inspect the destination URL directly if needed.`
          : null,
      presentCount,
      totalChecked: SECURITY_HEADERS.length,
      headers: headerMap,
      limitations: [
        'Inspects only the initial response headers without following redirects or executing JavaScript.',
        'Bot-protection services, CDNs, or WAFs may block automated inspection requests.',
        'Presence of a header does not verify that its policy directives are securely configured.'
      ]
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: err?.name === 'TimeoutError'
        ? 'Target server timed out after 6 seconds.'
        : 'Unable to connect to the target server to inspect headers.'
    });
  }
}
