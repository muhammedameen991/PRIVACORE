import { checkRateLimit, sendJson, validatePublicTargetUrl } from './_lib/security.js';

const PRESET_SERVICES = [
  { id: 'cloudflare-dns', name: 'Cloudflare DNS (DoH)', url: 'https://cloudflare-dns.com/dns-query', category: 'DNS' },
  { id: 'quad9', name: 'Quad9 Security', url: 'https://www.quad9.net/', category: 'DNS' },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://www.wikipedia.org/', category: 'Knowledge' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/', category: 'Code Hosting' },
  { id: 'mozilla', name: 'Mozilla', url: 'https://www.mozilla.org/', category: 'Browser / Standards' },
  { id: 'letsencrypt', name: "Let's Encrypt", url: 'https://letsencrypt.org/', category: 'PKI / TLS' }
];

async function probeService(targetUrl) {
  const start = performance.now();
  try {
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'PRIVACORE-Status-Probe/1.0' }
    });
    const latencyMs = Math.round(performance.now() - start);
    return {
      reachable: true,
      status: response.status,
      statusText: response.statusText || 'OK',
      latencyMs
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      reachable: false,
      status: null,
      statusText: err?.name === 'TimeoutError' ? 'Timeout' : 'Unreachable',
      latencyMs
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed. Use GET.' });
  }

  const rl = checkRateLimit(req, 'status', 20, 60_000);
  if (!rl.allowed) {
    return sendJson(res, 429, {
      error: `Rate limit exceeded. Try again in ${rl.resetSeconds}s.`
    });
  }

  const reqUrl = new URL(req.url, 'http://localhost');
  const preset = reqUrl.searchParams.get('preset');
  const customUrl = reqUrl.searchParams.get('url');

  if (preset === 'all') {
    const results = await Promise.all(
      PRESET_SERVICES.map(async (svc) => {
        const probe = await probeService(svc.url);
        return {
          id: svc.id,
          name: svc.name,
          category: svc.category,
          url: svc.url,
          ...probe
        };
      })
    );
    return sendJson(res, 200, {
      checkedAt: new Date().toISOString(),
      services: results,
      note: 'Latency reflects round-trip time from the server region to each service, not from your local device.'
    });
  }

  if (customUrl) {
    let parsed;
    try {
      parsed = await validatePublicTargetUrl(customUrl);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
    const probe = await probeService(parsed.toString());
    return sendJson(res, 200, {
      target: parsed.toString(),
      checkedAt: new Date().toISOString(),
      ...probe,
      note: 'HEAD probe without following redirects or reading body content.'
    });
  }

  return sendJson(res, 400, { error: 'Provide either ?preset=all or ?url=<public-domain>.' });
}
