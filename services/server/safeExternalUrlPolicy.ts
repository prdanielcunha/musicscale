import * as net from 'node:net';

export type SafeExternalUrlSuccess = {
  ok: true;
  url: URL;
  hostname: string;
  hostHeader: string;
  path: string;
  port: 443;
};

export type SafeExternalUrlFailure = {
  ok: false;
  statusCode: 400 | 403;
  error: "INVALID_SOURCE_URL" | "UNSAFE_SOURCE_URL";
};

export type SafeExternalUrlValidation =
  | SafeExternalUrlSuccess
  | SafeExternalUrlFailure;

export function validateExternalUrl(rawUrl: unknown): SafeExternalUrlValidation {
  if (typeof rawUrl !== 'string') {
    return { ok: false, statusCode: 400, error: 'INVALID_SOURCE_URL' };
  }
  
  const trimmedUrl = rawUrl.trim();
  if (trimmedUrl === '') {
    return { ok: false, statusCode: 400, error: 'INVALID_SOURCE_URL' };
  }
  if (trimmedUrl.length > 2048) {
    return { ok: false, statusCode: 400, error: 'INVALID_SOURCE_URL' };
  }
  
  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return { ok: false, statusCode: 400, error: 'INVALID_SOURCE_URL' };
  }
  
  if (parsed.protocol !== 'https:') {
    return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
  }
  
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
  }
  
  if (parsed.port !== '' && parsed.port !== '443') {
    return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
  }
  
  let hostname = parsed.hostname;
  if (!hostname) {
    return { ok: false, statusCode: 400, error: 'INVALID_SOURCE_URL' };
  }
  
  // Normalization: remove trailing dot
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }
  
  // Normalization: lowercase
  hostname = hostname.toLowerCase();
  
  // Normalization: remove external brackets for IPv6 from parsed.hostname
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  
  // Extract raw authority to check for ambiguous IPv4
  const authMatch = trimmedUrl.match(/^https?:\/\/([^/?#]+)/i);
  if (authMatch) {
    let rawAuth = authMatch[1];
    if (rawAuth.includes('@')) {
      rawAuth = rawAuth.split('@').pop()!;
    }
    let rawHost = rawAuth;
    if (rawHost.includes(']:')) {
      rawHost = rawHost.split(']:')[0] + ']';
    } else if (rawHost.includes(':') && !rawHost.includes(']')) {
      rawHost = rawHost.split(':')[0];
    }
    
    // If parsed hostname is a valid IPv4, the raw host MUST match exactly
    // to prevent URL parser from normalizing ambiguous formats like octal, hex, or missing octets.
    if (net.isIPv4(hostname)) {
      if (rawHost !== hostname) {
        return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
      }
    }
  }

  // Validate IP literals or domain
  if (net.isIPv4(hostname) || net.isIPv6(hostname)) {
     const ipResult = validateExternalIpAddress(hostname);
     if (!ipResult.ok) {
         return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
     }
     hostname = ipResult.address;
  } else {
    // Treat as domain
    if (/^[\d.]+$/.test(hostname)) {
      return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
    }
    if (isProhibitedExternalHostname(hostname)) {
      return { ok: false, statusCode: 403, error: 'UNSAFE_SOURCE_URL' };
    }
  }
  
  const hostHeader = net.isIPv6(hostname) ? `[${hostname}]` : hostname;
  const path = parsed.pathname + parsed.search; // Hash is explicitly ignored
  
  parsed.hostname = hostHeader;
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  if (parsed.port === '443') {
    parsed.port = '';
  }

  return {
    ok: true,
    url: parsed,
    hostname,
    hostHeader,
    path,
    port: 443
  };
}

function isProhibitedExternalHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname === 'metadata' || hostname === 'metadata.google.internal') return true;
  
  const prohibitedSuffixes = ['.local', '.internal', '.lan', '.home', '.corp', '.intranet'];
  for (const suffix of prohibitedSuffixes) {
    if (hostname.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

function parseIPv6ToBigInt(ip: string): bigint | null {
  if (!net.isIPv6(ip)) return null;
  let parts = ip.split(':');
  
  // Handle IPv4 embedded at the end
  if (parts.length > 0 && parts[parts.length - 1].includes('.')) {
    const ipv4 = parts.pop()!;
    const v4Parts = ipv4.split('.').map(Number);
    if (v4Parts.length !== 4) return null;
    parts.push(((v4Parts[0] << 8) | v4Parts[1]).toString(16));
    parts.push(((v4Parts[2] << 8) | v4Parts[3]).toString(16));
  }
  
  const joined = parts.join(':');
  const doubleColon = joined.indexOf('::');
  if (doubleColon !== -1) {
    const left = joined.substring(0, doubleColon).split(':').filter(Boolean);
    const right = joined.substring(doubleColon + 2).split(':').filter(Boolean);
    const missing = 8 - (left.length + right.length);
    const zeros = Array(missing).fill('0');
    parts = [...left, ...zeros, ...right];
  } else {
    parts = joined.split(':');
  }
  
  if (parts.length !== 8) return null;
  
  let val = 0n;
  for (let i = 0; i < 8; i++) {
    const num = parseInt(parts[i] || '0', 16);
    if (isNaN(num)) return null;
    val = (val << 16n) | BigInt(num);
  }
  return val;
}

function ip4ToBigInt(ip: string): bigint {
  const parts = ip.split('.').map(Number);
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

export function validateExternalIpAddress(address: unknown): { ok: true; address: string; family: 4 | 6 } | { ok: false; error: "UNSAFE_SOURCE_URL" } {
  if (typeof address !== 'string') return { ok: false, error: 'UNSAFE_SOURCE_URL' };
  
  if (net.isIPv4(address)) {
    // Strictly validate 4 octets, decimal, no leading zeros (except for 0)
    const parts = address.split('.');
    if (parts.length !== 4) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    for (const p of parts) {
      if (!/^(0|[1-9]\d{0,2})$/.test(p)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
      if (parseInt(p, 10) > 255) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    }
    
    const val = ip4ToBigInt(address);
    const checkV4 = (v: bigint, netAddr: string, prefix: bigint) => {
      const netVal = ip4ToBigInt(netAddr);
      const shift = 32n - prefix;
      return (v >> shift) === (netVal >> shift);
    };
    
    if (checkV4(val, '0.0.0.0', 8n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '10.0.0.0', 8n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '100.64.0.0', 10n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '127.0.0.0', 8n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '169.254.0.0', 16n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '172.16.0.0', 12n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '192.0.0.0', 24n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '192.0.2.0', 24n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '192.168.0.0', 16n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '198.18.0.0', 15n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '198.51.100.0', 24n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '203.0.113.0', 24n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '224.0.0.0', 4n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '240.0.0.0', 4n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV4(val, '255.255.255.255', 32n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    
    return { ok: true, address, family: 4 };
  } else if (net.isIPv6(address)) {
    const val = parseIPv6ToBigInt(address);
    if (val === null) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    
    // Check IPv4 mapped
    const top96 = val >> 32n;
    if (top96 === 0xffffn || top96 === 0n) {
      const lower32 = val & 0xffffffffn;
      const v4Str = `${(lower32 >> 24n) & 0xffn}.${(lower32 >> 16n) & 0xffn}.${(lower32 >> 8n) & 0xffn}.${lower32 & 0xffn}`;
      const v4res = validateExternalIpAddress(v4Str);
      if (!v4res.ok) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
      return { ok: true, address: address.toLowerCase(), family: 6 };
    }
    
    const checkV6 = (v: bigint, netHex: string, prefix: bigint) => {
      const netVal = parseIPv6ToBigInt(netHex)!;
      const shift = 128n - prefix;
      return (v >> shift) === (netVal >> shift);
    };
    
    if (checkV6(val, '::', 128n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '::1', 128n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, 'fc00::', 7n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, 'fe80::', 10n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, 'ff00::', 8n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '2001:db8::', 32n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '2001::', 32n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '2002::', 16n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '100::', 64n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '64:ff9b::', 96n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };
    if (checkV6(val, '64:ff9b:1::', 48n)) return { ok: false, error: 'UNSAFE_SOURCE_URL' };

    return { ok: true, address: address.toLowerCase(), family: 6 };
  }
  
  return { ok: false, error: 'UNSAFE_SOURCE_URL' };
}
