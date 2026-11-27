import net from 'node:net';
import { checkRateLimit, isPublicIp, sendJson } from './_lib/security.js';

function extractClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const remote = req.socket?.remoteAddress || '';
  if (remote.startsWith('::ffff:')) {
    return remote.slice(7);
  }
  return remote;
}

async function fetchIpMetadata(targetIp) {
  const endpoint = targetIp
    ? `https://ipwho.is/${encodeURIComponent(targetIp)}`
    : 'https://ipwho.is/';

  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'PRIVACORE-IP-Explorer/1.0' },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`IP provider returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.message || 'IP lookup failed at provider.');
  }

  return {
    ip: data.ip || targetIp || null,
    version: data.type || (net.isIPv6(data.ip || targetIp || '') ? 'IPv6' : 'IPv4'),
    country: data.country || null,
    countryCode: data.country_code || null,
    region: data.region || null,
    city: data.city || null,
    asn: data.connection?.asn ? `AS${data.connection.asn}` : null,
    org: data.connection?.org || data.connection?.isp || null,
    timezone: data.timezone?.id || null,
    provider: 'ipwho.is'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed. Use GET.' });
  }

  const rl = checkRateLimit(req, 'ip', 20, 60_000);
  if (!rl.allowed) {
    return sendJson(res, 429, {
      error: `Rate limit exceeded. Try again in ${rl.resetSeconds}s.`
    });
  }

  const reqUrl = new URL(req.url, 'http://localhost');
  const requestedIp = (reqUrl.searchParams.get('ip') || '').trim();

  if (requestedIp) {
    if (!net.isIP(requestedIp)) {
      return sendJson(res, 400, { error: 'Invalid IPv4 or IPv6 address format.' });
    }
    if (!isPublicIp(requestedIp)) {
      return sendJson(res, 400, {
        error: 'Private, loopback, link-local, or reserved IP addresses cannot be queried externally.'
      });
    }
    try {
      const meta = await fetchIpMetadata(requestedIp);
      return sendJson(res, 200, {
        mode: 'lookup',
        ...meta,
        disclaimer: 'IP geolocation is approximate (often city or regional ISP hub level) and is not reliable for physical address identification.'
      });
    } catch (err) {
      return sendJson(res, 502, {
        error: err?.message || 'Unable to retrieve IP metadata from external provider.'
      });
    }
  }

  const clientIp = extractClientIp(req);
  const isLocalClient = !clientIp || !isPublicIp(clientIp);

  try {
    const meta = await fetchIpMetadata(isLocalClient ? null : clientIp);
    return sendJson(res, 200, {
      mode: isLocalClient ? 'server-egress' : 'visitor',
      ...meta,
      clientSocketPrivate: isLocalClient,
      note: isLocalClient
        ? 'Private/local request socket detected (typical in local dev or proxied sandboxes). Displaying external egress IP reported by the provider.'
        : 'Displaying request IP metadata without storing or logging visitor addresses.',
      disclaimer: 'IP geolocation is approximate and reflects ISP/VPN/CGNAT routing rather than exact physical location.'
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: err?.message || 'External IP metadata provider is currently unreachable.'
    });
  }
}
