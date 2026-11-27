import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

const EPHEMERAL_SALT = crypto.randomBytes(16);
const rateBuckets = new Map();

export function getClientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === 'string'
      ? fwd.split(',')[0].trim()
      : req.socket?.remoteAddress || 'unknown';
  return crypto.createHmac('sha256', EPHEMERAL_SALT).update(raw).digest('hex').slice(0, 16);
}

export function checkRateLimit(req, bucketName, maxRequests = 25, windowMs = 60_000) {
  const now = Date.now();
  const key = `${bucketName}:${getClientKey(req)}`;
  let entry = rateBuckets.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count += 1;
  rateBuckets.set(key, entry);

  if (rateBuckets.size > 2000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (now > v.resetAt) rateBuckets.delete(k);
    }
  }

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetSeconds: Math.ceil((entry.resetAt - now) / 1000)
  };
}

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.end(JSON.stringify(payload));
}

export function isValidDomain(domain) {
  if (typeof domain !== 'string') return false;
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  if (net.isIP(trimmed)) return false;
  if (
    trimmed === 'localhost' ||
    trimmed.endsWith('.localhost') ||
    trimmed.endsWith('.local') ||
    trimmed.endsWith('.internal') ||
    trimmed.endsWith('.arpa')
  ) {
    return false;
  }
  const labels = trimmed.split('.');
  if (labels.length < 2) return false;
  const labelRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  return labels.every((label) => labelRegex.test(label));
}

export function isPublicIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
  if (a === 127) return false; // Loopback 127.0.0.0/8
  if (a === 169 && b === 254) return false; // Link-local / metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return false; // Private 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return false; // IETF protocol 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return false; // TEST-NET-1
  if (a === 192 && b === 168) return false; // Private 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return false; // Benchmarking 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // Multicast & reserved 224.0.0.0/4+
  return true;
}

export function isPublicIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) {
    return isPublicIpv4(ip);
  }
  if (kind === 6) {
    const norm = ip.toLowerCase();
    if (norm === '::' || norm === '::1') return false;
    if (norm.startsWith('::ffff:')) {
      const mapped = norm.slice(7);
      if (net.isIPv4(mapped)) return isPublicIpv4(mapped);
    }
    if (norm.startsWith('fc') || norm.startsWith('fd')) return false; // ULA fc00::/7
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) {
      return false; // Link-local fe80::/10
    }
    if (norm.startsWith('ff')) return false; // Multicast ff00::/8
    if (norm.startsWith('2001:db8:')) return false; // Documentation prefix
    return true;
  }
  return false;
}

export async function validatePublicTargetUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A target URL or domain is required.');
  }
  let candidate = rawUrl.trim();
  if (candidate.length > 512) {
    throw new Error('URL exceeds maximum allowed length (512 characters).');
  }
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https schemes are permitted.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded credentials are not permitted.');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Only standard HTTP/HTTPS ports (80, 443) are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (net.isIP(hostname)) {
    throw new Error('Direct IP targets are restricted; provide a public domain name.');
  }
  if (!isValidDomain(hostname)) {
    throw new Error('Target must be a valid public domain name.');
  }

  let resolved;
  try {
    resolved = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Unable to resolve target domain via DNS.');
  }

  if (!resolved || resolved.length === 0) {
    throw new Error('Target domain returned no DNS addresses.');
  }

  for (const record of resolved) {
    if (!isPublicIp(record.address)) {
      throw new Error('Target resolves to a private, loopback, or reserved network address.');
    }
  }

  return parsed;
}

export async function readJsonBody(req, maxBytes = 8192) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}
