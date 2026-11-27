import { checkRateLimit, isValidDomain, sendJson } from './_lib/security.js';

const ALLOWED_TYPES = new Set(['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA']);
const TYPE_CODES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257
};

async function queryDoh(domain, type) {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`
  ];

  let lastError = null;
  for (const url of providers) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/dns-json',
          'User-Agent': 'PRIVACORE-DNS-Explorer/1.0'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        lastError = new Error(`DNS provider returned HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      return {
        provider: url.includes('cloudflare-dns.com') ? 'Cloudflare DoH (1.1.1.1)' : 'Google Public DNS (8.8.8.8)',
        data
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All public DoH providers failed to respond.');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed. Use GET.' });
  }

  const rl = checkRateLimit(req, 'dns', 30, 60_000);
  if (!rl.allowed) {
    return sendJson(res, 429, {
      error: `Rate limit exceeded. Try again in ${rl.resetSeconds}s.`
    });
  }

  const reqUrl = new URL(req.url, 'http://localhost');
  const rawDomain = (reqUrl.searchParams.get('domain') || '').trim().toLowerCase().replace(/\.$/, '');
  const rawType = (reqUrl.searchParams.get('type') || 'A').trim().toUpperCase();

  if (!isValidDomain(rawDomain)) {
    return sendJson(res, 400, {
      error: 'Please enter a valid public domain name (e.g., example.org). Private, local, and IP targets are blocked.'
    });
  }

  if (!ALLOWED_TYPES.has(rawType)) {
    return sendJson(res, 400, {
      error: `Unsupported record type. Allowed types: ${Array.from(ALLOWED_TYPES).join(', ')}.`
    });
  }

  try {
    const { provider, data } = await queryDoh(rawDomain, rawType);
    const expectedCode = TYPE_CODES[rawType];
    const answers = Array.isArray(data.Answer)
      ? data.Answer.map((ans) => ({
          name: ans.name,
          type: ans.type === expectedCode ? rawType : String(ans.type),
          ttl: ans.TTL,
          data: ans.data
        }))
      : [];

    return sendJson(res, 200, {
      domain: rawDomain,
      recordType: rawType,
      status: data.Status,
      ad: Boolean(data.AD),
      provider,
      records: answers,
      note: 'Queried via public DNS-over-HTTPS (DoH). Results reflect public resolver state and may differ from local split-horizon DNS.'
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: err?.message || 'Unable to query public DNS resolver.'
    });
  }
}
